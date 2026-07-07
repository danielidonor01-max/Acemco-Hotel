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

  /**
   * Company invoice built from the Charge Ledger — totals by department plus a
   * per-guest drill-down (every charge, guest, room). Reads one standardized place.
   */
  async invoice(id: string) {
    const company = await this.get(id);
    const charges = await this.prisma.chargeLedger.findMany({
      where: { companyId: id, status: { not: 'VOIDED' } },
      orderBy: { date: 'asc' },
      include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { roomNumber: true } } },
    });

    const byDeptMap = new Map<string, number>();
    const byGuestMap = new Map<string, { guestId: string; guestName: string; total: number; charges: any[] }>();
    let taxTotal = 0;
    let grandTotal = 0;
    let outstanding = 0;

    for (const c of charges) {
      const line = Number(c.amount) + Number(c.tax);
      taxTotal += Number(c.tax);
      grandTotal += line;
      if (c.status === 'POSTED' || c.status === 'INVOICED') outstanding += line;
      byDeptMap.set(c.department, (byDeptMap.get(c.department) ?? 0) + line);

      const gid = c.guestId ?? 'unknown';
      const gname = c.guest ? `${c.guest.firstName} ${c.guest.lastName}` : 'Unattributed';
      if (!byGuestMap.has(gid)) byGuestMap.set(gid, { guestId: gid, guestName: gname, total: 0, charges: [] });
      const g = byGuestMap.get(gid)!;
      g.total += line;
      g.charges.push({
        id: c.id,
        chargeNumber: c.chargeNumber,
        date: c.date,
        department: c.department,
        description: c.description,
        room: c.room?.roomNumber ?? null,
        reference: c.referenceNumber,
        amount: Number(c.amount),
        tax: Number(c.tax),
        status: c.status,
      });
    }

    return {
      company: { id: company.id, name: company.name, tier: company.tier, status: company.status, billingEmail: company.billingEmail },
      byDepartment: [...byDeptMap.entries()].map(([department, amount]) => ({ department, amount })).sort((a, b) => b.amount - a.amount),
      byGuest: [...byGuestMap.values()].sort((a, b) => b.total - a.total),
      taxTotal,
      grandTotal,
      outstanding,
      chargeCount: charges.length,
    };
  }

  /** Settle a company's outstanding charges (POSTED/INVOICED → PAID). */
  async settle(id: string) {
    await this.get(id);
    const res = await this.prisma.chargeLedger.updateMany({
      where: { companyId: id, status: { in: ['POSTED', 'INVOICED'] } },
      data: { status: 'PAID' },
    });
    return { settled: res.count };
  }
}
