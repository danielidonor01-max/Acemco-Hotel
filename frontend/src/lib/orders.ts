/**
 * Unified order model — the heart of the reservation↔ordering interlock.
 * One shape for Restaurant / Lounge orders regardless of source
 * (Domain §4.1). Website orders and POS orders flow through the same pipeline.
 */
import type { Storefront } from "./cms";

export type OrderStatus =
  | "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED" | "COMPLETED" | "CANCELLED";

export type OrderSource = "WEBSITE" | "INTERNAL_POS" | "ROOM_SERVICE";

export interface OrderLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number; // captured at order time — immutable (Domain rule)
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  storefront: Storefront;
  source: OrderSource;
  status: OrderStatus;
  customerName?: string;
  customerPhone?: string;
  roomNumber?: string;
  tableNumber?: string;
  deliveryLocation?: string;
  specialInstructions?: string;
  lines: OrderLine[];
  totalAmount: number;
  createdAt: string; // ISO
}

/** The order lifecycle, in order (Domain §4.1). */
export const ORDER_FLOW: OrderStatus[] = [
  "PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED", "COMPLETED",
];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status);
  if (i < 0 || i >= ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
}

export function orderTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
