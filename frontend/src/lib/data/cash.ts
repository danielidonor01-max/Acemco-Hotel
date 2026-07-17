import { apiRequest } from "@/lib/api";

export type CashStation = "RECEPTION" | "RESTAURANT" | "LOUNGE" | "BOUTIQUE";
export type CashDirection = "IN" | "OUT";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT";

export const CASH_STATIONS: CashStation[] = ["RECEPTION", "RESTAURANT", "LOUNGE", "BOUTIQUE"];

export interface CashShift {
  id: string;
  station: CashStation;
  status: "OPEN" | "CLOSED";
  openedByUserId: string;
  openingFloat: string | number;
  openedAt: string;
  countedCash: string | number | null;
  expectedCash: string | number | null;
  overShort: string | number | null;
  closedAt: string | null;
  notes: string | null;
}

export interface CashMovement {
  id: string;
  station: CashStation;
  direction: CashDirection;
  method: PaymentMethod;
  amount: string | number;
  reason: string;
  reference: string | null;
  createdAt: string;
}

export interface CashShiftDetail extends CashShift {
  movements: CashMovement[];
  summary: {
    openingFloat: number;
    cashIn: number;
    cashOut: number;
    expectedCash: number;
    byMethod: Record<string, number>;
  };
}

export async function getCashShifts(limit = 30): Promise<CashShift[]> {
  const { data } = await apiRequest<CashShift[]>(`/cash/shifts?limit=${limit}`);
  return data;
}
export async function getOpenShifts(): Promise<CashShift[]> {
  const { data } = await apiRequest<CashShift[]>("/cash/shifts/open");
  return data;
}
export async function getShiftDetail(id: string): Promise<CashShiftDetail> {
  const { data } = await apiRequest<CashShiftDetail>(`/cash/shifts/${id}`);
  return data;
}
export async function getUnattributedCash(): Promise<CashMovement[]> {
  const { data } = await apiRequest<CashMovement[]>("/cash/unattributed");
  return data;
}
export async function openShift(station: CashStation, openingFloat: number): Promise<CashShift> {
  const { data } = await apiRequest<CashShift>("/cash/shifts", { method: "POST", body: JSON.stringify({ station, openingFloat }) });
  return data;
}
export async function recordMovement(id: string, dto: { direction: CashDirection; amount: number; reason: string; method?: PaymentMethod }): Promise<CashMovement> {
  const { data } = await apiRequest<CashMovement>(`/cash/shifts/${id}/movements`, { method: "POST", body: JSON.stringify(dto) });
  return data;
}
export async function closeShift(id: string, countedCash: number, notes?: string): Promise<CashShift> {
  const { data } = await apiRequest<CashShift>(`/cash/shifts/${id}/close`, { method: "POST", body: JSON.stringify({ countedCash, notes }) });
  return data;
}
