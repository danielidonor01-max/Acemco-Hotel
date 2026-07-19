import { Injectable } from '@nestjs/common';
import { Prisma, RateRule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;
const money = (n: number) => Math.round(n * 100) / 100;
const dayStart = (d: Date | string) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
};

/**
 * Fallback bounds, used only if the settings row can't be read.
 *
 * A pricing engine that can produce an absurd number is worse than no engine: a
 * mis-keyed "+500%" would quote ₦390,000 for a ₦65,000 room and the mistake only
 * surfaces when a guest complains. The live values come from Settings — the right
 * ceiling is a commercial decision, not a constant — but the guard must never be
 * absent, so these apply if the lookup fails.
 */
const DEFAULT_FLOOR = 0.5;
const DEFAULT_CEILING = 3;

export interface NightlyRate {
  date: string;
  base: number;
  rate: number;
  /** Occupancy for that night, %, that the demand rules saw. */
  occupancy: number;
  applied: { name: string; adjustment: string; value: number; from: number; to: number }[];
  clamped?: 'FLOOR' | 'CEILING';
}

export interface Quote {
  nights: number;
  total: number;
  /** Average nightly rate across the stay. */
  averageRate: number;
  breakdown: NightlyRate[];
}

/**
 * Works out what a room costs on a given night.
 *
 * Every night used to sell at `roomType.basePrice` — no season, no weekend, no
 * response to demand — while a `RoomPricing` table sat unread. Rates are now
 * computed per night from RateRules, so the quote for a stay is the sum of its
 * nights rather than one flat price × N.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** The configured bounds. Falls back to safe defaults rather than going unguarded. */
  private async guardrails(tx?: Prisma.TransactionClient) {
    try {
      const s = await (tx ?? this.prisma).setting.findUnique({ where: { id: 'hotel' } });
      const floor = s ? Number(s.rateFloorMultiplier) : DEFAULT_FLOOR;
      const ceiling = s ? Number(s.rateCeilingMultiplier) : DEFAULT_CEILING;
      // A floor above the ceiling would make every rate nonsense; ignore the pair.
      if (!(floor > 0) || !(ceiling >= floor)) return { floor: DEFAULT_FLOOR, ceiling: DEFAULT_CEILING };
      return { floor, ceiling };
    } catch {
      return { floor: DEFAULT_FLOOR, ceiling: DEFAULT_CEILING };
    }
  }

  /** Rooms of a type sellable at all (active, not out of service). */
  private async capacityOf(roomTypeId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    return db.room.count({
      where: { roomTypeId, isActive: true, status: { notIn: ['MAINTENANCE', 'OUT_OF_ORDER', 'BLOCKED'] } },
    });
  }

  /** Reservations holding a room of this type on a given night. */
  private async heldOn(roomTypeId: string, night: Date, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const next = new Date(night.getTime() + MS_PER_DAY);
    // A stay covers a night when it starts on/before it and ends after it —
    // checkout day is not a night sold.
    return db.reservation.count({
      where: {
        roomTypeId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkInDate: { lt: next },
        checkOutDate: { gt: night },
      },
    });
  }

  private matches(rule: RateRule, night: Date, occupancy: number): boolean {
    if (rule.startDate && night < dayStart(rule.startDate)) return false;
    if (rule.endDate && night > dayStart(rule.endDate)) return false;
    if (rule.daysOfWeek.length && !rule.daysOfWeek.includes(night.getUTCDay())) return false;
    if (rule.minOccupancy !== null && occupancy < rule.minOccupancy) return false;
    if (rule.maxOccupancy !== null && occupancy > rule.maxOccupancy) return false;
    return true;
  }

  private apply(rate: number, rule: RateRule): number {
    const v = Number(rule.value);
    if (rule.adjustment === 'PERCENT') return rate * (1 + v / 100);
    if (rule.adjustment === 'AMOUNT') return rate + v;
    return v; // FIXED — this night costs exactly this
  }

  private loadRules(roomTypeId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).rateRule.findMany({
      where: { isActive: true, OR: [{ roomTypeId }, { roomTypeId: null }] },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Pure per-night computation given already-loaded rules/bounds/occupancy. */
  private computeNight(basePrice: number, night: Date, rules: RateRule[], bounds: { floor: number; ceiling: number }, occupancy: number): NightlyRate {
    const applied: NightlyRate['applied'] = [];
    let rate = basePrice;
    for (const rule of rules) {
      if (!this.matches(rule, night, occupancy)) continue;
      const from = money(rate);
      rate = this.apply(rate, rule);
      applied.push({ name: rule.name, adjustment: rule.adjustment, value: Number(rule.value), from, to: money(rate) });
    }
    const floor = basePrice * bounds.floor;
    const ceiling = basePrice * bounds.ceiling;
    let clamped: NightlyRate['clamped'];
    if (rate < floor) { rate = floor; clamped = 'FLOOR'; }
    if (rate > ceiling) { rate = ceiling; clamped = 'CEILING'; }
    return { date: night.toISOString().slice(0, 10), base: money(basePrice), rate: money(rate), occupancy, applied, ...(clamped ? { clamped } : {}) };
  }

  /** The rate for one night, and why. Standalone — fetches its own context. */
  async rateFor(roomTypeId: string, basePrice: number, night: Date, tx?: Prisma.TransactionClient): Promise<NightlyRate> {
    const rules = await this.loadRules(roomTypeId, tx);
    const bounds = await this.guardrails(tx);
    let occupancy = 0;
    if (rules.some((r) => r.minOccupancy !== null || r.maxOccupancy !== null)) {
      const [capacity, held] = await Promise.all([this.capacityOf(roomTypeId, tx), this.heldOn(roomTypeId, night, tx)]);
      occupancy = capacity ? Math.round((held / capacity) * 100) : 0;
    }
    return this.computeNight(basePrice, night, rules, bounds, occupancy);
  }

  /**
   * Price a whole stay, night by night.
   *
   * Rules, guardrails and capacity are fetched ONCE here rather than per night —
   * a multi-night quote used to re-run those queries for every night, and this
   * runs inside the booking transaction under the availability lock, so the extra
   * round-trips both slowed the booking and lengthened the lock hold. Only the
   * per-night demand count stays in the loop, and only when a rule needs it.
   */
  async quote(
    roomTypeId: string,
    basePrice: number,
    checkIn: string | Date,
    checkOut: string | Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Quote> {
    const start = dayStart(checkIn);
    const end = dayStart(checkOut);
    const nights = Math.max(0, Math.round((+end - +start) / MS_PER_DAY));
    if (!nights) return { nights: 0, total: 0, averageRate: 0, breakdown: [] };

    const rules = await this.loadRules(roomTypeId, tx);
    const bounds = await this.guardrails(tx);
    const needsDemand = rules.some((r) => r.minOccupancy !== null || r.maxOccupancy !== null);
    const capacity = needsDemand ? await this.capacityOf(roomTypeId, tx) : 0;

    const breakdown: NightlyRate[] = [];
    for (let i = 0; i < nights; i++) {
      const night = new Date(+start + i * MS_PER_DAY);
      let occupancy = 0;
      if (needsDemand) {
        const held = await this.heldOn(roomTypeId, night, tx);
        occupancy = capacity ? Math.round((held / capacity) * 100) : 0;
      }
      breakdown.push(this.computeNight(basePrice, night, rules, bounds, occupancy));
    }
    const total = money(breakdown.reduce((s, n) => s + n.rate, 0));
    return { nights, total, averageRate: nights ? money(total / nights) : 0, breakdown };
  }
}
