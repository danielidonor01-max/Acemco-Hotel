import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { workOrderNumber } from '../../common/utils/number-generator';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  listAssets() {
    return this.prisma.asset.findMany({ orderBy: { assetNumber: 'asc' } });
  }

  createAsset(dto: Prisma.AssetUncheckedCreateInput) {
    return this.prisma.asset.create({ data: dto });
  }

  async updateAsset(id: string, dto: Prisma.AssetUncheckedUpdateInput) {
    if (!(await this.prisma.asset.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'ASSET_NOT_FOUND', message: 'Asset not found.' });
    }
    return this.prisma.asset.update({ where: { id }, data: dto });
  }

  listWorkOrders() {
    return this.prisma.workOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { asset: { select: { name: true } } },
    });
  }

  async createWorkOrder(dto: { assetId?: string; type: any; priority: any; assignedTo?: string; estimatedCost: number }) {
    const count = await this.prisma.workOrder.count();
    return this.prisma.workOrder.create({
      data: { ...dto, workOrderNumber: workOrderNumber(count + 1) },
      include: { asset: { select: { name: true } } },
    });
  }

  async updateWorkOrder(id: string, dto: Prisma.WorkOrderUncheckedUpdateInput) {
    const existing = await this.prisma.workOrder.findUnique({ where: { id }, include: { asset: { select: { name: true } } } });
    if (!existing) throw new NotFoundException({ code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found.' });
    const updated = await this.prisma.workOrder.update({ where: { id }, data: dto, include: { asset: { select: { name: true } } } });
    // Post the maintenance expense to Finance when the job is completed (Domain §7).
    if (updated.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      await this.finance
        .create({
          type: 'EXPENSE',
          amount: Number(updated.estimatedCost),
          direction: 'DEBIT',
          account: 'Repairs & Maintenance',
          description: `${updated.workOrderNumber}${updated.asset ? ` · ${updated.asset.name}` : ''}`,
          date: new Date().toISOString().slice(0, 10),
          status: 'POSTED',
        })
        .catch(() => undefined);
    }
    return updated;
  }
}
