import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** A guest summary attached to a room from the reservation ledger. */
export interface ReservationSummary {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  isVip: boolean;
  roomAssigned: boolean;
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all rooms, annotated with current occupant and nearest upcoming confirmed reservation. */
  async listRooms(status?: RoomStatus) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const rooms = await this.prisma.room.findMany({
      where: { ...(status ? { status } : {}), isActive: true },
      include: {
        roomType: { select: { name: true, slug: true } },
        reservations: {
          where: { status: { in: ['CHECKED_IN', 'CONFIRMED'] } },
          orderBy: { checkInDate: 'asc' },
          take: 2,
          include: { guest: { select: { firstName: true, lastName: true, phone: true, isVip: true } } },
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    return rooms.map((r) => {
      const checkedIn = r.reservations.find((res) => res.status === 'CHECKED_IN');
      const upcoming = r.reservations.find(
        (res) => res.status === 'CONFIRMED' && new Date(res.checkInDate) >= today,
      );

      // Dynamic status: if room is physically AVAILABLE but has a same-day arrival, surface as RESERVED.
      const effectiveStatus: RoomStatus =
        r.status === 'AVAILABLE' && upcoming && new Date(upcoming.checkInDate) < tomorrow
          ? 'RESERVED'
          : r.status;

      const toSummary = (res: typeof checkedIn): ReservationSummary | null =>
        res
          ? {
              id: res.id,
              reservationNumber: res.reservationNumber,
              guestName: `${res.guest.firstName} ${res.guest.lastName}`,
              guestPhone: res.guest.phone,
              checkInDate: res.checkInDate.toISOString().slice(0, 10),
              checkOutDate: res.checkOutDate.toISOString().slice(0, 10),
              isVip: res.guest.isVip,
              roomAssigned: !!res.roomId,
            }
          : null;

      return {
        id: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        status: effectiveStatus,
        physicalStatus: r.status,
        roomType: { name: r.roomType?.name ?? null, slug: r.roomType?.slug ?? null },
        currentReservation: toSummary(checkedIn),
        upcomingReservation: toSummary(upcoming),
      };
    });
  }

  async getRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, include: { roomType: true } });
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
    return room;
  }

  /** Full picture of a room: occupant, upcoming arrivals, unassigned arrivals, housekeeping, assets + open maintenance. */
  async getRoomDetail(id: string) {
    const room = await this.getRoom(id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [reservation, assignedUpcoming, unassignedArrivals, housekeeping, assets] = await Promise.all([
      // Current occupant
      this.prisma.reservation.findFirst({
        where: { roomId: id, status: 'CHECKED_IN' },
        orderBy: { checkInDate: 'desc' },
        include: { guest: { select: { firstName: true, lastName: true, phone: true, isVip: true } } },
      }),
      // Confirmed reservations already assigned to THIS room
      this.prisma.reservation.findMany({
        where: { roomId: id, status: 'CONFIRMED', checkInDate: { gte: today } },
        orderBy: { checkInDate: 'asc' },
        include: { guest: { select: { firstName: true, lastName: true, phone: true, isVip: true } } },
      }),
      // Confirmed reservations of this room TYPE but no room assigned yet
      this.prisma.reservation.findMany({
        where: { roomTypeId: room.roomTypeId, roomId: null, status: 'CONFIRMED', checkInDate: { gte: today } },
        orderBy: { checkInDate: 'asc' },
        include: { guest: { select: { firstName: true, lastName: true, phone: true, isVip: true } } },
      }),
      this.prisma.housekeepingTask.findMany({ where: { roomNumber: room.roomNumber }, orderBy: { createdAt: 'desc' } }),
      this.prisma.asset.findMany({
        where: { area: 'ROOM', roomNumber: room.roomNumber },
        include: { workOrders: { where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } } } },
      }),
    ]);

    const maintenanceIssues = assets.flatMap((a) =>
      a.workOrders.map((w) => ({ id: w.id, workOrderNumber: w.workOrderNumber, asset: a.name, priority: w.priority, status: w.status })),
    );
    const activeTask = housekeeping.find((t) => t.status !== 'COMPLETED');

    const mapArrival = (res: typeof assignedUpcoming[0]) => ({
      id: res.id,
      reservationNumber: res.reservationNumber,
      guestName: `${res.guest.firstName} ${res.guest.lastName}`,
      guestPhone: res.guest.phone,
      checkInDate: res.checkInDate.toISOString().slice(0, 10),
      checkOutDate: res.checkOutDate.toISOString().slice(0, 10),
      isVip: res.guest.isVip,
    });

    return {
      room: { id: room.id, roomNumber: room.roomNumber, floor: room.floor, status: room.status, roomType: room.roomType?.name ?? null },
      occupant: reservation
        ? {
            name: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
            phone: reservation.guest.phone,
            isVip: reservation.guest.isVip,
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
            checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
          }
        : null,
      assignedUpcoming: assignedUpcoming.map(mapArrival),
      unassignedArrivals: unassignedArrivals.map(mapArrival),
      assignedHousekeeper: activeTask?.assignedTo ?? null,
      housekeeping: housekeeping.map((t) => ({ id: t.id, type: t.type, status: t.status, priority: t.priority, assignedTo: t.assignedTo })),
      assets: assets.map((a) => ({ id: a.id, assetNumber: a.assetNumber, name: a.name, status: a.status })),
      maintenanceIssues,
    };
  }

  async updateStatus(id: string, status: RoomStatus) {
    await this.getRoom(id);
    return this.prisma.room.update({ where: { id }, data: { status } });
  }

  /** Count of AVAILABLE rooms of a type (availability for public reservation flow). */
  availabilityByType(roomTypeId: string) {
    return this.prisma.room.count({ where: { roomTypeId, status: 'AVAILABLE', isActive: true } });
  }

  // Room types
  listRoomTypes(activeOnly = false) {
    return this.prisma.roomType.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getRoomTypeBySlug(slug: string) {
    const rt = await this.prisma.roomType.findUnique({ where: { slug } });
    if (!rt) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });
    return rt;
  }
}
