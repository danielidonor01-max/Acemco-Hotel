import { apiRequest } from "@/lib/api";

export interface GroupRoomLine {
  roomTypeSlug: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  guestName?: string;
}

export interface GroupBookingInput {
  name: string;
  companyId?: string;
  organiser: { firstName: string; lastName: string; phone: string; whatsapp?: string; email?: string };
  notes?: string;
  rooms: GroupRoomLine[];
}

export interface BookingGroupRow {
  id: string;
  groupNumber: string;
  name: string;
  createdAt: string;
  company?: { name: string } | null;
  _count?: { reservations: number };
}

export interface GroupMember {
  id: string;
  reservationNumber: string;
  status: string;
  totalAmount: string | number;
  checkInDate: string;
  checkOutDate: string;
  guest?: { firstName: string; lastName: string } | null;
  roomType?: { name: string } | null;
  room?: { roomNumber: string } | null;
}

export interface BookingGroupDetail extends BookingGroupRow {
  notes: string | null;
  reservations: GroupMember[];
  summary: {
    rooms: number;
    activeRooms: number;
    totalValue: number;
    billedToDate: number;
    statuses: Record<string, number>;
  };
}

export async function getGroups(limit = 30): Promise<BookingGroupRow[]> {
  const { data } = await apiRequest<BookingGroupRow[]>(`/groups?limit=${limit}`);
  return data;
}
export async function getGroup(id: string): Promise<BookingGroupDetail> {
  const { data } = await apiRequest<BookingGroupDetail>(`/groups/${id}`);
  return data;
}
export async function createGroup(input: GroupBookingInput): Promise<{ group: BookingGroupRow; rooms: number; total: number }> {
  const { data } = await apiRequest<{ group: BookingGroupRow; rooms: number; total: number }>("/groups", { method: "POST", body: JSON.stringify(input) });
  return data;
}
export async function cancelGroup(id: string, reason?: string): Promise<{ groupNumber: string; cancelled: number; skipped: { reservationNumber: string; status: string }[]; totalFee: number }> {
  const { data } = await apiRequest<{ groupNumber: string; cancelled: number; skipped: { reservationNumber: string; status: string }[]; totalFee: number }>(`/groups/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
  return data;
}
