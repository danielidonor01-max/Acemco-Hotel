/**
 * Shared operational TypeScript types (domain model). The system runs entirely
 * on the live API — there is no sample/mock data here; these are type-only
 * definitions consumed across the management UI and the data layer.
 */

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
  depositAmount?: number;
  isVip?: boolean;
  type?: "INDIVIDUAL" | "CORPORATE" | "CONFERENCE";
  company?: string;
  guestId?: string;
  tier?: "STANDARD" | "PREFERRED" | "VIP";
  isBlacklisted?: boolean;
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

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  type: "CHECKOUT_CLEAN" | "STAYOVER_CLEAN" | "DEEP_CLEAN" | "INSPECTION" | "TURNDOWN";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedTo?: string;
}

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
