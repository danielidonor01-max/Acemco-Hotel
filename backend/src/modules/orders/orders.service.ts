import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { OrderStatus, OrderSource, Storefront, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { orderNumber } from '../../common/utils/number-generator';
import { CreateOrderDto, PublicOrderDto } from './dto/order.dto';

const FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED'];

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public menu for a storefront — excludes hidden items (Domain rule). */
  publicMenu(storefront: Storefront) {
    return this.prisma.menuCategory.findMany({
      where: { storefront, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isHidden: false },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  list(filter: { storefront?: Storefront; status?: OrderStatus }) {
    const where: Prisma.OrderWhereInput = {
      ...(filter.storefront ? { storefront: filter.storefront } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
    return this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, include: { items: true } });
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    return order;
  }

  private async buildLines(storefront: Storefront, items: { menuItemId: string; quantity: number; notes?: string }[]) {
    const ids = items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({ where: { id: { in: ids } } });
    const byId = new Map(menuItems.map((m) => [m.id, m]));

    let total = 0;
    const lines = items.map((i) => {
      const mi = byId.get(i.menuItemId);
      if (!mi) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: `Menu item ${i.menuItemId} not found.` });
      if (mi.storefront !== storefront) throw new UnprocessableEntityException({ code: 'WRONG_STOREFRONT', message: `${mi.name} is not on this menu.` });
      // Domain rule 11: unavailable items cannot be added.
      if (!mi.isAvailable) throw new UnprocessableEntityException({ code: 'ITEM_UNAVAILABLE', message: `${mi.name} is currently unavailable.` });
      const unitPrice = Number(mi.price); // Rule 12: captured at order time — immutable.
      const subtotal = unitPrice * i.quantity;
      total += subtotal;
      return { menuItemId: mi.id, name: mi.name, quantity: i.quantity, unitPrice, subtotal, notes: i.notes };
    });
    return { lines, total };
  }

  private async nextNumber(storefront: Storefront) {
    const count = await this.prisma.order.count();
    return orderNumber(storefront, count + 1);
  }

  async create(dto: CreateOrderDto, userId?: string) {
    const { lines, total } = await this.buildLines(dto.storefront, dto.items);
    return this.prisma.order.create({
      data: {
        orderNumber: await this.nextNumber(dto.storefront),
        storefront: dto.storefront,
        source: dto.source,
        status: dto.source === 'INTERNAL_POS' ? 'CONFIRMED' : 'PENDING',
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        roomNumber: dto.roomNumber,
        tableNumber: dto.tableNumber,
        deliveryLocation: dto.deliveryLocation,
        specialInstructions: dto.specialInstructions,
        totalAmount: total,
        handledByUserId: userId,
        items: { create: lines.map(({ name, ...l }) => l) },
      },
      include: { items: true },
    });
  }

  /**
   * Confirm the requester is a checked-in guest in the given room (management
   * confirmation before ordering). Matches an active CHECKED_IN reservation by
   * room number + guest last name.
   */
  async verifyInHouse(roomNumber: string, lastName: string) {
    const r = await this.prisma.reservation.findFirst({
      where: {
        status: 'CHECKED_IN',
        room: { roomNumber },
        guest: { lastName: { equals: lastName.trim(), mode: 'insensitive' } },
      },
      include: { guest: true, room: true },
    });
    if (!r || !r.room) return { verified: false as const };
    return {
      verified: true as const,
      guestId: r.guestId,
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      roomNumber: r.room.roomNumber,
    };
  }

  /**
   * Website order — room service for a verified in-house guest only.
   * Saved FIRST as PENDING (Domain rule / Blueprint §17), then WhatsApp handoff.
   */
  async createPublic(dto: PublicOrderDto) {
    const check = await this.verifyInHouse(dto.roomNumber, dto.lastName);
    if (!check.verified) {
      throw new UnprocessableEntityException({
        code: 'GUEST_NOT_VERIFIED',
        message: 'Ordering is available to checked-in guests. We could not verify that room and name.',
      });
    }
    const { lines, total } = await this.buildLines(dto.storefront as Storefront, dto.items);
    return this.prisma.order.create({
      data: {
        orderNumber: await this.nextNumber(dto.storefront as Storefront),
        storefront: dto.storefront as Storefront,
        source: OrderSource.ROOM_SERVICE,
        status: 'PENDING',
        guestId: check.guestId,
        customerName: check.guestName,
        roomNumber: check.roomNumber,
        specialInstructions: dto.specialInstructions,
        totalAmount: total,
        items: { create: lines.map(({ name, ...l }) => l) },
      },
      include: { items: true },
    });
  }

  async advance(id: string) {
    const order = await this.get(id);
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new ConflictException({ code: 'INVALID_STATE', message: `Order is already ${order.status}.` });
    }
    const i = FLOW.indexOf(order.status);
    const next = FLOW[i + 1];
    return this.prisma.order.update({ where: { id }, data: { status: next } });
  }

  async cancel(id: string) {
    const order = await this.get(id);
    if (order.status === 'COMPLETED') throw new ConflictException({ code: 'INVALID_STATE', message: 'Completed orders cannot be cancelled.' });
    return this.prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
