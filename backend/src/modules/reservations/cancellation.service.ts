import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const money = (n: number) => Math.round(n * 100) / 100;
const MS_PER_HOUR = 3_600_000;

export interface CancellationPolicy {
  freeUntilHours: number;
  lateFeePercent: number;
  noShowFeePercent: number;
  depositRefundable: boolean;
}

export interface CancellationOutcome {
  /** Fee the guest owes for cancelling/not arriving. */
  fee: number;
  /** Deposit put toward that fee. */
  depositApplied: number;
  /** Deposit coming back to the guest. */
  refundDue: number;
  /** Still owed after the deposit — chase this. */
  balanceOwed: number;
  free: boolean;
  hoursBeforeCheckIn: number;
  reasonForFee: string;
}

const DEFAULTS: CancellationPolicy = {
  freeUntilHours: 48,
  lateFeePercent: 50,
  noShowFeePercent: 100,
  depositRefundable: true,
};

/**
 * Works out what a cancellation or no-show costs.
 *
 * Cancelling used to just flip a status: no fee was ever charged, and a deposit
 * was neither forfeited nor refunded — it was simply lost track of, which is a
 * dispute waiting to happen. The terms are settings rather than constants because
 * "free until 48 hours, then 50%" is a commercial decision the hotel changes.
 */
@Injectable()
export class CancellationService {
  constructor(private readonly prisma: PrismaService) {}

  async policy(): Promise<CancellationPolicy> {
    try {
      const s = await this.prisma.setting.findUnique({ where: { id: 'hotel' } });
      if (!s) return DEFAULTS;
      return {
        freeUntilHours: s.cancellationFreeUntilHours,
        lateFeePercent: Number(s.cancellationLateFeePercent),
        noShowFeePercent: Number(s.noShowFeePercent),
        depositRefundable: s.depositRefundable,
      };
    } catch {
      return DEFAULTS;
    }
  }

  /**
   * Pure money maths, so it can be shown to a guest BEFORE they confirm and then
   * charged identically — a quoted fee that differs from the charged one is worse
   * than no quote.
   */
  compute(
    policy: CancellationPolicy,
    opts: { total: number; deposit: number; checkInDate: Date; now?: Date; kind: 'CANCEL' | 'NO_SHOW' },
  ): CancellationOutcome {
    const now = opts.now ?? new Date();
    const hoursBeforeCheckIn = Math.floor((+opts.checkInDate - +now) / MS_PER_HOUR);

    // A no-show is never "free" — the room was held all night and sold to nobody.
    const isFree = opts.kind === 'CANCEL' && hoursBeforeCheckIn >= policy.freeUntilHours;
    const percent = opts.kind === 'NO_SHOW' ? policy.noShowFeePercent : isFree ? 0 : policy.lateFeePercent;
    const fee = money(Math.max(0, opts.total) * (percent / 100));

    const deposit = Math.max(0, opts.deposit);
    // On a free cancellation the deposit only comes back if the policy says so.
    const keepDeposit = !policy.depositRefundable;
    const depositApplied = money(Math.min(deposit, keepDeposit ? deposit : fee));
    const refundDue = keepDeposit ? 0 : money(deposit - depositApplied);
    const balanceOwed = money(Math.max(0, fee - depositApplied));

    const reasonForFee =
      opts.kind === 'NO_SHOW'
        ? `No-show — ${percent}% of the booking`
        : isFree
          ? `Cancelled ${hoursBeforeCheckIn}h before check-in — within the free window (${policy.freeUntilHours}h)`
          : `Cancelled ${hoursBeforeCheckIn}h before check-in — inside the ${policy.freeUntilHours}h window, ${percent}% applies`;

    return { fee, depositApplied, refundDue, balanceOwed, free: fee === 0, hoursBeforeCheckIn, reasonForFee };
  }

  /** What cancelling this reservation right now would cost — for the confirm dialog. */
  async preview(reservationId: string, kind: 'CANCEL' | 'NO_SHOW' = 'CANCEL') {
    const r = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!r) return null;
    const policy = await this.policy();
    return {
      policy,
      ...this.compute(policy, {
        total: Number(r.totalAmount),
        deposit: Number(r.depositAmount),
        checkInDate: r.checkInDate,
        kind,
      }),
    };
  }
}
