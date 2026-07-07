import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, ReservationStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationQuery } from '../../common/utils/pagination';
import { reservationNumber, chargeNumber } from '../../common/utils/number-generator';
import { CreateReservationDto, PublicReservationDto, CorporateBookingDto } from './dto/reservation.dto';

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
      include: { guest: true, roomType: true, room: true, company: true },
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
    // Resolve the room type by id or slug.
    const roomType = dto.roomTypeId
      ? await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } })
      : await this.prisma.roomType.findUnique({ where: { slug: dto.roomTypeSlug! } });
    if (!roomType) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: 'Room type not found.' });

    // Resolve the guest: existing by id, or find-or-create by phone.
    let guest = dto.guestId
      ? await this.prisma.guest.findFirst({ where: { id: dto.guestId, deletedAt: null } })
      : await this.prisma.guest.findFirst({ where: { phone: dto.phone, deletedAt: null } });
    if (dto.guestId && !guest) throw new NotFoundException({ code: 'GUEST_NOT_FOUND', message: 'Guest not found.' });
    if (guest?.isBlacklisted) throw new UnprocessableEntityException({ code: 'GUEST_BLACKLISTED', message: 'A blacklisted guest cannot make a reservation.' });
    if (!guest) {
      guest = await this.prisma.guest.create({
        data: { firstName: dto.firstName!, lastName: dto.lastName!, phone: dto.phone!, email: dto.email?.toLowerCase() },
      });
    }

    await this.assertAvailability(roomType.id);

    const nights = nightsBetween(dto.checkInDate, dto.checkOutDate);
    if (nights < 1) throw new BadRequestException({ code: 'INVALID_DATES', message: 'Check-out must be after check-in.' });
    const total = Number(roomType.basePrice) * nights;

    return this.prisma.reservation.create({
      data: {
        reservationNumber: await this.nextNumber(),
        type: dto.type,
        guestId: guest.id,
        companyId: dto.companyId,
        roomTypeId: roomType.id,
        checkInDate: new Date(dto.checkInDate),
        checkOutDate: new Date(dto.checkOutDate),
        adults: dto.adults,
        children: dto.children,
        source: dto.source,
        specialRequests: dto.specialRequests,
        totalAmount: total,
        createdByUserId: userId,
      },
      include: { guest: { select: { firstName: true, lastName: true, isVip: true } }, roomType: { select: { name: true } } },
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

  /** Corporate booking: create several reservations (one per guest/room) under one company. */
  async corporateBooking(dto: CorporateBookingDto, userId: string) {
    const reservations: Awaited<ReturnType<ReservationsService['create']>>[] = [];
    for (const g of dto.guests) {
      const r = await this.create(
        {
          type: 'CORPORATE',
          companyId: dto.companyId,
          firstName: g.firstName,
          lastName: g.lastName,
          phone: g.phone,
          roomTypeSlug: g.roomTypeSlug,
          checkInDate: dto.checkInDate,
          checkOutDate: dto.checkOutDate,
          adults: 1,
          children: 0,
          source: 'INTERNAL',
        },
        userId,
      );
      reservations.push(r);
    }
    return { count: reservations.length, reservations };
  }

  /** Walk-in: create + confirm + check-in in one step (guest arrives without a booking). */
  async walkIn(dto: CreateReservationDto & { roomId?: string }, userId: string) {
    const created = await this.create({ ...dto, source: 'WALK_IN' }, userId);
    await this.prisma.reservation.update({ where: { id: created.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
    return this.checkIn(created.id, dto.roomId, userId);
  }

  private readonly detailInclude = {
    guest: { select: { firstName: true, lastName: true, isVip: true, phone: true } },
    roomType: { select: { name: true } },
    room: { select: { roomNumber: true } },
    company: { select: { name: true } },
  } as const;

  /**
   * Check-in interlock (Domain §5): reservation → CHECKED_IN, room → OCCUPIED,
   * plus a CheckIn record and an OPEN folio with the room charge posted.
   */
  async checkIn(id: string, roomId: string | undefined, userId: string) {
    const r = await this.get(id);
    if (r.status !== 'CONFIRMED') {
      throw new ConflictException({ code: 'INVALID_STATE', message: `Only a confirmed reservation can be checked in (currently ${r.status}).` });
    }
    const room = roomId
      ? await this.prisma.room.findUnique({ where: { id: roomId } })
      : r.roomId
        ? await this.prisma.room.findUnique({ where: { id: r.roomId } })
        : await this.prisma.room.findFirst({ where: { roomTypeId: r.roomTypeId, status: 'AVAILABLE', isActive: true }, orderBy: { roomNumber: 'asc' } });
    if (!room) throw new ConflictException({ code: 'NO_ROOM', message: 'No available room of this type to assign.' });
    if (room.status !== 'AVAILABLE') throw new ConflictException({ code: 'ROOM_UNAVAILABLE', message: `Room ${room.roomNumber} is ${room.status}.` });

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({ where: { id }, data: { status: 'CHECKED_IN', roomId: room.id }, include: this.detailInclude });
      await tx.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED' } });
      const checkIn = await tx.checkIn.create({
        data: { reservationId: id, guestId: r.guestId, roomId: room.id, checkedInByUserId: userId, keyIssued: true },
      });
      await tx.folio.create({ data: { guestId: r.guestId, checkInId: checkIn.id, status: 'OPEN' } });
      // Room charge → the central Charge Ledger (guest + room + company identities).
      const chargeCount = await tx.chargeLedger.count();
      await tx.chargeLedger.create({
        data: {
          chargeNumber: chargeNumber(chargeCount + 1),
          reservationId: id,
          guestId: r.guestId,
          companyId: r.companyId ?? undefined,
          roomId: room.id,
          department: 'ROOM',
          sourceModule: 'reservations',
          referenceNumber: reservation.reservationNumber,
          description: `Room charge · ${reservation.reservationNumber}`,
          amount: r.totalAmount,
          status: 'POSTED',
        },
      });
      return reservation;
    }, { timeout: 20000, maxWait: 10000 });
  }

  /**
   * Check-out interlock (Domain §5): reservation → CHECKED_OUT, room → CLEANING,
   * settle the folio and record a CheckOut with the total charged + payment method.
   */
  async checkOut(id: string, userId: string, paymentMethod: PaymentMethod = 'CASH') {
    const r = await this.get(id);
    if (r.status !== 'CHECKED_IN') {
      throw new ConflictException({ code: 'INVALID_STATE', message: `Only a checked-in reservation can be checked out (currently ${r.status}).` });
    }
    const checkIn = await this.prisma.checkIn.findFirst({
      where: { reservationId: id, checkOut: null },
      orderBy: { checkedInAt: 'desc' },
      include: { folio: true },
    });
    // Balance comes from the Charge Ledger (single source of billing truth).
    const charges = await this.prisma.chargeLedger.findMany({ where: { reservationId: id, status: { not: 'VOIDED' } } });
    const balance = charges.length
      ? charges.reduce((s, c) => s + Number(c.amount) + Number(c.tax), 0)
      : Number(r.totalAmount);
    // Corporate stays are billed to the company (INVOICED); individuals settle now (PAID).
    const settledStatus = r.companyId ? 'INVOICED' : 'PAID';

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({ where: { id }, data: { status: 'CHECKED_OUT' }, include: this.detailInclude });
      if (r.roomId) await tx.room.update({ where: { id: r.roomId }, data: { status: 'CLEANING' } });
      await tx.chargeLedger.updateMany({ where: { reservationId: id, status: 'POSTED' }, data: { status: settledStatus } });
      if (checkIn) {
        await tx.checkOut.create({
          data: { checkInId: checkIn.id, guestId: r.guestId, roomId: r.roomId ?? checkIn.roomId, checkedOutByUserId: userId, totalCharged: balance, paymentMethod },
        });
        if (checkIn.folio) await tx.folio.update({ where: { id: checkIn.folio.id }, data: { status: 'SETTLED', settledAt: new Date() } });
      }
      // Queue a checkout-clean housekeeping task for the room.
      if (r.room?.roomNumber) {
        await tx.housekeepingTask.create({ data: { roomNumber: r.room.roomNumber, type: 'CHECKOUT_CLEAN', priority: 'HIGH', status: 'PENDING' } });
      }
      return reservation;
    }, { timeout: 20000, maxWait: 10000 });
  }

  async cancel(id: string, reason?: string) {
    const r = await this.get(id);
    // Invariant 7: cannot cancel a CHECKED_IN reservation.
    if (r.status === 'CHECKED_IN') throw new UnprocessableEntityException({ code: 'CANNOT_CANCEL_CHECKED_IN', message: 'Process checkout instead of cancelling.' });
    if (r.status === 'CANCELLED' || r.status === 'CHECKED_OUT') throw new ConflictException({ code: 'INVALID_STATE', message: `Reservation is already ${r.status}.` });
    return this.prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason } });
  }
}
