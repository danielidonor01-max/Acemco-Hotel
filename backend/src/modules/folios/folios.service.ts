import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ChargeDepartment, Prisma, Storefront } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChargesService } from '../charges/charges.service';

const STOREFRONT_DEPT: Record<Storefront, ChargeDepartment> = {
  RESTAURANT: 'RESTAURANT',
  LOUNGE: 'LOUNGE',
  BOUTIQUE: 'BOUTIQUE',
};

/**
 * A folio is the per-stay wrapper (OPEN/SETTLED). The actual charges live in the
 * central Charge Ledger, keyed by reservation — this service is a thin view over it.
 */
@Injectable()
export class FoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charges: ChargesService,
  ) {}

  /** Folio for a reservation's active stay, with ledger charges + balance. */
  async byReservation(reservationId: string) {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: { reservationId },
      orderBy: { checkedInAt: 'desc' },
      include: { folio: true },
    });
    const { charges, balance } = await this.charges.byReservation(reservationId);
    const lines = charges.map((c) => ({
      id: c.id,
      description: c.description,
      amount: Number(c.amount) + Number(c.tax),
      type: c.department,
      postedAt: c.createdAt,
    }));
    const folio = checkIn?.folio ? { id: checkIn.folio.id, status: checkIn.folio.status, openedAt: checkIn.folio.openedAt, settledAt: checkIn.folio.settledAt } : null;
    return { folio, lines, balance };
  }

  /** Add a manual charge to a stay (resolves guest/room/company from the reservation). */
  async addLine(folioId: string, dto: { description: string; amount: number; type: ChargeDepartment }) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: { checkIn: { include: { reservation: true } } },
    });
    if (!folio) throw new NotFoundException({ code: 'FOLIO_NOT_FOUND', message: 'Folio not found.' });
    const res = folio.checkIn.reservation;
    return this.charges.post({
      reservationId: res?.id,
      guestId: folio.guestId,
      companyId: res?.companyId ?? undefined,
      roomId: folio.checkIn.roomId,
      department: dto.type,
      sourceModule: 'folio',
      description: dto.description,
      amount: dto.amount,
    });
  }

  /**
   * Post a storefront order to the in-house guest's stay (order → ledger charge).
   *
   * Throws if the room has no checked-in guest. It used to `return` silently,
   * which meant an order charged to an empty room was fulfilled and NEVER billed
   * — the guest ate for free and nothing recorded that it happened. Refusing the
   * charge (and, with `tx`, rolling the order back with it) is the only safe
   * behaviour: you cannot bill a room that nobody is staying in.
   */
  async postOrderToRoom(
    roomNumber: string,
    storefront: Storefront,
    amount: number,
    orderNumber: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const reservation = await db.reservation.findFirst({
      where: { status: 'CHECKED_IN', room: { roomNumber } },
      orderBy: { checkInDate: 'desc' },
    });
    if (!reservation) {
      throw new UnprocessableEntityException({
        code: 'ROOM_NOT_OCCUPIED',
        message: `Room ${roomNumber} has no checked-in guest, so the order cannot be charged to it.`,
      });
    }
    await this.charges.post(
      {
        reservationId: reservation.id,
        guestId: reservation.guestId,
        companyId: reservation.companyId ?? undefined,
        roomId: reservation.roomId,
        department: STOREFRONT_DEPT[storefront],
        sourceModule: 'orders',
        referenceNumber: orderNumber,
        description: `${storefront} order ${orderNumber}`,
        amount,
      },
      tx,
    );
  }
}
