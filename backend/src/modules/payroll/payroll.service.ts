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

    // Marking a period PAID and booking the salaries expense commit together. The
    // post was swallowed before, so payroll could read PAID while Finance never
    // recorded the outflow — the single largest expense line, silently missing.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payrollPeriod.update({ where: { id }, data: { status } });
      if (status === 'PAID' && period.status !== 'PAID') {
        await this.finance.create(
          {
            type: 'PAYROLL',
            amount: Number(period.totalNet),
            direction: 'DEBIT',
            account: 'Salaries',
            description: `${period.periodName} payroll`,
            date: new Date().toISOString().slice(0, 10),
            status: 'POSTED',
          },
          tx,
        );
      }
      return updated;
    });
  }
}
