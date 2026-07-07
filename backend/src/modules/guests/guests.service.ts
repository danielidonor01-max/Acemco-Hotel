import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationQuery } from '../../common/utils/pagination';
import { CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';

const MS_PER_DAY = 86_400_000;
const nights = (a: Date, b: Date) => Math.max(0, Math.round((+new Date(b) - +new Date(a)) / MS_PER_DAY));

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQuery & { search?: string }) {
    const { page, pageSize, search } = query;
    const where: Prisma.GuestWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { reservations: true } },
          reservations: { select: { status: true, companyId: true, checkOutDate: true } },
        },
      }),
      this.prisma.guest.count({ where }),
    ]);

    // Enrich each guest with derived operational signals for Reception filters.
    const enriched = items.map(({ reservations, ...g }) => {
      const stays = reservations.length;
      const inHouse = reservations.some((r) => r.status === 'CHECKED_IN');
      const past = reservations.some((r) => r.status === 'CHECKED_OUT');
      const isCorporate = reservations.some((r) => r.companyId);
      const lastVisit = reservations
        .map((r) => r.checkOutDate)
        .filter(Boolean)
        .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;
      return { ...g, stays, inHouse, past, isCorporate, frequent: stays >= 3, lastVisit };
    });
    return paginate(enriched, total, page, pageSize);
  }

  async get(id: string) {
    const guest = await this.prisma.guest.findFirst({ where: { id, deletedAt: null } });
    if (!guest) throw new NotFoundException({ code: 'GUEST_NOT_FOUND', message: 'Guest not found.' });
    return guest;
  }

  create(dto: CreateGuestDto) {
    return this.prisma.guest.create({ data: { ...dto, email: dto.email?.toLowerCase() } });
  }

  async update(id: string, dto: UpdateGuestDto) {
    await this.get(id);
    // Tier VIP keeps the legacy isVip flag (reservation star) in sync.
    const data: Prisma.GuestUpdateInput = { ...dto };
    if (dto.tier) data.isVip = dto.tier === 'VIP';
    return this.prisma.guest.update({ where: { id }, data });
  }

  async archive(id: string) {
    await this.get(id);
    return this.prisma.guest.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Guest Relationship Intelligence — reservation history + measurable engagement
   * (lifetime spend, nights, favourites) and a loyalty score that *recommends* VIP.
   */
  async profile(id: string) {
    const guest = await this.get(id);
    const [reservations, charges, orders] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { guestId: id },
        orderBy: { checkInDate: 'desc' },
        include: { roomType: { select: { name: true } }, company: { select: { name: true } }, room: { select: { roomNumber: true } } },
      }),
      this.prisma.chargeLedger.findMany({ where: { guestId: id, status: { not: 'VOIDED' } } }),
      this.prisma.order.findMany({ where: { guestId: id }, include: { items: { include: { menuItem: { select: { name: true } } } } } }),
    ]);

    // Favourite meals & drinks — from the guest's own orders (item quantities).
    const itemCount = new Map<string, number>();
    for (const o of orders) for (const it of o.items) {
      const name = it.menuItem?.name ?? 'Item';
      itemCount.set(name, (itemCount.get(name) ?? 0) + it.quantity);
    }
    const favouriteItems = [...itemCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalStays = reservations.length;
    const totalNights = reservations.reduce((s, r) => s + nights(r.checkInDate, r.checkOutDate), 0);
    const lifetimeSpend = charges.reduce((s, c) => s + Number(c.amount) + Number(c.tax), 0);
    const lastVisit = reservations.find((r) => r.status === 'CHECKED_OUT' || r.status === 'CHECKED_IN')?.checkInDate ?? reservations[0]?.checkInDate ?? null;

    // Favourite room type (mode).
    const roomTypeCount = new Map<string, number>();
    for (const r of reservations) if (r.roomType?.name) roomTypeCount.set(r.roomType.name, (roomTypeCount.get(r.roomType.name) ?? 0) + 1);
    const favouriteRoomType = [...roomTypeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Spend by department + companies affiliated.
    const deptSpend = new Map<string, number>();
    for (const c of charges) deptSpend.set(c.department, (deptSpend.get(c.department) ?? 0) + Number(c.amount) + Number(c.tax));
    const companies = [...new Set(reservations.map((r) => r.company?.name).filter(Boolean))] as string[];

    // Average booking lead time (createdAt → check-in), in days.
    const leadTimes = reservations.map((r) => nights(r.createdAt, r.checkInDate));
    const avgLeadTime = leadTimes.length ? Math.round(leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length) : 0;

    // Loyalty score (0–100) — recommends, never auto-assigns VIP.
    const staysScore = Math.min(35, totalStays * 6);
    const spendScore = Math.min(35, (lifetimeSpend / 1_000_000) * 35);
    const nightsScore = Math.min(20, totalNights * 2);
    const freqScore = Math.min(10, totalStays * 2);
    const loyaltyScore = Math.round(staysScore + spendScore + nightsScore + freqScore);

    return {
      guest: { id: guest.id, name: `${guest.firstName} ${guest.lastName}`, tier: guest.tier, isVip: guest.isVip, isBlacklisted: guest.isBlacklisted, phone: guest.phone, email: guest.email, nationality: guest.nationality },
      stats: { totalStays, totalNights, lifetimeSpend, lastVisit, favouriteRoomType, avgLeadTime },
      favouriteItems,
      companies,
      spendByDepartment: [...deptSpend.entries()].map(([department, amount]) => ({ department, amount })).sort((a, b) => b.amount - a.amount),
      loyaltyScore,
      vipRecommended: loyaltyScore >= 60 && guest.tier !== 'VIP',
      history: reservations.map((r) => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        roomType: r.roomType?.name ?? null,
        room: r.room?.roomNumber ?? null,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        status: r.status,
        company: r.company?.name ?? null,
        totalAmount: Number(r.totalAmount),
      })),
    };
  }
}
