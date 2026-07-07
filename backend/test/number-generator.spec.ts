import { reservationNumber, orderNumber, workOrderNumber, transactionNumber } from '../src/common/utils/number-generator';

describe('number-generator', () => {
  it('zero-pads reservation numbers to 5 digits', () => {
    expect(reservationNumber(42, 2026)).toBe('RES-2026-00042');
    expect(reservationNumber(1, 2026)).toBe('RES-2026-00001');
  });

  it('prefixes order numbers by storefront', () => {
    expect(orderNumber('RESTAURANT', 7, 2026)).toBe('REST-2026-00007');
    expect(orderNumber('LOUNGE', 7, 2026)).toBe('LNGE-2026-00007');
    expect(orderNumber('BOUTIQUE', 7, 2026)).toBe('BTQ-2026-00007');
  });

  it('formats work-order and transaction numbers', () => {
    expect(workOrderNumber(18, 2026)).toBe('WO-2026-00018');
    expect(transactionNumber(4821, 2026)).toBe('TXN-2026-04821');
  });
});
