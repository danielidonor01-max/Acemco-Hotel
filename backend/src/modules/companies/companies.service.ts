import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentMethod } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;

interface PaymentRow { id: string; amount: string; method: string; reference: string | null; note: string | null; paidAt: Date }
interface AgingInput { date: Date; line: number }

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

  /** Payments recorded against a company (raw — the table is provisioned via provision.cjs). */
  private payments(companyId: string) {
    return this.prisma.$queryRawUnsafe<PaymentRow[]>(
      `SELECT id, amount, method, reference, note, paid_at as "paidAt" FROM company_payments WHERE company_id = $1 ORDER BY paid_at DESC`,
      companyId,
    );
  }

  /**
   * Aging: apply total payments to the oldest outstanding charges first (FIFO),
   * then bucket whatever remains by the age of its charge date.
   */
  private bucketAging(charges: AgingInput[], paidToDate: number) {
    const ordered = [...charges].sort((a, b) => +a.date - +b.date);
    let remaining = paidToDate;
    const buckets = { current: 0, days31_60: 0, days61_90: 0, days90plus: 0 };
    const now = Date.now();
    for (const c of ordered) {
      let net = c.line;
      if (remaining > 0) {
        const applied = Math.min(remaining, net);
        net -= applied;
        remaining -= applied;
      }
      if (net <= 0.005) continue;
      const ageDays = Math.floor((now - +c.date) / MS_PER_DAY);
      if (ageDays <= 30) buckets.current += net;
      else if (ageDays <= 60) buckets.days31_60 += net;
      else if (ageDays <= 90) buckets.days61_90 += net;
      else buckets.days90plus += net;
    }
    const outstanding = buckets.current + buckets.days31_60 + buckets.days61_90 + buckets.days90plus;
    return { ...buckets, outstanding };
  }

  /**
   * Company invoice/statement from the Charge Ledger — totals by department, a
   * per-guest drill-down, payment history and aged outstanding balance.
   * Outstanding = billed charges − payments (payments tracked separately, so a
   * charge is never double-counted as both open and paid).
   */
  async invoice(id: string) {
    const company = await this.get(id);
    const [charges, payments] = await Promise.all([
      this.prisma.chargeLedger.findMany({
        where: { companyId: id, status: { not: 'VOIDED' } },
        orderBy: { date: 'asc' },
        include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { roomNumber: true } } },
      }),
      this.payments(id),
    ]);

    const byDeptMap = new Map<string, number>();
    const byGuestMap = new Map<string, { guestId: string; guestName: string; total: number; charges: any[] }>();
    const openCharges: AgingInput[] = [];
    let taxTotal = 0;
    let grandTotal = 0;

    for (const c of charges) {
      const line = Number(c.amount) + Number(c.tax);
      taxTotal += Number(c.tax);
      grandTotal += line;
      // Billed-but-not-cleared lines feed the aged balance.
      if (c.status === 'POSTED' || c.status === 'INVOICED') openCharges.push({ date: c.date, line });
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

    const billed = openCharges.reduce((s, c) => s + c.line, 0);
    const paidToDate = payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = Math.max(0, billed - paidToDate);
    const aging = this.bucketAging(openCharges, paidToDate);

    return {
      company: { id: company.id, name: company.name, tier: company.tier, status: company.status, billingEmail: company.billingEmail },
      byDepartment: [...byDeptMap.entries()].map(([department, amount]) => ({ department, amount })).sort((a, b) => b.amount - a.amount),
      byGuest: [...byGuestMap.values()].sort((a, b) => b.total - a.total),
      payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, reference: p.reference, note: p.note, paidAt: p.paidAt })),
      taxTotal,
      grandTotal,
      billed,
      paidToDate,
      outstanding,
      aging,
      chargeCount: charges.length,
    };
  }

  /** Record a payment (full or partial) against a company's account. */
  async recordPayment(
    id: string,
    dto: { amount: number; method?: PaymentMethod; reference?: string; note?: string; paidAt?: string },
    userId?: string,
  ) {
    await this.get(id);
    if (!(dto.amount > 0)) throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Payment amount must be positive.' });
    const paymentId = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO company_payments (id, company_id, amount, method, reference, note, recorded_by_user_id, paid_at, created_at)
       VALUES ($1, $2, $3, $4::"PaymentMethod", $5, $6, $7, COALESCE($8::timestamptz, now()), now())`,
      paymentId,
      id,
      dto.amount,
      dto.method ?? 'TRANSFER',
      dto.reference ?? null,
      dto.note ?? null,
      userId ?? null,
      dto.paidAt ?? null,
    );
    return this.invoice(id);
  }

  /** Settle in full: record a payment for the whole outstanding balance. */
  async settle(id: string) {
    const inv = await this.invoice(id);
    if (inv.outstanding <= 0.005) return inv;
    return this.recordPayment(id, { amount: inv.outstanding, method: 'TRANSFER', note: 'Full settlement' });
  }

  /** Accounts-receivable aging across every company with an outstanding balance. */
  async aging() {
    const [companies, charges, paymentRows] = await Promise.all([
      this.prisma.company.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.chargeLedger.findMany({
        where: { companyId: { not: null }, status: { in: ['POSTED', 'INVOICED'] } },
        select: { companyId: true, amount: true, tax: true, date: true },
      }),
      this.prisma.$queryRawUnsafe<{ company_id: string; total: string }[]>(
        `SELECT company_id, sum(amount)::numeric total FROM company_payments GROUP BY company_id`,
      ),
    ]);
    const paidByCompany = new Map(paymentRows.map((p) => [p.company_id, Number(p.total)]));

    const rows = companies
      .map((co) => {
        const open = charges.filter((c) => c.companyId === co.id).map((c) => ({ date: c.date, line: Number(c.amount) + Number(c.tax) }));
        const aging = this.bucketAging(open, paidByCompany.get(co.id) ?? 0);
        return { id: co.id, name: co.name, tier: co.tier, status: co.status, ...aging };
      })
      .filter((r) => r.outstanding > 0.005)
      .sort((a, b) => b.outstanding - a.outstanding);

    const totals = rows.reduce(
      (t, r) => ({
        current: t.current + r.current,
        days31_60: t.days31_60 + r.days31_60,
        days61_90: t.days61_90 + r.days61_90,
        days90plus: t.days90plus + r.days90plus,
        outstanding: t.outstanding + r.outstanding,
      }),
      { current: 0, days31_60: 0, days61_90: 0, days90plus: 0, outstanding: 0 },
    );
    return { companies: rows, totals };
  }
}
