import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";
import { guests as sampleGuests, type Guest } from "@/lib/mock-modules";

export type { Guest };

interface ApiGuest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
  _count?: { reservations: number };
}

const toGuest = (g: ApiGuest): Guest => ({
  id: g.id,
  name: `${g.firstName} ${g.lastName}`.trim(),
  phone: g.phone,
  email: g.email ?? undefined,
  nationality: g.nationality ?? "—",
  stays: g._count?.reservations ?? 0,
  isVip: g.isVip,
  isBlacklisted: g.isBlacklisted,
});

export async function listGuests(): Promise<Guest[]> {
  if (!hasApi()) return sampleGuests;
  try {
    const { data } = await apiRequest<ApiGuest[]>("/guests?pageSize=100");
    return data.map(toGuest);
  } catch {
    return sampleGuests;
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
