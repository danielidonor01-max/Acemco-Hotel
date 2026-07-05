"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { rooms as seedRooms, type Room, type RoomStatus } from "@/lib/mock";

/**
 * Shared room-status store (interlock). Reception check-in/out drives room
 * status per domain events (checkin → OCCUPIED, checkout → CLEANING), and the
 * Rooms board + availability reads reflect it live. Backend replaces this later.
 */
interface RoomsState {
  rooms: Room[];
  setStatus: (roomId: string, status: RoomStatus) => void;
  availableCountByType: (roomTypeSlug: string) => number;
}

export const useRooms = create<RoomsState>()(
  persist(
    (set, get) => ({
      rooms: seedRooms,
      setStatus: (roomId, status) =>
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, status } : r)) })),
      availableCountByType: (roomTypeSlug) =>
        get().rooms.filter((r) => r.roomTypeSlug === roomTypeSlug && r.status === "AVAILABLE").length,
    }),
    { name: "aehop-rooms", storage: createJSONStorage(() => localStorage) },
  ),
);
