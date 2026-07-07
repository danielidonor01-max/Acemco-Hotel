import { Injectable, NotFoundException } from '@nestjs/common';
import { Storefront } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  /** All categories + items across storefronts (management view — includes hidden). */
  listAll() {
    return this.prisma.menuCategory.findMany({
      orderBy: [{ storefront: 'asc' }, { sortOrder: 'asc' }],
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  createCategory(dto: { storefront: Storefront; name: string; sortOrder?: number }) {
    return this.prisma.menuCategory.create({ data: { storefront: dto.storefront, name: dto.name, sortOrder: dto.sortOrder ?? 0 } });
  }

  async updateCategory(id: string, dto: { name?: string; sortOrder?: number; isActive?: boolean }) {
    await this.categoryOr404(id);
    return this.prisma.menuCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    await this.categoryOr404(id);
    await this.prisma.menuCategory.delete({ where: { id } });
    return { id, deleted: true };
  }

  async createItem(dto: { categoryId: string; name: string; description?: string; price: number; tags?: string[]; isAvailable?: boolean; isHidden?: boolean }) {
    const category = await this.categoryOr404(dto.categoryId);
    const count = await this.prisma.menuItem.count({ where: { categoryId: dto.categoryId } });
    return this.prisma.menuItem.create({
      data: {
        categoryId: dto.categoryId,
        storefront: category.storefront, // inherit — keeps item/category storefront consistent
        name: dto.name,
        description: dto.description,
        price: dto.price,
        tags: dto.tags ?? [],
        isAvailable: dto.isAvailable ?? true,
        isHidden: dto.isHidden ?? false,
        sortOrder: count,
      },
    });
  }

  async updateItem(id: string, dto: { name?: string; description?: string; price?: number; tags?: string[]; isAvailable?: boolean; isHidden?: boolean }) {
    if (!(await this.prisma.menuItem.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Menu item not found.' });
    }
    return this.prisma.menuItem.update({ where: { id }, data: dto });
  }

  async deleteItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Menu item not found.' });
    // Items referenced by past orders can't be deleted (price history) — hide instead.
    if (item._count.orderItems > 0) {
      return this.prisma.menuItem.update({ where: { id }, data: { isHidden: true, isAvailable: false } });
    }
    await this.prisma.menuItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async categoryOr404(id: string) {
    const c = await this.prisma.menuCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Menu category not found.' });
    return c;
  }
}
