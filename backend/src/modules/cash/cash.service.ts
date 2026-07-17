import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CashDirection, CashStation, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const money = (n: number) => Math.round(n * 100) / 100;

export interface CashPayment {
  station: CashStation;
  method: PaymentMethod;
  amount: number;
  reason: string;
  reference?: string;
  userId?: string;
}

/**
 * Cash drawer and shift reconciliation.
 *
 * A cash business with no float, no shift, and no count is where money quietly
 * goes missing and nobody can prove it either way. A shift makes one drawer
 * accountable to one person: open it with the float that's in it, every cash
 * payment attaches to it, and at close the physical count is checked against what
 * the system says should be there. The difference is the over/short — the number
 * a manager actually needs.
 */
@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private readonly prisma: PrismaService) {}

  currentShift(station: CashStation) {
    return this.prisma.cashShift.findFirst({ where: { station, status: 'OPEN' } });
  }

  /** Open shifts across all stations — the manager's at-a-glance view. */
  openShifts() {
    return this.prisma.cashShift.findMany({ where: { status: 'OPEN' }, orderBy: { openedAt: 'asc' } });
  }

  async openShift(station: CashStation, openingFloat: number, userId: string) {
    if (openingFloat < 0) throw new ConflictException({ code: 'INVALID_FLOAT', message: 'Opening float cannot be negative.' });
    // One drawer per station: two open shifts would both claim the same physical
    // cash and neither could be reconciled. A DB unique index backs this up too.
    if (await this.currentShift(station)) {
      throw new ConflictException({ code: 'SHIFT_ALREADY_OPEN', message: `A ${station.toLowerCase()} shift is already open. Close it before opening another.` });
    }
    return this.prisma.cashShift.create({
      data: { station, openingFloat, openedByUserId: userId, status: 'OPEN' },
    });
  }

  /**
   * Attach a payment to the open shift for its station.
   *
   * Never rejects: money coming in must always be recordable. If no shift is open
   * the movement is still written with shiftId=null, so it surfaces as
   * unattributed cash on the report rather than vanishing — the failure is a
   * missing shift, and hiding the cash would only compound it. Called by checkout
   * and POS, so it must not throw into a billing transaction.
   */
  async recordPayment(p: CashPayment, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const shift = await db.cashShift.findFirst({ where: { station: p.station, status: 'OPEN' } });
    if (!shift && p.method === 'CASH') {
      this.logger.warn(`Cash payment of ${p.amount} at ${p.station} with no open shift — recorded as unattributed. Open a shift so the drawer reconciles.`);
    }
    return db.cashMovement.create({
      data: {
        shiftId: shift?.id ?? null,
        station: p.station,
        direction: 'IN',
        method: p.method,
        amount: money(p.amount),
        reason: p.reason,
        reference: p.reference,
        createdByUserId: p.userId,
      },
    });
  }

  /** A manual movement — a cash payout, a drop to the safe, a correction. */
  async recordMovement(shiftId: string, dto: { direction: CashDirection; amount: number; reason: string; method?: PaymentMethod; userId?: string }) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException({ code: 'SHIFT_NOT_FOUND', message: 'Shift not found.' });
    if (shift.status !== 'OPEN') throw new ConflictException({ code: 'SHIFT_CLOSED', message: 'That shift is already closed.' });
    if (dto.amount <= 0) throw new ConflictException({ code: 'INVALID_AMOUNT', message: 'Amount must be greater than zero.' });
    return this.prisma.cashMovement.create({
      data: {
        shiftId,
        station: shift.station,
        direction: dto.direction,
        method: dto.method ?? 'CASH',
        amount: money(dto.amount),
        reason: dto.reason,
        createdByUserId: dto.userId,
      },
    });
  }

  /** Cash owed to the drawer right now: float + cash in − cash out. */
  private async expectedCash(shift: { id: string; openingFloat: Prisma.Decimal }) {
    const moves = await this.prisma.cashMovement.findMany({ where: { shiftId: shift.id } });
    // Only CASH touches the drawer — filter here too, not just in the query, so the
    // rule holds even if the fetch changes. Card/transfer are takings, not till cash.
    const cash = moves.filter((m) => m.method === 'CASH');
    const inflow = cash.filter((m) => m.direction === 'IN').reduce((s, m) => s + Number(m.amount), 0);
    const outflow = cash.filter((m) => m.direction === 'OUT').reduce((s, m) => s + Number(m.amount), 0);
    return money(Number(shift.openingFloat) + inflow - outflow);
  }

  async closeShift(shiftId: string, countedCash: number, userId: string, notes?: string) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException({ code: 'SHIFT_NOT_FOUND', message: 'Shift not found.' });
    if (shift.status !== 'OPEN') throw new ConflictException({ code: 'SHIFT_CLOSED', message: 'That shift is already closed.' });
    if (countedCash < 0) throw new ConflictException({ code: 'INVALID_COUNT', message: 'Counted cash cannot be negative.' });

    const expected = await this.expectedCash(shift);
    const overShort = money(countedCash - expected);
    return this.prisma.cashShift.update({
      where: { id: shiftId },
      data: {
        status: 'CLOSED',
        countedCash: money(countedCash),
        expectedCash: expected,
        overShort,
        closedByUserId: userId,
        closedAt: new Date(),
        notes,
      },
    });
  }

  /** Full detail for one shift: totals, method breakdown, and the movements. */
  async shiftDetail(shiftId: string) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId }, include: { movements: { orderBy: { createdAt: 'asc' } } } });
    if (!shift) throw new NotFoundException({ code: 'SHIFT_NOT_FOUND', message: 'Shift not found.' });

    const byMethod: Record<string, number> = {};
    let cashIn = 0;
    let cashOut = 0;
    for (const m of shift.movements) {
      const amt = Number(m.amount);
      if (m.direction === 'IN') byMethod[m.method] = money((byMethod[m.method] ?? 0) + amt);
      if (m.method === 'CASH') { if (m.direction === 'IN') cashIn += amt; else cashOut += amt; }
    }
    const expected = money(Number(shift.openingFloat) + cashIn - cashOut);
    return {
      ...shift,
      summary: {
        openingFloat: Number(shift.openingFloat),
        cashIn: money(cashIn),
        cashOut: money(cashOut),
        // For an open shift this is the running expectation; for a closed one it's frozen.
        expectedCash: shift.status === 'OPEN' ? expected : Number(shift.expectedCash),
        byMethod,
      },
    };
  }

  list(limit = 30) {
    return this.prisma.cashShift.findMany({ orderBy: { openedAt: 'desc' }, take: Math.min(limit, 90) });
  }

  /** Cash taken with no shift open — a reconciliation gap the manager should chase. */
  unattributed() {
    return this.prisma.cashMovement.findMany({
      where: { shiftId: null, method: 'CASH' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
