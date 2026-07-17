import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationsService } from '../reservations/reservations.service';

const MS_PER_DAY = 86_400_000;
const money = (n: number) => Math.round(n * 100) / 100;

/** Midnight-UTC Date for a YYYY-MM-DD string — matches Prisma @db.Date. */
const asDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

/**
 * The calendar date "now" in a given IANA zone.
 *
 * The hotel's day is not the server's day: Vercel runs in UTC, so at 00:30 in
 * Lagos it is still yesterday in UTC, and closing "today" would close the wrong
 * day. en-CA formats as YYYY-MM-DD.
 */
function localDate(tz: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  }
}

/** The hour (0–23) in a given zone. */
function localHour(tz: string, at = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(at));
  } catch {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(at));
  }
}

export interface CloseResult {
  businessDate: string;
  roomsAvailable: number;
  roomsSold: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  taxCollected: number;
  arrivals: number;
  departures: number;
  noShowsMarked: number;
  alreadyClosed?: boolean;
}

/**
 * Night audit — the end-of-day close a hotel runs to freeze its numbers.
 *
 * There was no scheduler of any kind: occupancy/ADR/RevPAR were only ever
 * computed live, so yesterday's figures silently changed as later edits landed
 * and there was nothing to reconcile a day's takings against. No-shows also had
 * to be marked by hand, so an un-arrived booking held a room indefinitely and its
 * fee was never charged.
 *
 * It is driven by an HTTP tick rather than an in-process @Cron because the API is
 * serverless: nothing stays resident between requests, so a timer registered at
 * boot would never fire. A Vercel cron pings /night-audit/tick hourly and this
 * decides whether the configured hour has arrived — which keeps the close time a
 * SETTING rather than something buried in vercel.json.
 */
@Injectable()
export class NightAuditService {
  private readonly logger = new Logger(NightAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
  ) {}

  private async config() {
    const s = await this.prisma.setting.findUnique({ where: { id: 'hotel' } });
    return {
      hour: s?.nightAuditHour ?? 3,
      enabled: s?.nightAuditEnabled ?? true,
      autoNoShows: s?.autoMarkNoShows ?? true,
      timezone: s?.timezone ?? 'Africa/Lagos',
    };
  }

  /** Current state, for the settings screen. */
  async status() {
    const cfg = await this.config();
    const today = localDate(cfg.timezone);
    const [lastClose, closedToday] = await Promise.all([
      this.prisma.dailyClose.findFirst({ orderBy: { businessDate: 'desc' } }),
      this.prisma.dailyClose.findUnique({ where: { businessDate: asDate(today) } }),
    ]);
    return {
      ...cfg,
      localTime: new Date().toLocaleString('en-GB', { timeZone: cfg.timezone }),
      today,
      closedToday: Boolean(closedToday),
      lastClose,
    };
  }

  /**
   * Called hourly by the cron. Runs the close only when the hotel's configured
   * hour has arrived and the day isn't already closed — so the schedule lives in
   * settings, not in the cron expression.
   */
  async tick(): Promise<{ ran: boolean; reason: string; result?: CloseResult }> {
    const cfg = await this.config();
    if (!cfg.enabled) return { ran: false, reason: 'Automatic close is switched off.' };

    const hour = localHour(cfg.timezone);
    if (hour !== cfg.hour) {
      return { ran: false, reason: `Not the close hour yet (local ${hour}:00, configured ${cfg.hour}:00 ${cfg.timezone}).` };
    }

    // Close the day that just ENDED. At 3am you are auditing yesterday.
    const business = localDate(cfg.timezone, new Date(Date.now() - MS_PER_DAY));
    const existing = await this.prisma.dailyClose.findUnique({ where: { businessDate: asDate(business) } });
    if (existing) return { ran: false, reason: `${business} is already closed.` };

    const result = await this.close(business);
    this.logger.log(`Night audit closed ${business}: ${result.roomsSold} sold, ₦${result.totalRevenue} revenue, ${result.noShowsMarked} no-show(s).`);
    return { ran: true, reason: `Closed ${business}.`, result };
  }

  /**
   * Close one business day and freeze its figures.
   *
   * Idempotent by construction: businessDate is unique, so a retrying cron (or a
   * manager pressing the button twice) can't double-close or double-charge the
   * no-show fees.
   */
  async close(businessDate: string, userId?: string): Promise<CloseResult> {
    const cfg = await this.config();
    const day = asDate(businessDate);
    const next = new Date(+day + MS_PER_DAY);

    if (await this.prisma.dailyClose.findUnique({ where: { businessDate: day } })) {
      throw new ConflictException({ code: 'ALREADY_CLOSED', message: `${businessDate} has already been closed.` });
    }

    // 1. No-shows: confirmed for that day, never checked in. Marking them releases
    //    the room and charges the no-show fee through the cancellation policy.
    let noShowsMarked = 0;
    if (cfg.autoNoShows) {
      const stragglers = await this.prisma.reservation.findMany({
        where: { status: 'CONFIRMED', checkInDate: { gte: day, lt: next } },
        select: { id: true },
      });
      for (const s of stragglers) {
        try {
          await this.reservations.noShow(s.id);
          noShowsMarked++;
        } catch (e) {
          // One bad reservation must not abort the close — the day still needs its
          // numbers frozen. Surface it instead of swallowing it.
          this.logger.error(`Night audit could not mark ${s.id} as no-show: ${(e as Error).message}`);
        }
      }
    }

    // 2. Freeze the numbers, from the ledger.
    const [roomsAvailable, sold, charges, arrivals, departures] = await Promise.all([
      this.prisma.room.count({ where: { isActive: true, status: { notIn: ['MAINTENANCE', 'OUT_OF_ORDER', 'BLOCKED'] } } }),
      // A stay occupies that night when it starts on/before it and ends after it.
      this.prisma.reservation.count({
        where: { status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkInDate: { lt: next }, checkOutDate: { gt: day } },
      }),
      this.prisma.chargeLedger.findMany({
        where: { status: { not: 'VOIDED' }, date: { gte: day, lt: next } },
        select: { department: true, amount: true, tax: true },
      }),
      this.prisma.reservation.count({ where: { checkInDate: { gte: day, lt: next }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] } } }),
      this.prisma.reservation.count({ where: { checkOutDate: { gte: day, lt: next }, status: 'CHECKED_OUT' } }),
    ]);

    const sum = (pred: (d: string) => boolean) =>
      money(charges.filter((c) => pred(c.department)).reduce((s, c) => s + Number(c.amount), 0));
    const roomRevenue = sum((d) => d === 'ROOM');
    const fbRevenue = sum((d) => d === 'RESTAURANT' || d === 'LOUNGE');
    const otherRevenue = sum((d) => !['ROOM', 'RESTAURANT', 'LOUNGE'].includes(d));
    const totalRevenue = money(roomRevenue + fbRevenue + otherRevenue);
    const taxCollected = money(charges.reduce((s, c) => s + Number(c.tax), 0));

    const occupancyRate = roomsAvailable ? money((sold / roomsAvailable) * 100) : 0;
    const adr = sold ? money(roomRevenue / sold) : 0;
    const revpar = roomsAvailable ? money(roomRevenue / roomsAvailable) : 0;

    await this.prisma.dailyClose.create({
      data: {
        businessDate: day,
        roomsAvailable, roomsSold: sold, occupancyRate, adr, revpar,
        roomRevenue, fbRevenue, otherRevenue, totalRevenue, taxCollected,
        arrivals, departures, noShowsMarked,
        closedByUserId: userId ?? null,
      },
    });

    return {
      businessDate, roomsAvailable, roomsSold: sold, occupancyRate, adr, revpar,
      roomRevenue, fbRevenue, otherRevenue, totalRevenue, taxCollected,
      arrivals, departures, noShowsMarked,
    };
  }

  history(limit = 30) {
    return this.prisma.dailyClose.findMany({ orderBy: { businessDate: 'desc' }, take: Math.min(limit, 90) });
  }
}
