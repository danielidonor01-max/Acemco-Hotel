import { apiRequest } from "@/lib/api";

export type RateAdjustment = "PERCENT" | "AMOUNT" | "FIXED";

export interface RateRule {
  id: string;
  name: string;
  roomTypeId: string | null;
  roomType?: { name: string; slug: string } | null;
  startDate: string | null;
  endDate: string | null;
  /** 0=Sunday … 6=Saturday. Empty = every day. */
  daysOfWeek: number[];
  /** Demand band, % of that night's sellable rooms already held. */
  minOccupancy: number | null;
  maxOccupancy: number | null;
  adjustment: RateAdjustment;
  value: string | number;
  priority: number;
  isActive: boolean;
}

export interface RateRuleInput {
  name: string;
  roomTypeId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek?: number[];
  minOccupancy?: number | null;
  maxOccupancy?: number | null;
  adjustment: RateAdjustment;
  value: number;
  priority?: number;
  isActive?: boolean;
}

export interface NightlyRate {
  date: string;
  base: number;
  rate: number;
  occupancy: number;
  applied: { name: string; adjustment: string; value: number; from: number; to: number }[];
  clamped?: "FLOOR" | "CEILING";
}
export interface Quote {
  nights: number;
  total: number;
  averageRate: number;
  breakdown: NightlyRate[];
}

export async function getRateRules(): Promise<RateRule[]> {
  const { data } = await apiRequest<RateRule[]>("/pricing/rules");
  return data;
}
export async function createRateRule(dto: RateRuleInput): Promise<RateRule> {
  const { data } = await apiRequest<RateRule>("/pricing/rules", { method: "POST", body: JSON.stringify(dto) });
  return data;
}
export async function updateRateRule(id: string, dto: Partial<RateRuleInput>): Promise<RateRule> {
  const { data } = await apiRequest<RateRule>(`/pricing/rules/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  return data;
}
export async function deleteRateRule(id: string): Promise<void> {
  await apiRequest(`/pricing/rules/${id}`, { method: "DELETE" });
}

/** Preview a priced stay night-by-night before a rule reaches a guest. */
export async function getQuote(roomTypeId: string, checkIn: string, checkOut: string): Promise<Quote> {
  const { data } = await apiRequest<Quote>(`/pricing/quote?roomTypeId=${roomTypeId}&checkIn=${checkIn}&checkOut=${checkOut}`);
  return data;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Plain-English summary of when a rule fires — the table shouldn't need decoding. */
export function describeRule(r: RateRule): string {
  const bits: string[] = [];
  if (r.daysOfWeek?.length && r.daysOfWeek.length < 7) bits.push(r.daysOfWeek.map((d) => DAY_LABELS[d]).join(", "));
  if (r.startDate || r.endDate) {
    const f = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "…");
    bits.push(`${f(r.startDate)} – ${f(r.endDate)}`);
  }
  if (r.minOccupancy != null && r.maxOccupancy != null) bits.push(`${r.minOccupancy}–${r.maxOccupancy}% full`);
  else if (r.minOccupancy != null) bits.push(`over ${r.minOccupancy}% full`);
  else if (r.maxOccupancy != null) bits.push(`under ${r.maxOccupancy}% full`);
  return bits.length ? bits.join(" · ") : "Every night";
}

/** How the rule changes the price, e.g. "+15%" or "set to ₦80,000". */
export function describeEffect(r: RateRule): string {
  const v = Number(r.value);
  if (r.adjustment === "FIXED") return `set to ₦${v.toLocaleString("en-NG")}`;
  if (r.adjustment === "AMOUNT") return `${v >= 0 ? "+" : "−"}₦${Math.abs(v).toLocaleString("en-NG")}`;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v)}%`;
}
