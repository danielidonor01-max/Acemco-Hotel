import { TaxService } from '../src/modules/tax/tax.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tax is money, so the arithmetic is pinned down here. The bug these guard against:
 * the till displayed subtotal + 7.5% while the ledger recorded 0, so the drawer and
 * the books disagreed on every sale.
 */
describe('TaxService.computeFor', () => {
  const svc = (rates: Partial<{ code: string; name: string; rate: number; isInclusive: boolean }>[]) => {
    const prisma = {
      taxRate: {
        findMany: async () =>
          rates.map((r, i) => ({
            id: String(i),
            code: r.code ?? 'VAT',
            name: r.name ?? 'VAT',
            rate: r.rate ?? 7.5,
            isInclusive: r.isInclusive ?? false,
            isActive: true,
            appliesTo: ['RESTAURANT'],
            sortOrder: i,
          })),
      },
    } as unknown as PrismaService;
    return new TaxService(prisma);
  };

  it('adds an exclusive rate on top of the listed price', async () => {
    // The real case: Pepper Soup x2 = 13,000 + 7.5% VAT = 13,975.
    const r = await svc([{ rate: 7.5 }]).computeFor('RESTAURANT', 13000);
    expect(r.net).toBe(13000);
    expect(r.tax).toBe(975);
    expect(r.gross).toBe(13975);
    expect(r.lines).toEqual([{ code: 'VAT', name: 'VAT', rate: 7.5, amount: 975 }]);
  });

  it('backs an inclusive rate out of the listed price without changing what the guest pays', async () => {
    const r = await svc([{ rate: 7.5, isInclusive: true }]).computeFor('RESTAURANT', 13000);
    expect(r.gross).toBe(13000); // guest total must not move
    expect(r.net).toBe(12093.02);
    expect(r.tax).toBe(906.98);
    expect(Math.round((r.net + r.tax) * 100) / 100).toBe(13000);
  });

  it('returns zero tax when no rate applies to the department', async () => {
    const r = await svc([]).computeFor('OTHER', 5000);
    expect(r).toEqual({ net: 5000, tax: 0, gross: 5000, lines: [] });
  });

  it('taxes a credit proportionally, so a refund mirrors its charge', async () => {
    const r = await svc([{ rate: 7.5 }]).computeFor('RESTAURANT', -13000);
    expect(r.tax).toBe(-975);
    expect(r.gross).toBe(-13975);
  });

  it('sums multiple exclusive levies against the same net', async () => {
    // e.g. VAT 7.5% + a 5% state consumption tax, both on the pre-tax amount.
    const r = await svc([
      { code: 'VAT', rate: 7.5 },
      { code: 'CONS', name: 'Consumption Tax', rate: 5 },
    ]).computeFor('RESTAURANT', 10000);
    expect(r.tax).toBe(1250);
    expect(r.gross).toBe(11250);
    expect(r.lines.map((l) => l.amount)).toEqual([750, 500]);
  });

  it('rounds to kobo — no float dust reaches the ledger', async () => {
    const r = await svc([{ rate: 7.5 }]).computeFor('RESTAURANT', 333.33);
    expect(r.tax).toBe(25);
    expect(Number.isInteger(Math.round(r.gross * 100))).toBe(true);
  });

  it('handles a zero-amount charge', async () => {
    const r = await svc([{ rate: 7.5 }]).computeFor('RESTAURANT', 0);
    expect(r).toEqual({ net: 0, tax: 0, gross: 0, lines: [] });
  });
});
