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
