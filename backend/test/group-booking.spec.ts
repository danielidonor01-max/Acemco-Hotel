import { GroupService } from '../src/modules/reservations/group.service';

/**
 * The load-bearing property of a group booking: it is all-or-nothing, and it
 * cannot oversell against itself. If the 3rd of 3 rooms can't be placed, the
 * whole group must roll back — no orphaned rooms 1 and 2.
 *
 * These drive the transaction body with fakes to prove the control flow, since
 * the real value is in "does it stop and throw at the right point", not in Prisma.
 */
describe('GroupService.create — atomicity', () => {
  // Build a service with a fake tx that tracks created reservations and a
  // per-type availability oracle.
  const build = (freeByType: Record<string, number>) => {
    const created: any[] = [];
    // held-in-this-tx count per type, so isTypeAvailable can reflect our own holds.
    const heldInTx: Record<string, number> = {};

    const tx = {
      guest: { findFirst: async () => null, create: async ({ data }: any) => ({ id: 'g1', ...data }), update: async ({ data }: any) => ({ id: 'g1', ...data }) },
      bookingGroup: { count: async () => 0, create: async ({ data }: any) => ({ id: 'grp1', ...data }) },
      reservation: {
        count: async () => created.length,
        create: async ({ data }: any) => { created.push(data); heldInTx[data.roomTypeId] = (heldInTx[data.roomTypeId] ?? 0) + 1; return data; },
      },
    };

    const prisma = {
      company: { findUnique: async () => ({ id: 'c1' }) },
      roomType: { findMany: async () => Object.keys(freeByType).map((slug) => ({ id: slug, slug, name: slug, basePrice: 50000 })) },
      $transaction: async (fn: any) => fn(tx),
    };

    const availability = {
      lockBookings: async () => undefined,
      // free if the type's capacity minus what this tx has already held is > 0.
      isTypeAvailable: async (typeId: string) => (freeByType[typeId] ?? 0) - (heldInTx[typeId] ?? 0) > 0,
    };
    const pricing = { quote: async () => ({ total: 50000 }) };

    const svc = new GroupService(prisma as any, availability as any, pricing as any, {} as any, {} as any, {} as any);
    return { svc, created };
  };

  const organiser = { firstName: 'Ada', lastName: 'O', phone: '08030000000' };
  const room = (slug: string, ci = '2026-08-01', co = '2026-08-03') => ({ roomTypeSlug: slug, checkInDate: ci, checkOutDate: co, adults: 1, children: 0 });

  it('books every room when all fit', async () => {
    const { svc, created } = build({ 'deluxe-king': 5 });
    const res = await svc.create({ name: 'Wedding', organiser, rooms: [room('deluxe-king'), room('deluxe-king'), room('deluxe-king')] } as any, 'u1');
    expect(res.rooms).toBe(3);
    expect(created).toHaveLength(3);
  });

  it('counts the group\'s own holds — 3 rooms need 3 free, not just 1', async () => {
    // Only 2 free but the group wants 3 → must fail on the 3rd.
    const { svc, created } = build({ 'deluxe-king': 2 });
    await expect(svc.create({ name: 'Party', organiser, rooms: [room('deluxe-king'), room('deluxe-king'), room('deluxe-king')] } as any, 'u1')).rejects.toThrow(/NO_AVAILABILITY|not enough/i);
    // The throw aborts the transaction — in production nothing commits. Here we at
    // least prove it stopped before creating the impossible 3rd room.
    expect(created.length).toBeLessThan(3);
  });

  it('mixes room types and checks each against its own availability', async () => {
    const { svc, created } = build({ 'deluxe-king': 1, 'twin-classic': 1 });
    const res = await svc.create({ name: 'Mixed', organiser, rooms: [room('deluxe-king'), room('twin-classic')] } as any, 'u1');
    expect(res.rooms).toBe(2);
    expect(created.map((r) => r.roomTypeId).sort()).toEqual(['deluxe-king', 'twin-classic']);
  });

  it('rejects a second room of a type that only had one free', async () => {
    const { svc } = build({ 'twin-classic': 1 });
    await expect(svc.create({ name: 'Two twins', organiser, rooms: [room('twin-classic'), room('twin-classic')] } as any, 'u1')).rejects.toThrow();
  });

  it('sums the group total across rooms', async () => {
    const { svc } = build({ 'deluxe-king': 5 });
    const res = await svc.create({ name: 'Block', organiser, rooms: [room('deluxe-king'), room('deluxe-king')] } as any, 'u1');
    expect(res.total).toBe(100000); // 2 × 50,000
  });
});
