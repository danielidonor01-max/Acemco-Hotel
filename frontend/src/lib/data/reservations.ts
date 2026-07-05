import { apiRequest } from "../api";
import { hasApi } from "../config";
import { reservations as seed, type Reservation } from "../mock";
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
  guest?: { firstName: string; lastName: string; isVip: boolean };
  roomType?: { name: string };
}

const slugByName = new Map(roomTypes.map((r) => [r.name, r.slug]));

function mapApi(r: ApiReservation): Reservation {
  return {
    id: r.id,
    reservationNumber: r.reservationNumber,
    guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "—",
    guestPhone: "",
    roomTypeSlug: (r.roomType && slugByName.get(r.roomType.name)) || roomTypes[0].slug,
    checkInDate: r.checkInDate.slice(0, 10),
    checkOutDate: r.checkOutDate.slice(0, 10),
    adults: r.adults,
    children: r.children,
    status: r.status,
    source: r.source,
    totalAmount: Number(r.totalAmount),
    depositPaid: r.depositPaid,
    isVip: r.guest?.isVip,
  };
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
