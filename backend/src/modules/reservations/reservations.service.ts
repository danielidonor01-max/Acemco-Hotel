import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationQuery } from '../../common/utils/pagination';
import { reservationNumber } from '../../common/utils/number-generator';
import { CreateReservationDto, PublicReservationDto } from './dto/reservation.dto';

const MS_PER_DAY = 86_400_000;
const nightsBetween = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / MS_PER_DAY);

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQuery & { status?: ReservationStatus }) {
    const { page, pageSize, status } = query;
    const where: Prisma.ReservationWhereInput = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { guest: { select: { firstName: true, lastName: true, isVip: true } }, roomType: { select: { name: true } } },
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async get(id: string) {
    const r = await this.prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, roomType: true, room: true },
    });
    if (!r) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
    return r;
  }

  private async assertAvailability(roomTypeId: string) {
    // Invariant 6: availability verified at creation time.
    const available = await this.prisma.room.count({ where: { roomTypeId, status: 'AVAILABLE', isActive: true } });
    if (available < 1) {
      throw new ConflictException({ code: 'NO_AVAILABILITY', message: 'No rooms of this type are available.' });
    }
  }

  private async nextNumber(): Promise<string> {
    const count = await this.prisma.reservation.count();
    return reservationNumber(count + 1);
  }

  async create(dto: CreateReservationDto, userId?: string) {
    const guest = await this.prisma.guest.findFirst({ where: { id: dto.guestId, deletedAt: null } });
    if (!guest) throw new NotFoundException({ code: 'GUEST_NOT_FOUND', message: 'Guest not found.' });
    if (guest.isBlacklisted) throw new UnprocessableEntityException({ code: 'GUEST_BLACKLISTED', message: 'A blacklisted guest cannot make a reservation.' });

    const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
    if (!roomType) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });
    await this.assertAvailability(dto.roomTypeId);

    const nights = nightsBetween(dto.checkInDate, dto.checkOutDate);
    if (nights < 1) throw new BadRequestException({ code: 'INVALID_DATES', message: 'Check-out must be after check-in.' });
    const total = Number(roomType.basePrice) * nights;

    return this.prisma.reservation.create({
      data: {
        reservationNumber: await this.nextNumber(),
        guestId: dto.guestId,
        roomTypeId: dto.roomTypeId,
        checkInDate: new Date(dto.checkInDate),
        checkOutDate: new Date(dto.checkOutDate),
        adults: dto.adults,
        children: dto.children,
        source: dto.source,
        specialRequests: dto.specialRequests,
        totalAmount: total,
        createdByUserId: userId,
      },
    });
  }

  /** Website reservation: find-or-create guest, then a PENDING reservation (source WEBSITE). */
  async createPublic(dto: PublicReservationDto) {
    const roomType = await this.prisma.roomType.findUnique({ where: { slug: dto.roomTypeSlug } });
    if (!roomType) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });
    await this.assertAvailability(roomType.id);

    let guest = await this.prisma.guest.findFirst({ where: { phone: dto.phone, deletedAt: null } });
    if (guest?.isBlacklisted) throw new UnprocessableEntityException({ code: 'GUEST_BLACKLISTED', message: 'Unable to complete this reservation.' });
    if (!guest) {
      guest = await this.prisma.guest.create({
        data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, email: dto.email?.toLowerCase() },
      });
    }

    const nights = nightsBetween(dto.checkInDate, dto.checkOutDate);
    const total = Number(roomType.basePrice) * nights;

    return this.prisma.reservation.create({
      data: {
        reservationNumber: await this.nextNumber(),
        guestId: guest.id,
        roomTypeId: roomType.id,
        checkInDate: new Date(dto.checkInDate),
        checkOutDate: new Date(dto.checkOutDate),
        adults: dto.adults,
        children: dto.children,
        source: 'WEBSITE',
        specialRequests: dto.specialRequests,
        totalAmount: total,
      },
    });
  }

  async confirm(id: string) {
    const r = await this.get(id);
    if (r.status !== 'PENDING') throw new ConflictException({ code: 'INVALID_STATE', message: `Cannot confirm a ${r.status} reservation.` });
    // Re-verify availability at confirmation time (Invariant 6).
    await this.assertAvailability(r.roomTypeId);
    return this.prisma.reservation.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
  }

  async cancel(id: string, reason?: string) {
    const r = await this.get(id);
    // Invariant 7: cannot cancel a CHECKED_IN reservation.
    if (r.status === 'CHECKED_IN') throw new UnprocessableEntityException({ code: 'CANNOT_CANCEL_CHECKED_IN', message: 'Process checkout instead of cancelling.' });
    if (r.status === 'CANCELLED' || r.status === 'CHECKED_OUT') throw new ConflictException({ code: 'INVALID_STATE', message: `Reservation is already ${r.status}.` });
    return this.prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason } });
  }
}
