import { apiRequest } from "../api";
import { type Reservation } from "../mock";
import { roomTypes } from "../cms";

interface ApiReservation {
  id: string;
  reservationNumber: string;
  status: Reservation["status"];
  source: Reservation["source"];
  totalAmount: string | number;
  depositPaid: boolean;
  depositAmount?: string | number;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  roomId?: string | null;
  type?: "INDIVIDUAL" | "CORPORATE" | "CONFERENCE";
  guest?: { id?: string; firstName: string; lastName: string; isVip: boolean; phone?: string; tier?: "STANDARD" | "PREFERRED" | "VIP"; isBlacklisted?: boolean };
  roomType?: { name: string };
  room?: { roomNumber: string } | null;
  company?: { name: string } | null;
}

const slugByName = new Map(roomTypes.map((r) => [r.name, r.slug]));

function mapApi(r: ApiReservation): Reservation {
  return {
    id: r.id,
    reservationNumber: r.reservationNumber,
    guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "—",
    guestPhone: r.guest?.phone ?? "",
    roomTypeSlug: (r.roomType && slugByName.get(r.roomType.name)) || roomTypes[0].slug,
    roomNumber: r.room?.roomNumber ?? undefined,
    checkInDate: r.checkInDate.slice(0, 10),
    checkOutDate: r.checkOutDate.slice(0, 10),
    adults: r.adults,
    children: r.children,
    status: r.status,
    source: r.source,
    totalAmount: Number(r.totalAmount),
    depositPaid: r.depositPaid,
    depositAmount: r.depositAmount != null ? Number(r.depositAmount) : undefined,
    isVip: r.guest?.isVip,
    type: r.type,
    company: r.company?.name ?? undefined,
    guestId: r.guest?.id,
    tier: r.guest?.tier,
    isBlacklisted: r.guest?.isBlacklisted,
  };
}

export async function getReservationById(id: string): Promise<Reservation | undefined> {
  const { data } = await apiRequest<ApiReservation>(`/reservations/${id}`);
  return mapApi(data);
}

export async function listReservations(): Promise<Reservation[]> {
  const { data } = await apiRequest<ApiReservation[]>("/reservations?pageSize=100");
  return data.map(mapApi);
}

export interface NewReservation {
  firstName: string;
  lastName: string;
  phone: string;
  roomTypeSlug: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  type?: "INDIVIDUAL" | "CORPORATE" | "CONFERENCE";
  companyId?: string;
  depositAmount?: number;
}

export async function createReservation(input: NewReservation): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>("/reservations", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "INTERNAL" }),
  });
  return mapApi(data);
}

export interface CorporateBookingInput {
  companyId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: { firstName: string; lastName: string; phone: string; roomTypeSlug: string }[];
}
export async function createCorporateBooking(input: CorporateBookingInput): Promise<{ count: number }> {
  const { data } = await apiRequest<{ count: number }>("/reservations/corporate", { method: "POST", body: JSON.stringify(input) });
  return data;
}

export interface EditReservation {
  roomTypeSlug?: string;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
  children?: number;
  type?: "INDIVIDUAL" | "CORPORATE" | "CONFERENCE";
  companyId?: string | null;
  depositAmount?: number;
}
export async function editReservation(id: string, input: EditReservation): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>(`/reservations/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return mapApi(data);
}

export async function confirmReservation(id: string): Promise<void> {
  await apiRequest(`/reservations/${id}/confirm`, { method: "POST" });
}

export async function cancelReservation(id: string, reason?: string): Promise<void> {
  await apiRequest(`/reservations/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

export async function markNoShow(id: string): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>(`/reservations/${id}/no-show`, { method: "POST" });
  return mapApi(data);
}

export async function checkInReservation(id: string, roomId?: string): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>(`/reservations/${id}/check-in`, {
    method: "POST",
    body: JSON.stringify(roomId ? { roomId } : {}),
  });
  return mapApi(data);
}

export async function checkOutReservation(id: string, paymentMethod = "CASH"): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>(`/reservations/${id}/check-out`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod }),
  });
  return mapApi(data);
}

export interface WalkIn extends NewReservation { roomId?: string }
export async function walkInReservation(input: WalkIn): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>("/reservations/walk-in", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "WALK_IN" }),
  });
  return mapApi(data);
}
