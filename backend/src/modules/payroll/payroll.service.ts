import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PayrollStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  list() {
    return this.prisma.payrollPeriod.findMany({ orderBy: { startDate: 'desc' } });
  }

  create(dto: Prisma.PayrollPeriodUncheckedCreateInput) {
    return this.prisma.payrollPeriod.create({ data: dto });
  }

  async setStatus(id: string, status: PayrollStatus) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException({ code: 'PERIOD_NOT_FOUND', message: 'Payroll period not found.' });
    const updated = await this.prisma.payrollPeriod.update({ where: { id }, data: { status } });
    // Post the salaries expense when a period is marked PAID.
    if (status === 'PAID' && period.status !== 'PAID') {
      await this.finance
        .create({
          type: 'PAYROLL',
          amount: Number(period.totalNet),
          direction: 'DEBIT',
          account: 'Salaries',
          description: `${period.periodName} payroll`,
          date: new Date().toISOString().slice(0, 10),
          status: 'POSTED',
        })
        .catch(() => undefined);
    }
    return updated;
  }
}
