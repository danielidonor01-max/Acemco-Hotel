import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";

export type CompanyTier = "STANDARD" | "PREFERRED" | "VIP" | "STRATEGIC";
export type CompanyStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export interface Company {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  billingEmail?: string | null;
  tier: CompanyTier;
  status: CompanyStatus;
  reservationCount?: number;
}

interface ApiCompany extends Omit<Company, "reservationCount"> {
  _count?: { reservations: number };
}

const toCompany = (c: ApiCompany): Company => ({ ...c, reservationCount: c._count?.reservations ?? 0 });

export async function listCompanies(): Promise<Company[]> {
  if (!hasApi()) return [];
  try {
    const { data } = await apiRequest<ApiCompany[]>("/companies");
    return data.map(toCompany);
  } catch {
    return [];
  }
}

export interface NewCompany {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingEmail?: string;
  tier: CompanyTier;
}
export async function createCompany(input: NewCompany): Promise<Company> {
  const { data } = await apiRequest<ApiCompany>("/companies", { method: "POST", body: JSON.stringify(input) });
  return toCompany(data);
}
export async function updateCompany(id: string, input: Partial<NewCompany> & { status?: CompanyStatus }): Promise<void> {
  await apiRequest(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
