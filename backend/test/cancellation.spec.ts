import { CancellationService, type CancellationPolicy } from '../src/modules/reservations/cancellation.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Cancellation decides whether a guest's deposit comes back. It has to be exact,
 * and it has to give the same answer when previewed as when charged.
 */
describe('CancellationService.compute', () => {
  const svc = new CancellationService({} as unknown as PrismaService);
  const policy: CancellationPolicy = {
    freeUntilHours: 48,
    lateFeePercent: 50,
    noShowFeePercent: 100,
    depositRefundable: true,
  };
  const NOW = new Date('2026-07-17T12:00:00Z');
  const inHours = (h: number) => new Date(+NOW + h * 3_600_000);

  it('is free outside the window, and returns the deposit in full', () => {
    const r = svc.compute(policy, { total: 100_000, deposit: 20_000, checkInDate: inHours(72), now: NOW, kind: 'CANCEL' });
    expect(r.free).toBe(true);
    expect(r.fee).toBe(0);
    expect(r.refundDue).toBe(20_000);
    expect(r.balanceOwed).toBe(0);
  });

  it('charges the late fee inside the window and nets the deposit against it', () => {
    // 24h before, 50% of 100,000 = 50,000 fee. Deposit 20,000 covers part of it.
    const r = svc.compute(policy, { total: 100_000, deposit: 20_000, checkInDate: inHours(24), now: NOW, kind: 'CANCEL' });
    expect(r.free).toBe(false);
    expect(r.fee).toBe(50_000);
    expect(r.depositApplied).toBe(20_000);
    expect(r.refundDue).toBe(0);
    expect(r.balanceOwed).toBe(30_000);
  });

  it('refunds the remainder when the deposit exceeds the fee', () => {
    const r = svc.compute(policy, { total: 40_000, deposit: 30_000, checkInDate: inHours(24), now: NOW, kind: 'CANCEL' });
    expect(r.fee).toBe(20_000);
    expect(r.depositApplied).toBe(20_000);
    expect(r.refundDue).toBe(10_000);
    expect(r.balanceOwed).toBe(0);
  });

  it('treats the boundary as free — exactly 48h still counts', () => {
    const r = svc.compute(policy, { total: 100_000, deposit: 0, checkInDate: inHours(48), now: NOW, kind: 'CANCEL' });
    expect(r.free).toBe(true);
  });

  it('never treats a no-show as free, however early the booking was made', () => {
    // The room was held all night and sold to nobody — the free window is irrelevant.
    const r = svc.compute(policy, { total: 100_000, deposit: 0, checkInDate: inHours(72), now: NOW, kind: 'NO_SHOW' });
    expect(r.free).toBe(false);
    expect(r.fee).toBe(100_000);
  });

  it('applies the deposit to a no-show fee', () => {
    const r = svc.compute(policy, { total: 65_000, deposit: 20_000, checkInDate: inHours(-2), now: NOW, kind: 'NO_SHOW' });
    expect(r.fee).toBe(65_000);
    expect(r.depositApplied).toBe(20_000);
    expect(r.balanceOwed).toBe(45_000);
  });

  it('keeps the deposit when the policy says it is non-refundable', () => {
    const strict = { ...policy, depositRefundable: false };
    const r = svc.compute(strict, { total: 100_000, deposit: 20_000, checkInDate: inHours(72), now: NOW, kind: 'CANCEL' });
    expect(r.fee).toBe(0); // still a free cancellation…
    expect(r.refundDue).toBe(0); // …but the deposit is kept, per policy
    expect(r.depositApplied).toBe(20_000);
  });

  it('handles a booking with no deposit', () => {
    const r = svc.compute(policy, { total: 100_000, deposit: 0, checkInDate: inHours(1), now: NOW, kind: 'CANCEL' });
    expect(r.fee).toBe(50_000);
    expect(r.depositApplied).toBe(0);
    expect(r.balanceOwed).toBe(50_000);
    expect(r.refundDue).toBe(0);
  });

  it('handles a cancellation after check-in time has passed', () => {
    const r = svc.compute(policy, { total: 100_000, deposit: 0, checkInDate: inHours(-5), now: NOW, kind: 'CANCEL' });
    expect(r.hoursBeforeCheckIn).toBe(-5);
    expect(r.fee).toBe(50_000);
  });

  it('respects a 0% late fee — a fully flexible hotel', () => {
    const flexible = { ...policy, lateFeePercent: 0 };
    const r = svc.compute(flexible, { total: 100_000, deposit: 15_000, checkInDate: inHours(2), now: NOW, kind: 'CANCEL' });
    expect(r.fee).toBe(0);
    expect(r.refundDue).toBe(15_000);
  });

  it('explains itself, so the fee can be defended to a guest', () => {
    const r = svc.compute(policy, { total: 100_000, deposit: 0, checkInDate: inHours(10), now: NOW, kind: 'CANCEL' });
    expect(r.reasonForFee).toContain('10h before check-in');
    expect(r.reasonForFee).toContain('50%');
  });

  it('rounds to kobo', () => {
    const r = svc.compute({ ...policy, lateFeePercent: 33.33 }, { total: 65_000, deposit: 0, checkInDate: inHours(1), now: NOW, kind: 'CANCEL' });
    expect(r.fee).toBe(21_664.5);
  });
});
