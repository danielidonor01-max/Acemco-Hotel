import { publicRequest } from "@/lib/api";
import { hasPublicApi as checkPublicApi } from "@/lib/config";
import { roomTypes } from "@/lib/cms";

/** Per-room-type availability returned by the public endpoint. */
export interface PublicAvailability {
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

export interface PublicReservationPayload {
  firstName: string;
  lastName: string;
  phone: string;
  /** Required — the number the guest's confirmation is sent to. */
  whatsapp: string;
  email?: string;
  roomTypeSlug: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  specialRequests?: string;
}

export interface PublicReservationResult {
  id: string;
  reservationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
}

/**
 * Fetch per-type availability for a date span.
 * Falls back to static mock data (each type shows 1 available) when the
 * public API is not configured — so the form still renders offline.
 */
export async function getPublicAvailability(
  checkIn: string,
  checkOut: string,
): Promise<PublicAvailability[]> {
  if (!checkPublicApi()) {
    // Offline fallback: derive nights from the dates and return synthetic data.
    const nights = Math.max(
      1,
      Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86_400_000),
    );
    return roomTypes.map((rt) => ({
      roomTypeId: rt.slug,
      slug: rt.slug,
      name: rt.name,
      basePrice: rt.basePrice,
      capacity: 6,
      held: 0,
      outOfService: 0,
      available: 1,
      nights,
      totalPrice: rt.basePrice * nights,
    }));
  }
  return publicRequest<PublicAvailability[]>(
    `/availability?checkIn=${checkIn}&checkOut=${checkOut}`,
  );
}

/**
 * Submit a reservation request from the public website.
 * Returns the created reservation record (status: PENDING).
 */
export async function submitPublicReservation(
  payload: PublicReservationPayload,
): Promise<PublicReservationResult> {
  return publicRequest<PublicReservationResult>("/reservations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
