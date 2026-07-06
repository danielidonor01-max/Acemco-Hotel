import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ORDER: Record<string, number> = { IN_PROGRESS: 0, PENDING: 1, COMPLETED: 2 };

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tasks = await this.prisma.housekeepingTask.findMany({ orderBy: { createdAt: 'desc' } });
    return tasks.sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3));
  }

  create(dto: Prisma.HousekeepingTaskUncheckedCreateInput) {
    return this.prisma.housekeepingTask.create({ data: dto });
  }

  async update(id: string, dto: Prisma.HousekeepingTaskUncheckedUpdateInput) {
    if (!(await this.prisma.housekeepingTask.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Housekeeping task not found.' });
    }
    return this.prisma.housekeepingTask.update({ where: { id }, data: dto });
  }
}
