import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { AvailabilityService } from '../availability/availability.service';

const MS_PER_DAY = 86_400_000;
const nightsBetween = (a: Date, b: Date) => Math.max(0, Math.round((+new Date(b) - +new Date(a)) / MS_PER_DAY));
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Nights of a stay that fall inside [from, to) — a long stay only counts its overlap. */
const nightsInWindow = (checkIn: Date, checkOut: Date, from: Date, to: Date) => {
  const start = +checkIn > +from ? checkIn : from;
  const end = +checkOut < +to ? checkOut : to;
  return nightsBetween(start, end);
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly availability: AvailabilityService,
  ) {}

  /** The reception "morning brief": today's arrivals & departures, tonight's availability, occupancy and action items. */
  async brief() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + MS_PER_DAY);

    const guestSelect = { id: true, firstName: true, lastName: true, isVip: true, tier: true, isBlacklisted: true } as const;
    const [arrivalsRaw, departuresRaw, inHouse, pending, inventory, openWorkOrders, activeHousekeeping, availabilityTonight, occ] =
      await Promise.all([
        this.prisma.reservation.findMany({
          where: { checkInDate: { gte: start, lt: end }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
          include: { guest: { select: guestSelect }, roomType: { select: { name: true } }, room: { select: { roomNumber: true } } },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.reservation.findMany({
          // Due to depart today, plus any still in-house past their checkout (overdue).
          where: { checkOutDate: { lt: end }, status: 'CHECKED_IN' },
          include: { guest: { select: guestSelect }, roomType: { select: { name: true } }, room: { select: { roomNumber: true } } },
          orderBy: { checkOutDate: 'asc' },
        }),
        this.prisma.reservation.count({ where: { status: 'CHECKED_IN' } }),
        this.prisma.reservation.count({ where: { status: 'PENDING' } }),
        this.prisma.inventoryItem.findMany({ select: { currentQty: true, minStockLevel: true } }),
        this.prisma.workOrder.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        this.prisma.housekeepingTask.count({ where: { status: { not: 'COMPLETED' } } }),
        this.availability.byType(iso(start), iso(end)),
        this.occupancy(30),
      ]);

    // Outstanding balances for departures, straight from the ledger.
    const depIds = departuresRaw.map((d) => d.id);
    const depCharges = depIds.length
      ? await this.prisma.chargeLedger.findMany({ where: { reservationId: { in: depIds }, status: { not: 'VOIDED' } }, select: { reservationId: true, amount: true, tax: true } })
      : [];
    const balanceOf = new Map<string, number>();
    for (const c of depCharges) {
      if (!c.reservationId) continue;
      balanceOf.set(c.reservationId, (balanceOf.get(c.reservationId) ?? 0) + Number(c.amount) + Number(c.tax));
    }

    const name = (g: { firstName: string; lastName: string } | null) => (g ? `${g.firstName} ${g.lastName}` : '—');
    const arrivals = arrivalsRaw.map((r) => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      guestName: name(r.guest),
      roomType: r.roomType?.name ?? '—',
      guests: r.adults + r.children,
      vip: r.guest?.tier === 'VIP' || !!r.guest?.isVip,
      blacklisted: !!r.guest?.isBlacklisted,
      checkedIn: r.status === 'CHECKED_IN',
      roomNumber: r.room?.roomNumber ?? null,
      roomAssigned: !!r.roomId,
    }));
    const departures = departuresRaw.map((r) => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      guestName: name(r.guest),
      roomNumber: r.room?.roomNumber ?? null,
      vip: r.guest?.tier === 'VIP' || !!r.guest?.isVip,
      overdue: r.checkOutDate < start,
      balance: balanceOf.get(r.id) ?? Number(r.totalAmount),
    }));

    return {
      date: iso(start),
      inHouse,
      arrivals,
      departures,
      availabilityTonight: availabilityTonight.map((t) => ({ name: t.name, slug: t.slug, available: t.available, capacity: t.capacity })),
      occupancy: {
        currentOccupancy: occ.currentOccupancy,
        occupancyRate: occ.occupancyRate,
        adr: occ.adr,
        revpar: occ.revpar,
        occupied: occ.occupied,
        totalRooms: occ.totalRooms,
      },
      alerts: {
        pendingReservations: pending,
        unassignedArrivals: arrivals.filter((a) => !a.checkedIn && !a.roomAssigned).length,
        blacklistedArrivals: arrivals.filter((a) => a.blacklisted).length,
        overdueCheckouts: departures.filter((d) => d.overdue).length,
        lowStock: inventory.filter((i) => i.currentQty < i.minStockLevel).length,
        openWorkOrders,
        activeHousekeeping,
      },
    };
  }

  /**
   * Rooms occupied right now — derived from the reservation ledger, not the
   * `room.status` column. Counting `status: 'OCCUPIED'` made the room table a
   * second source of truth that could drift from the bookings (exactly the bug
   * that made a maintenance-flagged room vanish from availability with nothing
   * booked behind it). A room is occupied iff a CHECKED_IN reservation holds it.
   */
  private occupiedNow() {
    return this.prisma.reservation.count({ where: { status: 'CHECKED_IN' } });
  }

  /** Occupancy, ADR and RevPAR over a trailing window, from reservations + ledger. */
  async occupancy(days = 30) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const until = new Date(since);
    until.setDate(since.getDate() + days); // exclusive end of the window

    const [totalRooms, occupied, statusGroups, stays, roomCharges] = await Promise.all([
      this.prisma.room.count({ where: { isActive: true } }),
      this.occupiedNow(),
      this.prisma.room.groupBy({ by: ['status'], where: { isActive: true }, _count: { _all: true } }),
      this.prisma.reservation.findMany({
        where: { status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, checkOutDate: { gte: since }, checkInDate: { lt: until } },
        select: { checkInDate: true, checkOutDate: true },
      }),
      this.prisma.chargeLedger.findMany({
        where: { department: 'ROOM', status: { not: 'VOIDED' }, date: { gte: since } },
        select: { amount: true },
      }),
    ]);

    // Count only the nights that fall INSIDE the window. Summing each stay's full
    // length counted nights from before `since` against a window that never offered
    // them, inflating occupancyRate and ADR for any stay straddling the boundary.
    const roomNights = stays.reduce((s, r) => s + nightsInWindow(r.checkInDate, r.checkOutDate, since, until), 0);
    const roomRevenue = roomCharges.reduce((s, c) => s + Number(c.amount), 0);
    const availableNights = totalRooms * days;
    return {
      days,
      totalRooms,
      occupied,
      currentOccupancy: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
      occupancyRate: availableNights ? Math.round((roomNights / availableNights) * 100) : 0,
      roomNights,
      roomRevenue,
      adr: roomNights ? Math.round(roomRevenue / roomNights) : 0,
      revpar: availableNights ? Math.round(roomRevenue / availableNights) : 0,
      statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })).sort((a, b) => b.count - a.count),
    };
  }

  async stats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [totalRooms, occupied, arrivalsToday, departuresToday, pendingReservations, inventory, workOrders, activeHousekeeping, summary] =
      await Promise.all([
        this.prisma.room.count({ where: { isActive: true } }),
        this.occupiedNow(),
        this.prisma.reservation.count({ where: { checkInDate: { gte: startOfToday, lt: endOfToday }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
        this.prisma.reservation.count({ where: { checkOutDate: { gte: startOfToday, lt: endOfToday }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] } } }),
        this.prisma.reservation.count({ where: { status: 'PENDING' } }),
        this.prisma.inventoryItem.findMany({ select: { currentQty: true, minStockLevel: true } }),
        this.prisma.workOrder.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        this.prisma.housekeepingTask.count({ where: { status: { not: 'COMPLETED' } } }),
        this.finance.summary(),
      ]);

    return {
      occupancyRate: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
      revenueToday: summary.revenue,
      arrivalsToday,
      departuresToday,
      pendingReservations,
      lowStockAlerts: inventory.filter((i) => i.currentQty < i.minStockLevel).length,
      openWorkOrders: workOrders,
      activeHousekeeping,
    };
  }

  async reportsOverview() {
    const [rooms, occupied, inventory, payroll, workOrders, summary] = await Promise.all([
      this.prisma.room.count({ where: { isActive: true } }),
      this.occupiedNow(),
      this.prisma.inventoryItem.findMany(),
      this.prisma.payrollPeriod.findMany({ orderBy: { startDate: 'desc' }, take: 1 }),
      this.prisma.workOrder.findMany(),
      this.finance.summary(),
    ]);

    const inventoryValuation = inventory.reduce((s, i) => s + i.currentQty * Number(i.unitCost), 0);
    const workOrderSpend = workOrders.reduce((s, w) => s + Number(w.estimatedCost), 0);

    return {
      occupancyRate: rooms ? Math.round((occupied / rooms) * 100) : 0,
      revenueByAccount: summary.byAccount,
      totalRevenue: summary.revenue,
      totalExpense: summary.expense + summary.payroll,
      netPosition: summary.net,
      inventoryValuation,
      latestPayroll: payroll[0] ? { periodName: payroll[0].periodName, totalGross: Number(payroll[0].totalGross), totalNet: Number(payroll[0].totalNet), headcount: payroll[0].headcount } : null,
      workOrderSpend,
    };
  }
}
