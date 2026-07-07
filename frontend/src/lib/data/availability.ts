import { apiRequest } from "@/lib/api";

export interface TypeAvailability {
  roomTypeId: string;
  slug: string;
  name: string;
  basePrice: number;
  capacity: number;
  held: number;
  outOfService: number;
  available: number;
  nights: number;
  totalPrice: number;
}

export interface AssignableRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  assignable: boolean;
  reason: string | null;
}

export interface AvailabilityCalendar {
  days: number;
  roomTypes: { id: string; name: string; slug: string; capacity: number }[];
  calendar: { date: string; cells: { roomTypeId: string; capacity: number; occupied: number; available: number }[] }[];
}

export async function getAvailabilityByType(checkIn: string, checkOut: string): Promise<TypeAvailability[]> {
  const { data } = await apiRequest<TypeAvailability[]>(`/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
  return data;
}

export async function getAvailableRooms(reservationId: string): Promise<AssignableRoom[]> {
  const { data } = await apiRequest<AssignableRoom[]>(`/reservations/${reservationId}/available-rooms`);
  return data;
}

export async function assignRoom(reservationId: string, roomId: string | null): Promise<void> {
  await apiRequest(`/reservations/${reservationId}/assign-room`, { method: "POST", body: JSON.stringify({ roomId }) });
}

export async function getAvailabilityCalendar(days = 14): Promise<AvailabilityCalendar> {
  const { data } = await apiRequest<AvailabilityCalendar>(`/availability/calendar?days=${days}`);
  return data;
}
