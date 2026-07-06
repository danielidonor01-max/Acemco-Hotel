import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { transactionNumber } from '../../common/utils/number-generator';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter: { type?: TransactionType; status?: TransactionStatus }) {
    return this.prisma.financeTransaction.findMany({
      where: {
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async create(dto: { type: TransactionType; amount: number; direction: any; account: string; description: string; date: string; status?: TransactionStatus }) {
    const count = await this.prisma.financeTransaction.count();
    return this.prisma.financeTransaction.create({
      data: {
        ...dto,
        transactionNumber: transactionNumber(count + 1),
        date: new Date(dto.date),
      },
    });
  }

  async setStatus(id: string, status: TransactionStatus) {
    if (!(await this.prisma.financeTransaction.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'TXN_NOT_FOUND', message: 'Transaction not found.' });
    }
    return this.prisma.financeTransaction.update({ where: { id }, data: { status } });
  }

  /** Posted revenue per day for the last `days` days (fills gaps with 0). */
  async revenueDaily(days = 7) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const rows = await this.prisma.financeTransaction.findMany({
      where: { type: 'REVENUE', status: 'POSTED', date: { gte: since } },
      select: { date: true, amount: true },
    });
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const key = r.date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + Number(r.amount));
    }
    const out: { date: string; amount: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, amount: byDay.get(key) ?? 0 });
    }
    return out;
  }

  /** Revenue / expense roll-up (POSTED only) for Finance dashboard + Reports. */
  async summary() {
    const posted = await this.prisma.financeTransaction.findMany({ where: { status: 'POSTED' } });
    const sum = (t: TransactionType) => posted.filter((x) => x.type === t).reduce((s, x) => s + Number(x.amount), 0);
    const revenue = sum('REVENUE');
    const expense = sum('EXPENSE');
    const payroll = sum('PAYROLL');
    const refund = sum('REFUND');
    const byAccount: Record<string, number> = {};
    for (const t of posted) byAccount[t.account] = (byAccount[t.account] ?? 0) + (t.direction === 'CREDIT' ? Number(t.amount) : -Number(t.amount));
    return { revenue, expense, payroll, refund, net: revenue - expense - payroll - refund, byAccount, pending: (await this.prisma.financeTransaction.count({ where: { status: 'PENDING' } })) };
  }
}
