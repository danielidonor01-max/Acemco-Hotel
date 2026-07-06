import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PayrollStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.payrollPeriod.findMany({ orderBy: { startDate: 'desc' } });
  }

  create(dto: Prisma.PayrollPeriodUncheckedCreateInput) {
    return this.prisma.payrollPeriod.create({ data: dto });
  }

  async setStatus(id: string, status: PayrollStatus) {
    if (!(await this.prisma.payrollPeriod.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'PERIOD_NOT_FOUND', message: 'Payroll period not found.' });
    }
    return this.prisma.payrollPeriod.update({ where: { id }, data: { status } });
  }
}
