import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";
import { guests as sampleGuests } from "@/lib/mock-modules";

export type GuestTier = "STANDARD" | "PREFERRED" | "VIP";

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email?: string;
  nationality: string;
  stays: number;
  isVip: boolean;
  isBlacklisted: boolean;
  tier: GuestTier;
  inHouse: boolean;
  past: boolean;
  isCorporate: boolean;
  frequent: boolean;
}

interface ApiGuest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
  tier?: GuestTier;
  stays?: number;
  inHouse?: boolean;
  past?: boolean;
  isCorporate?: boolean;
  frequent?: boolean;
  _count?: { reservations: number };
}

const toGuest = (g: ApiGuest): Guest => ({
  id: g.id,
  firstName: g.firstName,
  lastName: g.lastName,
  name: `${g.firstName} ${g.lastName}`.trim(),
  phone: g.phone,
  email: g.email ?? undefined,
  nationality: g.nationality ?? "—",
  stays: g.stays ?? g._count?.reservations ?? 0,
  isVip: g.isVip,
  isBlacklisted: g.isBlacklisted,
  tier: g.tier ?? (g.isVip ? "VIP" : "STANDARD"),
  inHouse: g.inHouse ?? false,
  past: g.past ?? false,
  isCorporate: g.isCorporate ?? false,
  frequent: g.frequent ?? false,
});

const sampleAsGuests: Guest[] = sampleGuests.map((g) => ({
  id: g.id, firstName: g.name.split(" ")[0], lastName: g.name.split(" ").slice(1).join(" "), name: g.name,
  phone: g.phone, email: g.email, nationality: g.nationality, stays: g.stays, isVip: g.isVip, isBlacklisted: g.isBlacklisted,
  tier: g.isVip ? "VIP" : "STANDARD", inHouse: false, past: false, isCorporate: false, frequent: g.stays >= 3,
}));

export async function listGuests(): Promise<Guest[]> {
  if (!hasApi()) return sampleAsGuests;
  try {
    const { data } = await apiRequest<ApiGuest[]>("/guests?pageSize=100");
    return data.map(toGuest);
  } catch {
    return sampleAsGuests;
  }
}

export interface NewGuest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  nationality?: string;
  isVip?: boolean;
}
export async function createGuest(input: NewGuest): Promise<Guest> {
  const { data } = await apiRequest<ApiGuest>("/guests", { method: "POST", body: JSON.stringify(input) });
  return toGuest(data);
}

export async function setGuestTier(id: string, tier: GuestTier): Promise<void> {
  await apiRequest(`/guests/${id}`, { method: "PATCH", body: JSON.stringify({ tier }) });
}
export async function setGuestBlacklist(id: string, isBlacklisted: boolean): Promise<void> {
  await apiRequest(`/guests/${id}`, { method: "PATCH", body: JSON.stringify({ isBlacklisted }) });
}

/* ---------------- Guest profile / relationship intelligence ---------------- */
export interface GuestProfile {
  guest: { id: string; name: string; tier: GuestTier; isVip: boolean; isBlacklisted: boolean; phone: string; email?: string | null; nationality?: string | null };
  stats: { totalStays: number; totalNights: number; lifetimeSpend: number; lastVisit: string | null; favouriteRoomType: string | null; avgLeadTime: number };
  companies: string[];
  spendByDepartment: { department: string; amount: number }[];
  loyaltyScore: number;
  vipRecommended: boolean;
  history: { id: string; reservationNumber: string; roomType: string | null; room: string | null; checkInDate: string; checkOutDate: string; status: string; company: string | null; totalAmount: number }[];
}

export async function getGuestProfile(id: string): Promise<GuestProfile> {
  const { data } = await apiRequest<GuestProfile>(`/guests/${id}/profile`);
  return data;
}
