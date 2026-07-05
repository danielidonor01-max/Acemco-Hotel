"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type Order, type OrderStatus, nextStatus } from "@/lib/orders";

/**
 * Shared orders store (interlock). Persisted to localStorage so an order placed
 * on the public site is visible in the management Orders view — standing in for
 * the backend as the single source of truth until the API is wired.
 */
interface OrdersState {
  orders: Order[];
  addOrder: (order: Order) => void;
  advance: (id: string) => void;
  cancel: (id: string) => void;
  setStatus: (id: string, status: OrderStatus) => void;
}

const SEED: Order[] = [
  {
    id: "ord-1", orderNumber: "REST-2026-00219", storefront: "RESTAURANT", source: "INTERNAL_POS",
    status: "PREPARING", tableNumber: "T04",
    lines: [
      { menuItemId: "r-4", name: "Jollof Rice & Grilled Chicken", quantity: 2, unitPrice: 9500 },
      { menuItemId: "r-1", name: "Pepper Soup, Catfish", quantity: 1, unitPrice: 6500 },
    ],
    totalAmount: 25500, createdAt: "2026-07-05T12:20:00.000Z",
  },
  {
    id: "ord-2", orderNumber: "REST-2026-00220", storefront: "RESTAURANT", source: "ROOM_SERVICE",
    status: "CONFIRMED", roomNumber: "512", customerName: "James Morrison",
    lines: [{ menuItemId: "r-7", name: "Ribeye, Pepper Glaze", quantity: 1, unitPrice: 21000 }],
    totalAmount: 21000, createdAt: "2026-07-05T13:05:00.000Z",
  },
  {
    id: "ord-3", orderNumber: "LNGE-2026-00061", storefront: "LOUNGE", source: "WEBSITE",
    status: "PENDING", customerName: "Adaeze Obi", customerPhone: "+234 803 111 2222", deliveryLocation: "Poolside",
    lines: [
      { menuItemId: "l-1", name: "Marina Sundown", quantity: 2, unitPrice: 8000 },
      { menuItemId: "l-4", name: "Peppered Snails", quantity: 1, unitPrice: 8500 },
    ],
    totalAmount: 24500, createdAt: "2026-07-05T18:40:00.000Z",
  },
];

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: SEED,
      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      advance: (id) =>
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== id) return o;
            const n = nextStatus(o.status);
            return n ? { ...o, status: n } : o;
          }),
        })),
      cancel: (id) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status: "CANCELLED" } : o)) })),
      setStatus: (id, status) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
    }),
    { name: "aehop-orders", storage: createJSONStorage(() => localStorage) },
  ),
);
