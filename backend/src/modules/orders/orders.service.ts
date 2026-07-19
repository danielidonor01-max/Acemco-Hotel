import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { OrderStatus, OrderSource, Storefront, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { orderNumber } from '../../common/utils/number-generator';
import { FinanceService } from '../finance/finance.service';
import { FoliosService } from '../folios/folios.service';
import { TaxService } from '../tax/tax.service';
import { CreateOrderDto, PublicOrderDto } from './dto/order.dto';

/** The charge department a storefront bills under — also selects its tax rates. */
const STOREFRONT_DEPT = { RESTAURANT: 'RESTAURANT', LOUNGE: 'LOUNGE', BOUTIQUE: 'BOUTIQUE' } as const;

const FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED'];
const todayISO = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly folios: FoliosService,
    private readonly tax: TaxService,
  ) {}

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
    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
    });
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
    });
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
    // Tax comes from the configured rates for this storefront's department, never a
    // constant. The till used to add a hardcoded 7.5% on screen that was never
    // billed, so the drawer and the books disagreed by the tax on every sale.
    const { tax, gross, lines: taxLines } = await this.tax.computeFor(STOREFRONT_DEPT[storefront], total);
    return { lines, subtotal: total, tax, total: gross, taxLines };
  }

  private async nextNumber(storefront: Storefront) {
    const count = await this.prisma.order.count();
    return orderNumber(storefront, count + 1);
  }

  async create(dto: CreateOrderDto, userId?: string) {
    const { lines, subtotal, tax, total } = await this.buildLines(dto.storefront, dto.items);
    const number = await this.nextNumber(dto.storefront);
    // The order and the charge that bills it commit together. Posting the charge
    // used to be fire-and-forget (`.catch(() => undefined)`), so a failed post
    // left a fulfilled, un-billed order and no trace of the lost revenue.
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: number,
          storefront: dto.storefront,
          source: dto.source,
          status: dto.source === 'INTERNAL_POS' ? 'CONFIRMED' : 'PENDING',
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          roomNumber: dto.roomNumber,
          tableNumber: dto.tableNumber,
          deliveryLocation: dto.deliveryLocation,
          specialInstructions: dto.specialInstructions,
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: total,
          handledByUserId: userId,
          items: { create: lines.map(({ name, ...l }) => l) },
        },
        include: { items: true },
      });
      if (order.roomNumber) {
        // Pass the NET: ChargesService computes the same tax for this department, so
        // the folio line (amount + tax) reconciles exactly to order.totalAmount.
        await this.folios.postOrderToRoom(order.roomNumber, order.storefront, subtotal, order.orderNumber, tx);
      }
      return order;
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
      firstName: r.guest.firstName,
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
    const { lines, subtotal, tax, total } = await this.buildLines(dto.storefront as Storefront, dto.items);
    const number = await this.nextNumber(dto.storefront as Storefront);
    // Order + room charge commit together: the guest never receives food we failed
    // to bill them for, and we never bill for food we failed to order.
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: number,
          storefront: dto.storefront as Storefront,
          source: OrderSource.ROOM_SERVICE,
          status: 'PENDING',
          guestId: check.guestId,
          customerName: check.guestName,
          roomNumber: check.roomNumber,
          specialInstructions: dto.specialInstructions,
          subtotalAmount: subtotal,
          taxAmount: tax,
          totalAmount: total,
          items: { create: lines.map(({ name, ...l }) => l) },
        },
        include: { items: true },
      });
      await this.folios.postOrderToRoom(check.roomNumber, dto.storefront as Storefront, subtotal, order.orderNumber, tx);
      return order;
    });
  }

  async advance(id: string) {
    const order = await this.get(id);
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new ConflictException({ code: 'INVALID_STATE', message: `Order is already ${order.status}.` });
    }
    const i = FLOW.indexOf(order.status);
    const next = FLOW[i + 1];
    if (next !== 'COMPLETED') {
      return this.prisma.order.update({ where: { id }, data: { status: next } });
    }
    // Recognise revenue when the order completes (Domain §7 — F&B revenue posting).
    // The status flip and the revenue line commit together: the post used to be
    // swallowed, so an order could read COMPLETED while Finance never saw the money.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id }, data: { status: next } });
      // Revenue is recognised NET of tax — VAT is collected on behalf of the state,
      // not earned. Booking the gross would overstate revenue by the tax and make
      // the VAT return impossible to reconcile against Finance.
      const net = Number(order.subtotalAmount) || Number(order.totalAmount) - Number(order.taxAmount);
      await this.finance.create(
        {
          type: 'REVENUE',
          amount: net,
          direction: 'CREDIT',
          account: 'F&B Revenue',
          description: `Order ${order.orderNumber}`,
          date: todayISO(),
          status: 'POSTED',
        },
        tx,
      );
      const taxCollected = Number(order.taxAmount);
      if (taxCollected > 0) {
        await this.finance.create(
          {
            type: 'REVENUE',
            amount: taxCollected,
            direction: 'CREDIT',
            account: 'Tax Payable',
            description: `Tax collected · ${order.orderNumber}`,
            date: todayISO(),
            status: 'POSTED',
          },
          tx,
        );
      }
      return updated;
    });
  }

  async cancel(id: string) {
    const order = await this.get(id);
    if (order.status === 'COMPLETED') throw new ConflictException({ code: 'INVALID_STATE', message: 'Completed orders cannot be cancelled.' });
    return this.prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
