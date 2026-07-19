"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Read-state for the header notifications.
 *
 * The notifications themselves aren't stored messages — they're live action-item
 * counts derived from the daily brief (overdue checkouts, pending reservations…).
 * So "read" can't mean "delete"; it means "I've seen this level and don't need the
 * badge shouting about it." We remember, per notification key, the count the user
 * last acknowledged. A notification counts as unread only while its current count
 * is HIGHER than what was acknowledged — so clearing the badge is honest: it comes
 * straight back the moment a new item pushes the count above the seen mark, and it
 * naturally stays clear as items get resolved and the count falls.
 *
 * Kept in localStorage so it survives reloads (per browser, which is right for a
 * shared front-desk machine — acknowledging isn't a cross-device inbox).
 */
interface NotificationsState {
  /** notification key → the count that was last marked read. */
  acknowledged: Record<string, number>;
  /** Mark a single notification read at its current count. */
  markRead: (key: string, count: number) => void;
  /** Mark every currently-shown notification read at its current count. */
  markAllRead: (items: { key: string; count: number }[]) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      acknowledged: {},
      markRead: (key, count) =>
        set((s) => ({ acknowledged: { ...s.acknowledged, [key]: count } })),
      markAllRead: (items) =>
        set((s) => {
          const next = { ...s.acknowledged };
          for (const it of items) next[it.key] = it.count;
          return { acknowledged: next };
        }),
    }),
    { name: "aehop-notif-read" },
  ),
);

/** True when the current count exceeds what was last acknowledged for this key. */
export const isUnread = (acknowledged: Record<string, number>, key: string, count: number) =>
  count > (acknowledged[key] ?? 0);
