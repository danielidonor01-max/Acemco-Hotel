import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChargeDepartment, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TaxRateInput {
  name: string;
  code: string;
  rate: number;
  appliesTo: ChargeDepartment[];
  isInclusive?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

/** One tax's contribution to a charge. */
export interface TaxLine {
  code: string;
  name: string;
  rate: number;
  amount: number;
}

export interface TaxComputation {
  /** Net amount, excluding tax. */
  net: number;
  /** Total tax across all applicable rates. */
  tax: number;
  /** What the guest pays: net + tax. */
  gross: number;
  lines: TaxLine[];
}

/** Round to kobo. Money must never carry float dust into the ledger. */
const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Tax & compliance engine.
 *
 * The hotel's rates live in the `tax_rates` table, not in code. The POS used to
 * hardcode `TAX_RATE = 0.075` in the till while the backend recorded tax as 0, so
 * the cashier collected 7.5% more than the books ever saw. Everything now derives
 * from here, so one edit moves the till, the folio, Finance and the VAT return
 * together.
 */
@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = true) {
    return this.prisma.taxRate.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  /** Active rates that apply to a department. */
  private activeFor(department: ChargeDepartment, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).taxRate.findMany({
      where: { isActive: true, appliesTo: { has: department } },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * Tax for `amount` charged to `department`.
   *
   * `amount` is the listed price. For an exclusive rate (Nigerian VAT) tax is added
   * on top; for an inclusive rate the tax is back-computed out of the listed price
   * so the guest's total never changes. Credits (negative amounts, e.g. a prepaid
   * deposit) tax proportionally, which keeps a refund symmetric with its charge.
   */
  async computeFor(
    department: ChargeDepartment,
    amount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<TaxComputation> {
    const rates = await this.activeFor(department, tx);
    if (!rates.length || amount === 0) {
      return { net: money(amount), tax: 0, gross: money(amount), lines: [] };
    }

    const inclusive = rates.filter((r) => r.isInclusive);
    const exclusive = rates.filter((r) => !r.isInclusive);

    // Back any inclusive taxes out of the listed price to find the net; exclusive
    // taxes are then added on top of that net.
    const inclusiveRate = inclusive.reduce((s, r) => s + Number(r.rate), 0);
    const net = inclusive.length ? money(amount / (1 + inclusiveRate / 100)) : money(amount);

    const lineFor = (r: (typeof rates)[number]): TaxLine => ({
      code: r.code,
      name: r.name,
      rate: Number(r.rate),
      amount: money(net * (Number(r.rate) / 100)),
    });
    const lines = [...inclusive.map(lineFor), ...exclusive.map(lineFor)];
    const tax = money(lines.reduce((s, l) => s + l.amount, 0));

    // gross = net + tax holds for both kinds, because `net` already had any
    // inclusive tax removed: inclusive-only returns to the listed price, while
    // exclusive tax lands on top of it.
    return { net, tax, gross: money(net + tax), lines };
  }

  async create(dto: TaxRateInput) {
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.taxRate.findUnique({ where: { code } })) {
      throw new ConflictException({ code: 'TAX_CODE_EXISTS', message: `A tax with code ${code} already exists.` });
    }
    return this.prisma.taxRate.create({ data: { ...dto, code, rate: new Prisma.Decimal(dto.rate) } });
  }

  async update(id: string, dto: Partial<TaxRateInput>) {
    await this.get(id);
    const { code, rate, ...rest } = dto;
    return this.prisma.taxRate.update({
      where: { id },
      data: {
        ...rest,
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(rate !== undefined ? { rate: new Prisma.Decimal(rate) } : {}),
      },
    });
  }

  async get(id: string) {
    const row = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'TAX_RATE_NOT_FOUND', message: 'Tax rate not found.' });
    return row;
  }

  /**
   * Deactivate rather than delete. Historical charges cite the rate that applied
   * when they were posted; destroying it would make old filings unexplainable.
   */
  async deactivate(id: string) {
    await this.get(id);
    return this.prisma.taxRate.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * VAT return: tax collected per code and department over a period, from the
   * charge ledger (the billing source of truth). VOIDED charges are excluded.
   */
  async report(from: string, to: string) {
    const charges = await this.prisma.chargeLedger.findMany({
      where: { status: { not: 'VOIDED' }, date: { gte: new Date(from), lte: new Date(to) } },
      select: { department: true, amount: true, tax: true },
    });

    const byDepartment = new Map<string, { department: string; net: number; tax: number; gross: number; count: number }>();
    for (const c of charges) {
      const key = c.department;
      const row = byDepartment.get(key) ?? { department: key, net: 0, tax: 0, gross: 0, count: 0 };
      row.net = money(row.net + Number(c.amount));
      row.tax = money(row.tax + Number(c.tax));
      row.gross = money(row.net + row.tax);
      row.count += 1;
      byDepartment.set(key, row);
    }

    const rows = [...byDepartment.values()].sort((a, b) => b.tax - a.tax);
    return {
      from,
      to,
      totals: {
        net: money(rows.reduce((s, r) => s + r.net, 0)),
        tax: money(rows.reduce((s, r) => s + r.tax, 0)),
        gross: money(rows.reduce((s, r) => s + r.gross, 0)),
        charges: rows.reduce((s, r) => s + r.count, 0),
      },
      byDepartment: rows,
      rates: await this.list(),
    };
  }
}
