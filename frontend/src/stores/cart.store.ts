"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Storefront } from "@/lib/cms";

/** Non-persisted UI state for the cart drawer (§15.9). */
interface CartUIState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}
export const useCartUI = create<CartUIState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));

export interface CartLine {
  menuItemId: string;
  name: string;
  unitPrice: number; // captured at add-time — immutable (Domain rule)
  quantity: number;
  notes?: string;
  storefront: Storefront;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQty: (menuItemId: string, qty: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

/**
 * Public ordering cart (§15.9). Persisted to sessionStorage — cleared after a
 * successful order submission. Prices captured at add-time and never mutated.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.menuItemId === line.menuItemId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.menuItemId === line.menuItemId ? { ...l, quantity: l.quantity + qty } : l,
              ),
            };
          }
          return { lines: [...state.lines, { ...line, quantity: qty }] };
        }),
      setQty: (menuItemId, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => l.menuItemId !== menuItemId)
              : state.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: qty } : l)),
        })),
      remove: (menuItemId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.menuItemId !== menuItemId) })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    }),
    {
      name: "aehop-cart",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
