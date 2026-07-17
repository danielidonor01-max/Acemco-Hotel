import { apiRequest } from "@/lib/api";

/** Charge departments a tax can apply to (mirrors the backend enum). */
export const TAX_DEPARTMENTS = [
  "ROOM", "RESTAURANT", "LOUNGE", "BOUTIQUE", "LAUNDRY", "CONFERENCE", "DAMAGE", "SERVICE", "OTHER",
] as const;
export type TaxDepartment = (typeof TAX_DEPARTMENTS)[number];

export interface TaxRate {
  id: string;
  name: string;
  code: string;
  rate: string | number;
  appliesTo: TaxDepartment[];
  isInclusive: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface TaxReport {
  from: string;
  to: string;
  totals: { net: number; tax: number; gross: number; charges: number };
  byDepartment: { department: string; net: number; tax: number; gross: number; count: number }[];
  rates: TaxRate[];
}

export async function getTaxRates(): Promise<TaxRate[]> {
  const { data } = await apiRequest<TaxRate[]>("/tax/rates");
  return data;
}

export async function createTaxRate(dto: {
  name: string; code: string; rate: number; appliesTo: TaxDepartment[]; isInclusive?: boolean; isActive?: boolean;
}): Promise<TaxRate> {
  const { data } = await apiRequest<TaxRate>("/tax/rates", { method: "POST", body: JSON.stringify(dto) });
  return data;
}

export async function updateTaxRate(id: string, dto: Partial<{
  name: string; code: string; rate: number; appliesTo: TaxDepartment[]; isInclusive: boolean; isActive: boolean;
}>): Promise<TaxRate> {
  const { data } = await apiRequest<TaxRate>(`/tax/rates/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return data;
}

/** Deactivates (never deletes) — historical charges cite the rate that applied. */
export async function deactivateTaxRate(id: string): Promise<TaxRate> {
  const { data } = await apiRequest<TaxRate>(`/tax/rates/${id}`, { method: "DELETE" });
  return data;
}

export async function getTaxReport(from: string, to: string): Promise<TaxReport> {
  const { data } = await apiRequest<TaxReport>(`/tax/report?from=${from}&to=${to}`);
  return data;
}

/**
 * Effective rates for one department, as decimals ready to multiply.
 * The POS uses this instead of a hardcoded constant so the till can never show a
 * tax the ledger won't bill.
 */
export function ratesFor(rates: TaxRate[], department: TaxDepartment) {
  return rates
    .filter((r) => r.isActive && r.appliesTo.includes(department))
    .map((r) => ({ ...r, rate: Number(r.rate) }));
}

/** Tax on a net amount for a department — mirrors the backend's exclusive-rate math. */
export function taxOn(rates: TaxRate[], department: TaxDepartment, net: number) {
  const applicable = ratesFor(rates, department).filter((r) => !r.isInclusive);
  const lines = applicable.map((r) => ({ code: r.code, name: r.name, rate: r.rate, amount: Math.round(net * (r.rate / 100) * 100) / 100 }));
  return { lines, tax: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100 };
}
