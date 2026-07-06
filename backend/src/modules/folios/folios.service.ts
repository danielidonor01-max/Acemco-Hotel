import { Injectable, NotFoundException } from '@nestjs/common';
import { FolioLineType, Storefront } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const STOREFRONT_LINE: Record<Storefront, FolioLineType> = {
  RESTAURANT: 'RESTAURANT',
  LOUNGE: 'LOUNGE',
  BOUTIQUE: 'BOUTIQUE',
};

@Injectable()
export class FoliosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Folio for a reservation's active stay (via its CheckIn), with lines + balance. */
  async byReservation(reservationId: string) {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: { reservationId },
      orderBy: { checkedInAt: 'desc' },
      include: { folio: { include: { lines: { orderBy: { postedAt: 'asc' } } } } },
    });
    if (!checkIn?.folio) return { folio: null, lines: [], balance: 0 };
    const balance = checkIn.folio.lines.reduce((s, l) => s + Number(l.amount), 0);
    return { folio: { id: checkIn.folio.id, status: checkIn.folio.status, openedAt: checkIn.folio.openedAt, settledAt: checkIn.folio.settledAt }, lines: checkIn.folio.lines, balance };
  }

  async addLine(folioId: string, dto: { description: string; amount: number; type: FolioLineType }) {
    const folio = await this.prisma.folio.findUnique({ where: { id: folioId } });
    if (!folio) throw new NotFoundException({ code: 'FOLIO_NOT_FOUND', message: 'Folio not found.' });
    return this.prisma.folioLine.create({ data: { folioId, description: dto.description, amount: dto.amount, type: dto.type } });
  }

  /** Post a storefront order to the open folio of the room, if any (best-effort interlock). */
  async postOrderToRoom(roomNumber: string, storefront: Storefront, amount: number, orderNumber: string) {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: { room: { roomNumber }, checkOut: null, folio: { status: 'OPEN' } },
      orderBy: { checkedInAt: 'desc' },
      include: { folio: true },
    });
    if (!checkIn?.folio) return;
    await this.prisma.folioLine.create({
      data: { folioId: checkIn.folio.id, description: `${storefront} order ${orderNumber}`, amount, type: STOREFRONT_LINE[storefront], referenceId: orderNumber },
    });
  }
}
