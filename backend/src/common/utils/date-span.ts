import { BadRequestException } from '@nestjs/common';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a check-in/check-out pair from query params, throwing a clean 400
 * rather than letting a bad value through.
 *
 * A malformed date slips past a naive `new Date(a) <= new Date(b)` guard —
 * `Invalid Date` makes the comparison NaN, which is false — and then reaches the
 * availability/pricing engine as an Invalid Date and throws an unhandled 500 at
 * the caller. Several endpoints had this; one validator keeps them consistent.
 */
export function assertValidDateSpan(checkIn?: string, checkOut?: string): void {
  if (!checkIn || !checkOut) {
    throw new BadRequestException({ code: 'DATES_REQUIRED', message: 'checkIn and checkOut are required.' });
  }
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  if (!YMD.test(checkIn) || !YMD.test(checkOut) || Number.isNaN(+ci) || Number.isNaN(+co)) {
    throw new BadRequestException({ code: 'INVALID_DATES', message: 'Use valid dates in YYYY-MM-DD format.' });
  }
  if (co <= ci) {
    throw new BadRequestException({ code: 'INVALID_DATES', message: 'checkOut must be after checkIn.' });
  }
}
