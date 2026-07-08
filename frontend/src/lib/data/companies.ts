import { apiRequest } from "@/lib/api";

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
  const { data } = await apiRequest<ApiCompany[]>("/companies");
  return data.map(toCompany);
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

export interface InvoiceCharge {
  id: string; chargeNumber: string; date: string; department: string; description: string;
  room: string | null; reference: string | null; amount: number; tax: number; status: string;
}
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT";
export interface CompanyPayment {
  id: string; amount: number; method: string; reference: string | null; note: string | null; paidAt: string;
}
export interface Aging {
  current: number; days31_60: number; days61_90: number; days90plus: number; outstanding: number;
}
export interface CompanyInvoice {
  company: { id: string; name: string; tier: CompanyTier; status: CompanyStatus; billingEmail?: string | null };
  byDepartment: { department: string; amount: number }[];
  byGuest: { guestId: string; guestName: string; total: number; charges: InvoiceCharge[] }[];
  payments: CompanyPayment[];
  taxTotal: number;
  grandTotal: number;
  billed: number;
  paidToDate: number;
  outstanding: number;
  aging: Aging;
  chargeCount: number;
}

export async function getCompanyInvoice(id: string): Promise<CompanyInvoice> {
  const { data } = await apiRequest<CompanyInvoice>(`/companies/${id}/invoice`);
  return data;
}

export interface NewPayment { amount: number; method?: PaymentMethod; reference?: string; note?: string; paidAt?: string }
export async function recordCompanyPayment(id: string, input: NewPayment): Promise<CompanyInvoice> {
  const { data } = await apiRequest<CompanyInvoice>(`/companies/${id}/payments`, { method: "POST", body: JSON.stringify(input) });
  return data;
}
export async function settleCompanyInvoice(id: string): Promise<CompanyInvoice> {
  const { data } = await apiRequest<CompanyInvoice>(`/companies/${id}/settle`, { method: "POST" });
  return data;
}

export interface CompanyAgingRow extends Aging {
  id: string; name: string; tier: CompanyTier; status: CompanyStatus;
}
export interface CompaniesAging {
  companies: CompanyAgingRow[];
  totals: Aging;
}
export async function getCompaniesAging(): Promise<CompaniesAging> {
  const { data } = await apiRequest<CompaniesAging>("/companies/aging");
  return data;
}
