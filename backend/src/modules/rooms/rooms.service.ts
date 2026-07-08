import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RoomTypeInput {
  name: string;
  description?: string;
  bedConfiguration?: string;
  maxOccupancy?: number;
  basePrice?: number;
  features?: string[];
  images?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

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

  // ---------------- Room types (category) CRUD ----------------
  listRoomTypes(activeOnly = false) {
    return this.prisma.roomType.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { rooms: true, reservations: true } } },
    });
  }

  async getRoomTypeBySlug(slug: string) {
    const rt = await this.prisma.roomType.findUnique({ where: { slug } });
    if (!rt) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });
    return rt;
  }

  private async getRoomTypeById(id: string) {
    const rt = await this.prisma.roomType.findUnique({ where: { id } });
    if (!rt) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });
    return rt;
  }

  private slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /** A unique slug derived from the name (the public site keys rooms by slug). */
  private async uniqueSlug(name: string) {
    const base = this.slugify(name) || 'room-type';
    let slug = base;
    let i = 1;
    while (await this.prisma.roomType.findUnique({ where: { slug } })) slug = `${base}-${++i}`;
    return slug;
  }

  async createRoomType(dto: RoomTypeInput) {
    const slug = await this.uniqueSlug(dto.name);
    const maxSort = (await this.prisma.roomType.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    return this.prisma.roomType.create({
      data: {
        slug,
        name: dto.name,
        description: dto.description ?? '',
        bedConfiguration: dto.bedConfiguration ?? '',
        maxOccupancy: dto.maxOccupancy ?? 2,
        basePrice: dto.basePrice ?? 0,
        features: dto.features ?? [],
        images: dto.images ?? [],
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? maxSort + 1,
      },
    });
  }

  /** Update a room type. The slug is immutable (public-site URLs depend on it). */
  async updateRoomType(id: string, dto: Partial<RoomTypeInput>) {
    await this.getRoomTypeById(id);
    return this.prisma.roomType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.bedConfiguration !== undefined ? { bedConfiguration: dto.bedConfiguration } : {}),
        ...(dto.maxOccupancy !== undefined ? { maxOccupancy: dto.maxOccupancy } : {}),
        ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
        ...(dto.features !== undefined ? { features: dto.features } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  /** Delete a room type only when no rooms or reservations reference it; otherwise deactivate. */
  async deleteRoomType(id: string) {
    await this.getRoomTypeById(id);
    const [rooms, reservations] = await Promise.all([
      this.prisma.room.count({ where: { roomTypeId: id } }),
      this.prisma.reservation.count({ where: { roomTypeId: id } }),
    ]);
    if (rooms > 0 || reservations > 0) {
      throw new ConflictException({
        code: 'ROOM_TYPE_IN_USE',
        message: `Cannot delete — ${rooms} room(s) and ${reservations} reservation(s) use this type. Deactivate it instead.`,
      });
    }
    await this.prisma.roomType.delete({ where: { id } });
    return { deleted: true };
  }
}
