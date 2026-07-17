import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { PricingService } from '../pricing/pricing.service';
import { CancellationService } from './cancellation.service';
import { ChargesService } from '../charges/charges.service';
import { FinanceService } from '../finance/finance.service';
import { reservationNumber, groupNumber } from '../../common/utils/number-generator';
import { toWhatsAppNumber } from '../../common/utils/phone';
import { GroupBookingDto } from './dto/reservation.dto';

const MS_PER_DAY = 86_400_000;
const nights = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / MS_PER_DAY);

/**
 * Group / multi-room bookings.
 *
 * The old corporate path created N reservations in N separate transactions with
 * nothing linking them, so it wasn't atomic — if the 3rd room was unavailable,
 * the first two were already booked and there was no way to see or undo them as a
 * set. A group is created ALL-OR-NOTHING under the one booking lock, and its
 * members carry a shared groupId so it can be viewed, cancelled, and billed as a
 * unit.
 */
@Injectable()
export class GroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly pricing: PricingService,
    private readonly cancellation: CancellationService,
    private readonly charges: ChargesService,
    private readonly finance: FinanceService,
  ) {}

  /**
   * Create a group and all its rooms in one transaction.
   *
   * Availability is re-checked per room INSIDE the lock, and because each hold we
   * insert is visible to the next room's check within the same transaction, a
   * group asking for 3 of a type genuinely needs 3 free — it can't oversell
   * against itself. If any room can't be placed, the whole group rolls back.
   */
  async create(dto: GroupBookingDto, userId?: string) {
    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company not found.' });
    }

    // Resolve room types up front so a bad slug fails before we take the lock.
    const slugs = [...new Set(dto.rooms.map((r) => r.roomTypeSlug))];
    const types = await this.prisma.roomType.findMany({ where: { slug: { in: slugs } } });
    const bySlug = new Map(types.map((t) => [t.slug, t]));
    for (const slug of slugs) {
      if (!bySlug.has(slug)) throw new NotFoundException({ code: 'ROOM_TYPE_NOT_FOUND', message: `Room type "${slug}" not found.` });
    }
    for (const r of dto.rooms) {
      if (nights(r.checkInDate, r.checkOutDate) < 1) {
        throw new ConflictException({ code: 'INVALID_DATES', message: 'Every room must check out after it checks in.' });
      }
    }

    const wa = dto.organiser.whatsapp ? toWhatsAppNumber(dto.organiser.whatsapp) : toWhatsAppNumber(dto.organiser.phone);

    return this.prisma.$transaction(async (tx) => {
      await this.availability.lockBookings(tx);

      // Organiser: reuse by phone or create. Blacklist blocks the whole group.
      let organiser = await tx.guest.findFirst({ where: { phone: dto.organiser.phone, deletedAt: null } });
      if (organiser?.isBlacklisted) throw new ConflictException({ code: 'GUEST_BLACKLISTED', message: 'A blacklisted guest cannot hold a booking.' });
      if (!organiser) {
        organiser = await tx.guest.create({
          data: { firstName: dto.organiser.firstName, lastName: dto.organiser.lastName, phone: dto.organiser.phone, whatsapp: wa ?? undefined, email: dto.organiser.email?.toLowerCase() },
        });
      } else if (wa && organiser.whatsapp !== wa) {
        organiser = await tx.guest.update({ where: { id: organiser.id }, data: { whatsapp: wa } });
      }

      const groupCount = await tx.bookingGroup.count();
      const group = await tx.bookingGroup.create({
        data: {
          groupNumber: groupNumber(groupCount + 1),
          name: dto.name,
          companyId: dto.companyId,
          notes: dto.notes,
          createdByUserId: userId,
        },
      });

      let total = 0;
      for (const room of dto.rooms) {
        const rt = bySlug.get(room.roomTypeSlug)!;
        // Re-check availability with the group's own just-created holds counted.
        const free = await this.availability.isTypeAvailable(rt.id, room.checkInDate, room.checkOutDate, undefined, tx);
        if (!free) {
          throw new ConflictException({
            code: 'NO_AVAILABILITY',
            message: `Not enough ${rt.name} rooms are free for ${room.checkInDate} → ${room.checkOutDate}. The group was not booked.`,
          });
        }
        const { total: roomTotal } = await this.pricing.quote(rt.id, Number(rt.basePrice), room.checkInDate, room.checkOutDate, tx);
        total += roomTotal;
        const count = await tx.reservation.count();
        await tx.reservation.create({
          data: {
            reservationNumber: reservationNumber(count + 1),
            type: dto.companyId ? 'CORPORATE' : 'INDIVIDUAL',
            guestId: organiser.id,
            companyId: dto.companyId,
            groupId: group.id,
            roomTypeId: rt.id,
            checkInDate: new Date(room.checkInDate),
            checkOutDate: new Date(room.checkOutDate),
            adults: room.adults,
            children: room.children,
            source: 'INTERNAL',
            specialRequests: room.guestName ? `Guest: ${room.guestName}` : undefined,
            totalAmount: roomTotal,
            createdByUserId: userId,
          },
        });
      }

      return { group, rooms: dto.rooms.length, total: Math.round(total * 100) / 100 };
    }, { timeout: 30000, maxWait: 10000 });
  }

  /** A group with its rooms and combined totals. */
  async get(id: string) {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
        reservations: {
          include: { guest: { select: { firstName: true, lastName: true } }, roomType: { select: { name: true } }, room: { select: { roomNumber: true } } },
          orderBy: { reservationNumber: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: 'Group booking not found.' });

    const res = group.reservations;
    const total = res.reduce((s, r) => s + Number(r.totalAmount), 0);
    const active = res.filter((r) => !['CANCELLED', 'NO_SHOW'].includes(r.status));
    // Outstanding across the whole group, from the ledger.
    const ids = res.map((r) => r.id);
    const charges = ids.length
      ? await this.prisma.chargeLedger.findMany({ where: { reservationId: { in: ids }, status: { not: 'VOIDED' } }, select: { amount: true, tax: true } })
      : [];
    const billed = charges.reduce((s, c) => s + Number(c.amount) + Number(c.tax), 0);

    return {
      ...group,
      summary: {
        rooms: res.length,
        activeRooms: active.length,
        totalValue: Math.round(total * 100) / 100,
        billedToDate: Math.round(billed * 100) / 100,
        statuses: res.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {}),
      },
    };
  }

  list(limit = 30) {
    return this.prisma.bookingGroup.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: { company: { select: { name: true } }, _count: { select: { reservations: true } } },
    });
  }

  /**
   * Cancel the whole group in one transaction. Each cancellable member is settled
   * through the cancellation policy (fee, deposit, refund) exactly as an
   * individual cancel would be; already checked-in/out rooms are left alone and
   * reported, since you can't cancel a guest who has arrived.
   */
  async cancel(id: string, reason: string | undefined, userId?: string) {
    const group = await this.prisma.bookingGroup.findUnique({ where: { id }, include: { reservations: true } });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: 'Group booking not found.' });

    return this.prisma.$transaction(async (tx) => {
      const cancelled: string[] = [];
      const skipped: { reservationNumber: string; status: string }[] = [];
      let totalFee = 0;

      for (const r of group.reservations) {
        if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') continue;
        if (r.status === 'CHECKED_IN' || r.status === 'CHECKED_OUT') {
          skipped.push({ reservationNumber: r.reservationNumber, status: r.status });
          continue;
        }
        const outcome = await this.settleMember(tx, r);
        totalFee += outcome.fee;
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason ?? `Group ${group.groupNumber} cancelled`, roomId: null },
        });
        cancelled.push(r.reservationNumber);
      }

      return { groupNumber: group.groupNumber, cancelled: cancelled.length, skipped, totalFee: Math.round(totalFee * 100) / 100 };
    }, { timeout: 30000, maxWait: 10000 });
  }

  /** Mirror of ReservationsService.settleCancellation for a single member. */
  private async settleMember(tx: Prisma.TransactionClient, r: { id: string; guestId: string; companyId: string | null; roomId: string | null; reservationNumber: string; totalAmount: Prisma.Decimal; depositAmount: Prisma.Decimal; checkInDate: Date }) {
    const policy = await this.cancellation.policy();
    const outcome = this.cancellation.compute(policy, { total: Number(r.totalAmount), deposit: Number(r.depositAmount), checkInDate: r.checkInDate, kind: 'CANCEL' });
    const common = { reservationId: r.id, guestId: r.guestId, companyId: r.companyId ?? undefined, roomId: r.roomId ?? undefined, department: 'CANCELLATION' as const, sourceModule: 'reservations', referenceNumber: r.reservationNumber };
    if (outcome.fee > 0) await this.charges.post({ ...common, description: `Cancellation fee · ${r.reservationNumber}`, amount: outcome.fee, status: 'POSTED' }, tx);
    if (outcome.depositApplied > 0) await this.charges.post({ ...common, description: `Deposit applied · ${r.reservationNumber}`, amount: -outcome.depositApplied, tax: 0, status: 'PAID' }, tx);
    if (outcome.refundDue > 0) {
      await this.charges.post({ ...common, description: `Deposit refund due · ${r.reservationNumber}`, amount: -outcome.refundDue, tax: 0, status: 'POSTED' }, tx);
      await this.finance.create({ type: 'REFUND', amount: outcome.refundDue, direction: 'DEBIT', account: 'Deposit Refunds', description: `Deposit refund · ${r.reservationNumber}`, date: new Date().toISOString().slice(0, 10), status: 'POSTED' }, tx);
    }
    return outcome;
  }
}
