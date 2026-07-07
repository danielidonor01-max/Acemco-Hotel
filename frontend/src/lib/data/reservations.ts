import { apiRequest } from "../api";
import { hasApi } from "../config";
import { reservations as seed, getReservation as getSeedReservation, type Reservation } from "../mock";
import { roomTypes } from "../cms";

interface ApiReservation {
  id: string;
  reservationNumber: string;
  status: Reservation["status"];
  source: Reservation["source"];
  totalAmount: string | number;
  depositPaid: boolean;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  roomId?: string | null;
  type?: "INDIVIDUAL" | "CORPORATE" | "CONFERENCE";
  guest?: { firstName: string; lastName: string; isVip: boolean; phone?: string };
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
    isVip: r.guest?.isVip,
    type: r.type,
    company: r.company?.name ?? undefined,
  };
}

export async function getReservationById(id: string): Promise<Reservation | undefined> {
  if (!hasApi()) return getSeedReservation(id);
  try {
    const { data } = await apiRequest<ApiReservation>(`/reservations/${id}`);
    return mapApi(data);
  } catch {
    return getSeedReservation(id);
  }
}

/** Live list when the API is configured, else the seed (keeps the UI working offline). */
export async function listReservations(): Promise<Reservation[]> {
  if (!hasApi()) return seed;
  try {
    const { data } = await apiRequest<ApiReservation[]>("/reservations?pageSize=100");
    return data.map(mapApi);
  } catch {
    return seed;
  }
}

export const isApiEnabled = hasApi;

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
}

export async function createReservation(input: NewReservation): Promise<Reservation> {
  const { data } = await apiRequest<ApiReservation>("/reservations", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "INTERNAL" }),
  });
  return mapApi(data);
}

export async function confirmReservation(id: string): Promise<void> {
  await apiRequest(`/reservations/${id}/confirm`, { method: "POST" });
}

export async function cancelReservation(id: string, reason?: string): Promise<void> {
  await apiRequest(`/reservations/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
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
