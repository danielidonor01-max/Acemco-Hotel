import { apiRequest } from "@/lib/api";
import { type RoomStatus } from "@/lib/mock";

export type { RoomStatus };

export interface ReservationSummary {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  isVip: boolean;
  roomAssigned: boolean;
}

export interface ManageRoom {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeSlug: string;
  roomTypeName: string;
  status: RoomStatus;
  physicalStatus?: RoomStatus;
  currentReservation?: ReservationSummary | null;
  upcomingReservation?: ReservationSummary | null;
}

interface ApiRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  physicalStatus?: RoomStatus;
  roomType?: { name: string; slug: string } | null;
  currentReservation?: ReservationSummary | null;
  upcomingReservation?: ReservationSummary | null;
}

const toRoom = (r: ApiRoom): ManageRoom => ({
  id: r.id,
  roomNumber: r.roomNumber,
  floor: r.floor,
  roomTypeSlug: r.roomType?.slug ?? "",
  roomTypeName: r.roomType?.name ?? "—",
  status: r.status,
  physicalStatus: r.physicalStatus,
  currentReservation: r.currentReservation ?? null,
  upcomingReservation: r.upcomingReservation ?? null,
});

export async function listRooms(): Promise<ManageRoom[]> {
  const { data } = await apiRequest<ApiRoom[]>("/rooms");
  return data.map(toRoom);
}

export async function updateRoomStatus(id: string, status: RoomStatus): Promise<void> {
  await apiRequest(`/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export interface ArrivalSummary {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  isVip: boolean;
}

export interface RoomDetail {
  room: { id: string; roomNumber: string; floor: number; status: RoomStatus; roomType: string | null };
  occupant: {
    name: string;
    phone: string;
    isVip: boolean;
    reservationId: string;
    reservationNumber: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  assignedUpcoming: ArrivalSummary[];
  unassignedArrivals: ArrivalSummary[];
  assignedHousekeeper: string | null;
  housekeeping: { id: string; type: string; status: string; priority: string; assignedTo: string | null }[];
  assets: { id: string; assetNumber: string; name: string; status: string }[];
  maintenanceIssues: { id: string; workOrderNumber: string; asset: string; priority: string; status: string }[];
}

export async function getRoomDetail(id: string): Promise<RoomDetail> {
  const { data } = await apiRequest<RoomDetail>(`/rooms/${id}/detail`);
  return data;
}
