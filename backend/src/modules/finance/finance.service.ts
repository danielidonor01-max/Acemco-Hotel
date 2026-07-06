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
