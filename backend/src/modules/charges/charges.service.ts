import { Injectable, NotFoundException } from '@nestjs/common';
import { ChargeDepartment, ChargeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TaxService } from '../tax/tax.service';
import { chargeNumber } from '../../common/utils/number-generator';

export interface PostCharge {
  reservationId?: string;
  guestId?: string;
  companyId?: string | null;
  roomId?: string | null;
  department: ChargeDepartment;
  sourceModule: string;
  referenceNumber?: string;
  description: string;
  amount: number;
  tax?: number;
  status?: ChargeStatus;
}

@Injectable()
export class ChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tax: TaxService,
  ) {}

  /**
   * The one entry point every module uses to bill a guest/company (Domain §7).
   *
   * Pass `tx` to enlist the charge in the caller's transaction, so the billable
   * action and the charge that pays for it commit or fail together — an order
   * that cannot be billed must not survive as an un-billed order.
   */
  async post(entry: PostCharge, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    // Tax is computed HERE, at the one entry point every module bills through, so
    // no caller can forget it and no caller can invent its own rate (the POS used
    // to hardcode 7.5% in the till while the ledger recorded 0). An explicit
    // `tax` still wins, for callers that have already computed it.
    const tax = entry.tax ?? (await this.tax.computeFor(entry.department, entry.amount, tx)).tax;
    const count = await db.chargeLedger.count();
    return db.chargeLedger.create({
      data: {
        chargeNumber: chargeNumber(count + 1),
        reservationId: entry.reservationId,
        guestId: entry.guestId,
        companyId: entry.companyId ?? undefined,
        roomId: entry.roomId ?? undefined,
        department: entry.department,
        sourceModule: entry.sourceModule,
        referenceNumber: entry.referenceNumber,
        description: entry.description,
        amount: entry.amount,
        tax,
        status: entry.status ?? 'POSTED',
      },
    });
  }

  list(filter: { companyId?: string; guestId?: string; reservationId?: string; status?: ChargeStatus }) {
    const where: Prisma.ChargeLedgerWhereInput = {
      ...(filter.companyId ? { companyId: filter.companyId } : {}),
      ...(filter.guestId ? { guestId: filter.guestId } : {}),
      ...(filter.reservationId ? { reservationId: filter.reservationId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
    return this.prisma.chargeLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
        room: { select: { roomNumber: true } },
      },
    });
  }

  /** All (non-void) charges for a reservation + running balance. */
  async byReservation(reservationId: string) {
    const rows = await this.prisma.chargeLedger.findMany({
      where: { reservationId, status: { not: 'VOIDED' } },
      orderBy: { createdAt: 'asc' },
    });
    const balance = rows.reduce((s, r) => s + Number(r.amount) + Number(r.tax), 0);
    return { charges: rows, balance };
  }

  async void(id: string) {
    if (!(await this.prisma.chargeLedger.findUnique({ where: { id } }))) {
      throw new NotFoundException({ code: 'CHARGE_NOT_FOUND', message: 'Charge not found.' });
    }
    return this.prisma.chargeLedger.update({ where: { id }, data: { status: 'VOIDED' } });
  }
}
