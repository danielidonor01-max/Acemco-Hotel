import { PricingService } from '../src/modules/pricing/pricing.service';
import { PrismaService } from '../src/prisma/prisma.service';

type RuleSeed = Partial<{
  name: string;
  roomTypeId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  daysOfWeek: number[];
  minOccupancy: number | null;
  maxOccupancy: number | null;
  adjustment: 'PERCENT' | 'AMOUNT' | 'FIXED';
  value: number;
  priority: number;
}>;

/**
 * The rate engine decides what guests are charged, so its arithmetic — and its
 * refusal to produce an absurd number — is pinned down here.
 */
describe('PricingService', () => {
  const svc = (rules: RuleSeed[], opts: { capacity?: number; held?: number; floor?: number; ceiling?: number } = {}) => {
    const prisma = {
      setting: {
        findUnique: async () =>
          opts.floor !== undefined || opts.ceiling !== undefined
            ? { id: 'hotel', rateFloorMultiplier: opts.floor ?? 0.5, rateCeilingMultiplier: opts.ceiling ?? 3 }
            : null,
      },
      rateRule: {
        findMany: async () =>
          rules.map((r, i) => ({
            id: String(i),
            name: r.name ?? `rule-${i}`,
            roomTypeId: r.roomTypeId ?? null,
            startDate: r.startDate ?? null,
            endDate: r.endDate ?? null,
            daysOfWeek: r.daysOfWeek ?? [],
            minOccupancy: r.minOccupancy ?? null,
            maxOccupancy: r.maxOccupancy ?? null,
            adjustment: r.adjustment ?? 'PERCENT',
            value: r.value ?? 0,
            priority: r.priority ?? i,
            isActive: true,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          })),
      },
      room: { count: async () => opts.capacity ?? 10 },
      reservation: { count: async () => opts.held ?? 0 },
    } as unknown as PrismaService;
    return new PricingService(prisma);
  };

  const BASE = 65000;
  // 2026-07-18 is a Saturday; 2026-07-21 is a Tuesday.
  const SAT = new Date('2026-07-18T00:00:00Z');
  const TUE = new Date('2026-07-21T00:00:00Z');

  it('sells at base when no rule applies', async () => {
    const r = await svc([]).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(BASE);
    expect(r.applied).toEqual([]);
  });

  it('applies a weekend uplift only on the matching weekday', async () => {
    const rules: RuleSeed[] = [{ name: 'Weekend', daysOfWeek: [5, 6], adjustment: 'PERCENT', value: 10 }];
    expect((await svc(rules).rateFor('t', BASE, SAT)).rate).toBe(71500); // +10%
    expect((await svc(rules).rateFor('t', BASE, TUE)).rate).toBe(BASE); // Tuesday untouched
  });

  it('applies a season only inside its window', async () => {
    const rules: RuleSeed[] = [{
      name: 'Festive', startDate: new Date('2026-12-20'), endDate: new Date('2027-01-05'),
      adjustment: 'PERCENT', value: 25,
    }];
    expect((await svc(rules).rateFor('t', BASE, new Date('2026-12-24T00:00:00Z'))).rate).toBe(81250);
    expect((await svc(rules).rateFor('t', BASE, new Date('2026-11-24T00:00:00Z'))).rate).toBe(BASE);
  });

  it('moves with demand — the rate follows the traffic', async () => {
    const rules: RuleSeed[] = [{ name: 'High demand', minOccupancy: 70, adjustment: 'PERCENT', value: 20 }];
    // 8 of 10 held → 80% → rule fires.
    const busy = await svc(rules, { capacity: 10, held: 8 }).rateFor('t', BASE, TUE);
    expect(busy.occupancy).toBe(80);
    expect(busy.rate).toBe(78000);
    // 2 of 10 → 20% → no uplift.
    const quiet = await svc(rules, { capacity: 10, held: 2 }).rateFor('t', BASE, TUE);
    expect(quiet.occupancy).toBe(20);
    expect(quiet.rate).toBe(BASE);
  });

  it('discounts a quiet night via an upper demand bound', async () => {
    const rules: RuleSeed[] = [{ name: 'Fill the house', maxOccupancy: 30, adjustment: 'PERCENT', value: -10 }];
    const r = await svc(rules, { capacity: 10, held: 1 }).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(58500);
  });

  it('stacks rules in priority order', async () => {
    // +10% then +5,000 = 76,500. The reverse order would give 77,000 — order matters.
    const rules: RuleSeed[] = [
      { name: 'Weekend', priority: 0, adjustment: 'PERCENT', value: 10 },
      { name: 'Surcharge', priority: 1, adjustment: 'AMOUNT', value: 5000 },
    ];
    const r = await svc(rules).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(76500);
    expect(r.applied.map((a) => a.name)).toEqual(['Weekend', 'Surcharge']);
  });

  it('FIXED overrides whatever came before it', async () => {
    const rules: RuleSeed[] = [
      { name: 'Uplift', priority: 0, adjustment: 'PERCENT', value: 50 },
      { name: 'Corporate flat', priority: 1, adjustment: 'FIXED', value: 80000 },
    ];
    expect((await svc(rules).rateFor('t', BASE, TUE)).rate).toBe(80000);
  });

  it('refuses to quote an absurd price — ceiling guard', async () => {
    // A mis-keyed +500% would quote 390,000 for a 65,000 room.
    const r = await svc([{ name: 'Typo', adjustment: 'PERCENT', value: 500 }]).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(BASE * 3);
    expect(r.clamped).toBe('CEILING');
  });

  it('refuses to give the room away — floor guard', async () => {
    const r = await svc([{ name: 'Typo', adjustment: 'PERCENT', value: -90 }]).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(BASE * 0.5);
    expect(r.clamped).toBe('FLOOR');
  });

  it('honours the guardrails configured in Settings, not a constant', async () => {
    // A hotel that allows a 2x ceiling must be clamped at 2x, not the 3x default.
    const r = await svc([{ name: 'Big uplift', adjustment: 'PERCENT', value: 500 }], { ceiling: 2 }).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(BASE * 2);
    expect(r.clamped).toBe('CEILING');
  });

  it('ignores a nonsensical guardrail pair rather than pricing unguarded', async () => {
    // floor above ceiling would make every rate nonsense — fall back to safe defaults.
    const r = await svc([{ name: 'Typo', adjustment: 'PERCENT', value: 500 }], { floor: 5, ceiling: 1 }).rateFor('t', BASE, TUE);
    expect(r.rate).toBe(BASE * 3);
  });

  it('prices a stay night by night, not one flat rate x N', async () => {
    // Fri 17th + Sat 18th (uplifted) + Sun 19th → checkout Mon 20th.
    const rules: RuleSeed[] = [{ name: 'Weekend', daysOfWeek: [5, 6], adjustment: 'PERCENT', value: 10 }];
    const q = await svc(rules).quote('t', BASE, '2026-07-17', '2026-07-20');
    expect(q.nights).toBe(3);
    // Fri 71,500 + Sat 71,500 + Sun 65,000
    expect(q.total).toBe(208000);
    expect(q.averageRate).toBe(69333.33);
    expect(q.breakdown.map((b) => b.rate)).toEqual([71500, 71500, 65000]);
  });

  it('does not charge for the checkout day', async () => {
    const q = await svc([]).quote('t', BASE, '2026-07-17', '2026-07-18');
    expect(q.nights).toBe(1);
    expect(q.total).toBe(BASE);
  });

  it('explains every adjustment, so a rate can be defended to a guest', async () => {
    const r = await svc([{ name: 'Weekend', daysOfWeek: [6], adjustment: 'PERCENT', value: 10 }]).rateFor('t', BASE, SAT);
    expect(r.applied).toEqual([{ name: 'Weekend', adjustment: 'PERCENT', value: 10, from: 65000, to: 71500 }]);
  });
});
