/** Sequential reference-number helpers (Blueprint common/utils). */
const pad = (n: number) => String(n).padStart(5, '0');

export function reservationNumber(seq: number, year = new Date().getFullYear()): string {
  return `RES-${year}-${pad(seq)}`;
}
export function orderNumber(storefront: 'RESTAURANT' | 'LOUNGE' | 'BOUTIQUE', seq: number, year = new Date().getFullYear()): string {
  const prefix = storefront === 'LOUNGE' ? 'LNGE' : storefront === 'BOUTIQUE' ? 'BTQ' : 'REST';
  return `${prefix}-${year}-${pad(seq)}`;
}
export function workOrderNumber(seq: number, year = new Date().getFullYear()): string {
  return `WO-${year}-${pad(seq)}`;
}
export function transactionNumber(seq: number, year = new Date().getFullYear()): string {
  return `TXN-${year}-${pad(seq)}`;
}
