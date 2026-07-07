import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  listRooms(status?: RoomStatus) {
    return this.prisma.room.findMany({
      where: { ...(status ? { status } : {}), isActive: true },
      include: { roomType: { select: { name: true, slug: true } } },
      orderBy: { roomNumber: 'asc' },
    });
  }

  async getRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, include: { roomType: true } });
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
    return room;
  }

  /** Full picture of a room: occupant, housekeeping, assets + open maintenance. */
  async getRoomDetail(id: string) {
    const room = await this.getRoom(id);
    const [reservation, housekeeping, assets] = await Promise.all([
      this.prisma.reservation.findFirst({
        where: { roomId: id, status: 'CHECKED_IN' },
        orderBy: { checkInDate: 'desc' },
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

    return {
      room: { id: room.id, roomNumber: room.roomNumber, floor: room.floor, status: room.status, roomType: room.roomType?.name ?? null },
      occupant: reservation
        ? {
            name: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
            phone: reservation.guest.phone,
            isVip: reservation.guest.isVip,
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
          }
        : null,
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
