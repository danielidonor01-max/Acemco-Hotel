import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, LeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  listEmployees() {
    return this.prisma.employee.findMany({ orderBy: { employeeNumber: 'asc' } });
  }

  createEmployee(dto: Prisma.EmployeeUncheckedCreateInput) {
    return this.prisma.employee.create({ data: dto });
  }

  async updateEmployee(id: string, dto: Prisma.EmployeeUncheckedUpdateInput) {
    if (!(await this.prisma.employee.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found.' });
    }
    return this.prisma.employee.update({ where: { id }, data: dto });
  }

  listLeave() {
    return this.prisma.leaveRequest.findMany({
      orderBy: { startDate: 'desc' },
      include: { employee: { select: { name: true } } },
    });
  }

  createLeave(dto: { employeeId: string; type: any; startDate: string; endDate: string; days: number }) {
    return this.prisma.leaveRequest.create({
      data: { ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
      include: { employee: { select: { name: true } } },
    });
  }

  async setLeaveStatus(id: string, status: LeaveStatus) {
    if (!(await this.prisma.leaveRequest.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'LEAVE_NOT_FOUND', message: 'Leave request not found.' });
    }
    return this.prisma.leaveRequest.update({ where: { id }, data: { status }, include: { employee: { select: { name: true } } } });
  }
}
