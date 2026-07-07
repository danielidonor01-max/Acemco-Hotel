/**
 * Mock operational data for the internal platform (frontend-only phase).
 * Types mirror the Domain Model. Swapped for the NestJS API in the backend phase.
 */
import { roomTypes } from "./cms";

export type ReservationStatus =
  | "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export interface Reservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  roomTypeSlug: string;
  roomNumber?: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  source: "WEBSITE" | "WALK_IN" | "PHONE" | "OTA" | "INTERNAL";
  totalAmount: number;
  depositPaid: boolean;
  isVip?: boolean;
  type?: "INDIVIDUAL" | "CORPORATE" | "CONFERENCE";
  company?: string;
}

const rt = (i: number) => roomTypes[i % roomTypes.length];

export const reservations: Reservation[] = [
  { id: "res-1", reservationNumber: "RES-2026-00042", guestName: "James Morrison", guestPhone: "+44 7700 900123", roomTypeSlug: rt(2).slug, roomNumber: "512", checkInDate: "2026-07-05", checkOutDate: "2026-07-09", adults: 1, children: 0, status: "CHECKED_IN", source: "WEBSITE", totalAmount: 480000, depositPaid: true, isVip: true },
  { id: "res-2", reservationNumber: "RES-2026-00043", guestName: "Adaeze Obi", guestPhone: "+234 803 111 2222", roomTypeSlug: rt(0).slug, checkInDate: "2026-07-05", checkOutDate: "2026-07-07", adults: 2, children: 0, status: "CONFIRMED", source: "PHONE", totalAmount: 130000, depositPaid: true },
  { id: "res-3", reservationNumber: "RES-2026-00044", guestName: "Tunde Balogun", guestPhone: "+234 805 333 4444", roomTypeSlug: rt(3).slug, checkInDate: "2026-07-06", checkOutDate: "2026-07-10", adults: 2, children: 2, status: "PENDING", source: "WEBSITE", totalAmount: 380000, depositPaid: false },
  { id: "res-4", reservationNumber: "RES-2026-00045", guestName: "Sarah Nnamdi", guestPhone: "+234 809 555 6666", roomTypeSlug: rt(1).slug, roomNumber: "203", checkInDate: "2026-07-04", checkOutDate: "2026-07-05", adults: 1, children: 0, status: "CHECKED_OUT", source: "WALK_IN", totalAmount: 58000, depositPaid: true },
  { id: "res-5", reservationNumber: "RES-2026-00046", guestName: "Michael Chen", guestPhone: "+65 8123 4567", roomTypeSlug: rt(0).slug, checkInDate: "2026-07-07", checkOutDate: "2026-07-12", adults: 2, children: 0, status: "CONFIRMED", source: "OTA", totalAmount: 325000, depositPaid: true },
  { id: "res-6", reservationNumber: "RES-2026-00047", guestName: "Fatima Bello", guestPhone: "+234 802 777 8888", roomTypeSlug: rt(2).slug, checkInDate: "2026-07-05", checkOutDate: "2026-07-06", adults: 1, children: 0, status: "NO_SHOW", source: "WEBSITE", totalAmount: 120000, depositPaid: false },
  { id: "res-7", reservationNumber: "RES-2026-00048", guestName: "Daniel Okafor", guestPhone: "+234 806 999 0000", roomTypeSlug: rt(3).slug, roomNumber: "410", checkInDate: "2026-07-05", checkOutDate: "2026-07-08", adults: 2, children: 1, status: "CHECKED_IN", source: "INTERNAL", totalAmount: 285000, depositPaid: true },
  { id: "res-8", reservationNumber: "RES-2026-00049", guestName: "Grace Umeh", guestPhone: "+234 807 222 1111", roomTypeSlug: rt(1).slug, checkInDate: "2026-07-08", checkOutDate: "2026-07-11", adults: 2, children: 0, status: "CONFIRMED", source: "PHONE", totalAmount: 174000, depositPaid: true },
  { id: "res-9", reservationNumber: "RES-2026-00050", guestName: "Kunle Adeyemi", guestPhone: "+234 808 444 3333", roomTypeSlug: rt(0).slug, checkInDate: "2026-07-06", checkOutDate: "2026-07-07", adults: 1, children: 0, status: "PENDING", source: "WEBSITE", totalAmount: 65000, depositPaid: false },
  { id: "res-10", reservationNumber: "RES-2026-00051", guestName: "Amara Eze", guestPhone: "+234 810 555 4444", roomTypeSlug: rt(2).slug, roomNumber: "508", checkInDate: "2026-07-03", checkOutDate: "2026-07-05", adults: 2, children: 0, status: "CHECKED_OUT", source: "WEBSITE", totalAmount: 240000, depositPaid: true },
  { id: "res-11", reservationNumber: "RES-2026-00052", guestName: "Robert Hayes", guestPhone: "+1 415 555 0198", roomTypeSlug: rt(3).slug, checkInDate: "2026-07-09", checkOutDate: "2026-07-14", adults: 3, children: 1, status: "CONFIRMED", source: "OTA", totalAmount: 475000, depositPaid: true },
  { id: "res-12", reservationNumber: "RES-2026-00053", guestName: "Ngozi Okonkwo", guestPhone: "+234 811 666 5555", roomTypeSlug: rt(1).slug, checkInDate: "2026-07-05", checkOutDate: "2026-07-06", adults: 2, children: 0, status: "CANCELLED", source: "WEBSITE", totalAmount: 58000, depositPaid: false },
];

export function getReservation(id: string) {
  return reservations.find((r) => r.id === id);
}

export type RoomStatus =
  | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "INSPECTION" | "MAINTENANCE" | "OUT_OF_ORDER" | "BLOCKED";

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeSlug: string;
  status: RoomStatus;
}

const ROOM_STATUSES: RoomStatus[] = [
  "AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "AVAILABLE", "OCCUPIED",
  "INSPECTION", "AVAILABLE", "MAINTENANCE", "AVAILABLE", "OCCUPIED", "OUT_OF_ORDER",
  "AVAILABLE", "RESERVED", "AVAILABLE", "CLEANING", "OCCUPIED", "AVAILABLE",
  "AVAILABLE", "BLOCKED", "OCCUPIED", "AVAILABLE", "INSPECTION", "AVAILABLE",
];

export const rooms: Room[] = ROOM_STATUSES.map((status, i) => {
  const floor = Math.floor(i / 6) + 1;
  const num = floor * 100 + (i % 6) + 1;
  return {
    id: `room-${num}`,
    roomNumber: String(num),
    floor,
    roomTypeSlug: roomTypes[i % roomTypes.length].slug,
    status,
  };
});

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  type: "CHECKOUT_CLEAN" | "STAYOVER_CLEAN" | "DEEP_CLEAN" | "INSPECTION" | "TURNDOWN";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedTo?: string;
}

export const housekeepingTasks: HousekeepingTask[] = [
  { id: "hk-1", roomNumber: "203", type: "CHECKOUT_CLEAN", status: "IN_PROGRESS", priority: "HIGH", assignedTo: "Blessing A." },
  { id: "hk-2", roomNumber: "116", type: "INSPECTION", status: "PENDING", priority: "NORMAL", assignedTo: "Emeka N." },
  { id: "hk-3", roomNumber: "301", type: "STAYOVER_CLEAN", status: "PENDING", priority: "NORMAL" },
  { id: "hk-4", roomNumber: "512", type: "TURNDOWN", status: "COMPLETED", priority: "LOW", assignedTo: "Blessing A." },
];

export interface DashboardStats {
  occupancyRate: number;
  revenueToday: number;
  arrivalsToday: number;
  departuresToday: number;
  pendingReservations: number;
  lowStockAlerts: number;
  openWorkOrders: number;
  activeHousekeeping: number;
}

export const dashboardStats: DashboardStats = {
  occupancyRate: 87,
  revenueToday: 1_240_000,
  arrivalsToday: reservations.filter((r) => r.status === "CONFIRMED" && r.checkInDate === "2026-07-05").length + 3,
  departuresToday: 4,
  pendingReservations: reservations.filter((r) => r.status === "PENDING").length,
  lowStockAlerts: 3,
  openWorkOrders: 2,
  activeHousekeeping: housekeepingTasks.filter((t) => t.status !== "COMPLETED").length,
};
