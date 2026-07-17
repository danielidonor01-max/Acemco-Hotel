import { CashService } from '../src/modules/cash/cash.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The over/short is the number a manager relies on to trust a drawer. Its
 * arithmetic is pinned here: expected = float + cash in − cash out, and
 * over/short = counted − expected. Card/transfer must NOT move the drawer.
 */
describe('CashService — reconciliation', () => {
  // Build a service whose prisma returns a given shift + movement set.
  const svc = (openingFloat: number, movements: { direction: 'IN' | 'OUT'; method: string; amount: number }[]) => {
    const shift = { id: 's1', openingFloat, status: 'OPEN', station: 'RECEPTION' };
    let closed: any = null;
    const prisma = {
      cashShift: {
        findUnique: async () => shift,
        update: async ({ data }: any) => { closed = { ...shift, ...data }; return closed; },
      },
      cashMovement: {
        findMany: async () => movements.map((m, i) => ({ id: String(i), ...m, amount: m.amount })),
      },
    } as unknown as PrismaService;
    return { service: new CashService(prisma), getClosed: () => closed };
  };

  it('expected = float + cash in − cash out; balanced drawer is zero variance', async () => {
    const { service, getClosed } = svc(20_000, [
      { direction: 'IN', method: 'CASH', amount: 50_000 },
      { direction: 'IN', method: 'CASH', amount: 15_000 },
      { direction: 'OUT', method: 'CASH', amount: 5_000 },
    ]);
    // expected = 20,000 + 65,000 − 5,000 = 80,000
    await service.closeShift('s1', 80_000, 'u1');
    const c = getClosed();
    expect(Number(c.expectedCash)).toBe(80_000);
    expect(Number(c.overShort)).toBe(0);
  });

  it('flags a SHORT drawer (counted less than expected)', async () => {
    const { service, getClosed } = svc(20_000, [{ direction: 'IN', method: 'CASH', amount: 50_000 }]);
    // expected 70,000, counted 68,500 → short 1,500
    await service.closeShift('s1', 68_500, 'u1');
    expect(Number(getClosed().overShort)).toBe(-1_500);
  });

  it('flags an OVER drawer (counted more than expected)', async () => {
    const { service, getClosed } = svc(20_000, [{ direction: 'IN', method: 'CASH', amount: 50_000 }]);
    await service.closeShift('s1', 72_000, 'u1');
    expect(Number(getClosed().overShort)).toBe(2_000);
  });

  it('ignores card and transfer — they never touch the drawer', async () => {
    const { service, getClosed } = svc(20_000, [
      { direction: 'IN', method: 'CASH', amount: 30_000 },
      { direction: 'IN', method: 'CARD', amount: 100_000 },
      { direction: 'IN', method: 'TRANSFER', amount: 40_000 },
    ]);
    // Only the 30,000 cash counts: expected = 50,000, not 190,000.
    await service.closeShift('s1', 50_000, 'u1');
    expect(Number(getClosed().expectedCash)).toBe(50_000);
    expect(Number(getClosed().overShort)).toBe(0);
  });

  it('nets a cash payout (petty cash) out of the drawer', async () => {
    const { service, getClosed } = svc(20_000, [
      { direction: 'IN', method: 'CASH', amount: 50_000 },
      { direction: 'OUT', method: 'CASH', amount: 8_000 }, // paid a supplier from the till
    ]);
    await service.closeShift('s1', 62_000, 'u1');
    expect(Number(getClosed().expectedCash)).toBe(62_000);
    expect(Number(getClosed().overShort)).toBe(0);
  });

  it('an empty shift expects exactly its float back', async () => {
    const { service, getClosed } = svc(15_000, []);
    await service.closeShift('s1', 15_000, 'u1');
    expect(Number(getClosed().expectedCash)).toBe(15_000);
    expect(Number(getClosed().overShort)).toBe(0);
  });

  it('rounds to kobo', async () => {
    const { service, getClosed } = svc(10_000.5, [{ direction: 'IN', method: 'CASH', amount: 6_499.5 }]);
    await service.closeShift('s1', 16_500, 'u1');
    expect(Number(getClosed().expectedCash)).toBe(16_500);
    expect(Number(getClosed().overShort)).toBe(0);
  });
});
