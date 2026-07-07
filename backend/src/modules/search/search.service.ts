import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SearchResult {
  type: 'reservation' | 'guest' | 'room' | 'order';
  title: string;
  subtitle: string;
  href: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string): Promise<SearchResult[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const like = { contains: term, mode: 'insensitive' as const };

    const [reservations, guests, rooms, orders] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          OR: [
            { reservationNumber: like },
            { guest: { OR: [{ firstName: like }, { lastName: like }] } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { guest: { select: { firstName: true, lastName: true } }, roomType: { select: { name: true } } },
      }),
      this.prisma.guest.findMany({
        where: { deletedAt: null, OR: [{ firstName: like }, { lastName: like }, { phone: like }, { email: like }] },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.room.findMany({
        where: { roomNumber: like, isActive: true },
        take: 5,
        orderBy: { roomNumber: 'asc' },
        include: { roomType: { select: { name: true } } },
      }),
      this.prisma.order.findMany({
        where: { OR: [{ orderNumber: like }, { customerName: like }] },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const results: SearchResult[] = [];
    for (const r of reservations) {
      results.push({
        type: 'reservation',
        title: `${r.reservationNumber} · ${r.guest.firstName} ${r.guest.lastName}`,
        subtitle: `${r.roomType.name} · ${r.status.replace(/_/g, ' ').toLowerCase()}`,
        href: `/manage/reservations/${r.id}`,
      });
    }
    for (const g of guests) {
      results.push({ type: 'guest', title: `${g.firstName} ${g.lastName}`, subtitle: g.phone, href: '/manage/guests' });
    }
    for (const rm of rooms) {
      results.push({ type: 'room', title: `Room ${rm.roomNumber}`, subtitle: `${rm.roomType?.name ?? ''} · ${rm.status.replace(/_/g, ' ').toLowerCase()}`, href: '/manage/rooms' });
    }
    for (const o of orders) {
      results.push({ type: 'order', title: o.orderNumber, subtitle: `${o.storefront.toLowerCase()} · ${o.status.toLowerCase()}`, href: '/manage/orders' });
    }
    return results;
  }
}
