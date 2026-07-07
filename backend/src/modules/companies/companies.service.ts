import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { reservations: true } } },
    });
  }

  async get(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id }, include: { _count: { select: { reservations: true } } } });
    if (!company) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company not found.' });
    return company;
  }

  create(dto: Prisma.CompanyCreateInput) {
    return this.prisma.company.create({ data: dto });
  }

  async update(id: string, dto: Prisma.CompanyUpdateInput) {
    await this.get(id);
    return this.prisma.company.update({ where: { id }, data: dto });
  }
}
