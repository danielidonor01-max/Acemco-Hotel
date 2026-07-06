import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryDepartment, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(department?: InventoryDepartment) {
    return this.prisma.inventoryItem.findMany({
      where: department ? { department } : {},
      orderBy: { name: 'asc' },
    });
  }

  create(dto: Prisma.InventoryItemUncheckedCreateInput) {
    return this.prisma.inventoryItem.create({ data: dto });
  }

  async update(id: string, dto: Prisma.InventoryItemUncheckedUpdateInput) {
    await this.getOr404(id);
    return this.prisma.inventoryItem.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.getOr404(id);
    await this.prisma.inventoryItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getOr404(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Inventory item not found.' });
    return item;
  }
}
