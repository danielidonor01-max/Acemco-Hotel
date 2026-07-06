import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, PaginationQuery } from '../../common/utils/pagination';
import { CreateGuestDto, UpdateGuestDto } from './dto/guest.dto';

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
        include: { _count: { select: { reservations: true } } },
      }),
      this.prisma.guest.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
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
    return this.prisma.guest.update({ where: { id }, data: dto });
  }

  async archive(id: string) {
    await this.get(id);
    // Guests are never hard-deleted (Domain rule) — soft archive.
    return this.prisma.guest.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
