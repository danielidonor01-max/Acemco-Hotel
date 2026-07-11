import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;

/** Reservations in these states occupy inventory for their whole date span. */
const HOLDING: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];
/** Physical statuses that take a room out of the sellable pool regardless of dates. */
const OUT_OF_SERVICE: RoomStatus[] = ['MAINTENANCE', 'OUT_OF_ORDER', 'BLOCKED'];
/** A room in one of these can't be walked into today. */
const BLOCKED_FOR_CHECKIN: RoomStatus[] = ['OCCUPIED', ...OUT_OF_SERVICE];

/** Parse a YYYY-MM-DD (or ISO) string to a UTC-midnight Date, matching Prisma @db.Date semantics. */
const asDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** Start of today, UTC — matching Prisma @db.Date semantics. */
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Two spans overlap when each starts before the other ends. Half-open: check-out day is free. */
  overlapWhere(checkIn: Date, checkOut: Date): Prisma.ReservationWhereInput {
    return { status: { in: HOLDING }, checkInDate: { lt: checkOut }, checkOutDate: { gt: checkIn } };
  }

  static readonly BLOCKED_FOR_CHECKIN = BLOCKED_FOR_CHECKIN;

  /** Tonight (today → tomorrow, UTC) — the default span when a caller has no dates. */
  static tonight(): { checkIn: Date; checkOut: Date } {
    const checkIn = todayUtc();
    return { checkIn, checkOut: new Date(checkIn.getTime() + MS_PER_DAY) };
  }

  /**
   * Free-room COUNT for one type over a span. This is the single source of truth
   * every surface must agree on (public site, booking, calendar, check-in):
   *
   *   available = active rooms − genuinely out of service − overlapping holds
   *
   * Note what is NOT subtracted, and why: OCCUPIED is not a separate deduction
   * because a checked-in guest is already counted via their CHECKED_IN
   * reservation (subtracting both would double-count); CLEANING/INSPECTION are
   * housekeeping states, and a dirty room is still sellable — it just has to be
   * turned over before arrival. Only MAINTENANCE/OUT_OF_ORDER/BLOCKED remove a
   * room from the sellable pool outright.
   */
  async countForType(
    roomTypeId: string,
    checkIn: string | Date,
    checkOut: string | Date,
    excludeReservationId?: string,
  ): Promise<number> {
    const ci = asDate(checkIn);
    const co = asDate(checkOut);
    const [capacity, outOfService, held] = await Promise.all([
      this.prisma.room.count({ where: { roomTypeId, isActive: true } }),
      this.prisma.room.count({ where: { roomTypeId, isActive: true, status: { in: OUT_OF_SERVICE } } }),
      this.prisma.reservation.count({
        where: { roomTypeId, ...this.overlapWhere(ci, co), id: excludeReservationId ? { not: excludeReservationId } : undefined },
      }),
    ]);
    return Math.max(0, capacity - outOfService - held);
  }

  /** True if at least one room of the type is free for the whole span. */
  async isTypeAvailable(roomTypeId: string, checkIn: string | Date, checkOut: string | Date, excludeReservationId?: string): Promise<boolean> {
    return (await this.countForType(roomTypeId, checkIn, checkOut, excludeReservationId)) > 0;
  }

  /** Availability for every active room type over a date span (for the booking summary). */
  async byType(checkInStr: string, checkOutStr: string) {
    const checkIn = asDate(checkInStr);
    const checkOut = asDate(checkOutStr);
    const nights = Math.max(1, Math.round((+checkOut - +checkIn) / MS_PER_DAY));

    const [types, held, oos] = await Promise.all([
      this.prisma.roomType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { rooms: { where: { isActive: true } } } } },
      }),
      this.prisma.reservation.groupBy({ by: ['roomTypeId'], where: this.overlapWhere(checkIn, checkOut), _count: { _all: true } }),
      this.prisma.room.groupBy({ by: ['roomTypeId'], where: { isActive: true, status: { in: OUT_OF_SERVICE } }, _count: { _all: true } }),
    ]);
    const heldMap = new Map(held.map((h) => [h.roomTypeId, h._count._all]));
    const oosMap = new Map(oos.map((o) => [o.roomTypeId, o._count._all]));

    return types.map((t) => {
      const capacity = t._count.rooms;
      const heldCount = heldMap.get(t.id) ?? 0;
      const outOfService = oosMap.get(t.id) ?? 0;
      const available = Math.max(0, capacity - heldCount - outOfService);
      return {
        roomTypeId: t.id,
        slug: t.slug,
        name: t.name,
        basePrice: Number(t.basePrice),
        capacity,
        held: heldCount,
        outOfService,
        available,
        nights,
        totalPrice: Number(t.basePrice) * nights,
      };
    });
  }

  /** Physical rooms of a type, flagged assignable/not for a span (for the room-picker). */
  async rooms(roomTypeId: string, checkInStr: string | Date, checkOutStr: string | Date, excludeReservationId?: string) {
    const checkIn = asDate(checkInStr);
    const checkOut = asDate(checkOutStr);
    const [rooms, clashes] = await Promise.all([
      this.prisma.room.findMany({
        where: { roomTypeId, isActive: true },
        orderBy: { roomNumber: 'asc' },
        select: { id: true, roomNumber: true, floor: true, status: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          ...this.overlapWhere(checkIn, checkOut),
          roomId: { not: null },
          id: excludeReservationId ? { not: excludeReservationId } : undefined,
        },
        select: { roomId: true },
      }),
    ]);
    const taken = new Set(clashes.map((c) => c.roomId));
    return rooms.map((r) => {
      // A room can't be assigned if it's physically blocked (occupied / out of service)
      // or already held by another overlapping reservation — same rule check-in enforces.
      const physicallyBlocked = BLOCKED_FOR_CHECKIN.includes(r.status);
      const held = taken.has(r.id);
      return {
        id: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        status: r.status,
        assignable: !physicallyBlocked && !held,
        reason: physicallyBlocked ? r.status : held ? 'ASSIGNED' : null,
      };
    });
  }

  /** Per-type free-room count for each of the next `days` days (availability grid). */
  async calendar(days = 14) {
    const clamped = Math.min(60, Math.max(1, days));
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + clamped * MS_PER_DAY);

    const [types, oos, reservations] = await Promise.all([
      this.prisma.roomType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { rooms: { where: { isActive: true } } } } },
      }),
      this.prisma.room.groupBy({ by: ['roomTypeId'], where: { isActive: true, status: { in: OUT_OF_SERVICE } }, _count: { _all: true } }),
      this.prisma.reservation.findMany({
        where: { status: { in: HOLDING }, checkInDate: { lt: end }, checkOutDate: { gt: start } },
        select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
      }),
    ]);
    const oosMap = new Map(oos.map((o) => [o.roomTypeId, o._count._all]));
    const capacityOf = (t: (typeof types)[number]) => Math.max(0, t._count.rooms - (oosMap.get(t.id) ?? 0));

    const calendar = Array.from({ length: clamped }, (_, i) => {
      const day = new Date(start.getTime() + i * MS_PER_DAY);
      const dayNext = new Date(day.getTime() + MS_PER_DAY);
      const cells = types.map((t) => {
        const occupied = reservations.filter(
          (r) => r.roomTypeId === t.id && r.checkInDate < dayNext && r.checkOutDate > day,
        ).length;
        const capacity = capacityOf(t);
        return { roomTypeId: t.id, capacity, occupied, available: Math.max(0, capacity - occupied) };
      });
      return { date: day.toISOString().slice(0, 10), cells };
    });

    return {
      days: clamped,
      roomTypes: types.map((t) => ({ id: t.id, name: t.name, slug: t.slug, capacity: capacityOf(t) })),
      calendar,
    };
  }
}
