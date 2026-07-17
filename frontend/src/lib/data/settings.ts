import { apiRequest } from "@/lib/api";

export interface HotelSettings {
  hotelName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;

  /** Hard bounds on what rate rules may do, as a multiple of a room's base price. */
  rateFloorMultiplier: string | number;
  rateCeilingMultiplier: string | number;

  /** Cancel at least this many hours before check-in and it's free. */
  cancellationFreeUntilHours: number;
  /** Charged when cancelling inside that window, as % of the booking total. */
  cancellationLateFeePercent: string | number;
  /** Charged when a guest never arrives, as % of the booking total. */
  noShowFeePercent: string | number;
  /** Whether a deposit comes back on a free cancellation. */
  depositRefundable: boolean;

  /** Local hour (0–23) the day is auto-closed. */
  nightAuditHour: number;
  nightAuditEnabled: boolean;
  /** Mark un-arrived bookings as no-shows at close. */
  autoMarkNoShows: boolean;
  /** IANA zone the audit day is measured in, e.g. Africa/Lagos. */
  timezone: string;
}

export interface SettingsInput {
  hotelName?: string; tagline?: string; phone?: string; whatsapp?: string;
  email?: string; address?: string; city?: string;
  rateFloorMultiplier?: number; rateCeilingMultiplier?: number;
  cancellationFreeUntilHours?: number; cancellationLateFeePercent?: number;
  noShowFeePercent?: number; depositRefundable?: boolean;
  nightAuditHour?: number; nightAuditEnabled?: boolean;
  autoMarkNoShows?: boolean; timezone?: string;
}

export async function getSettings(): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings");
  return data;
}

export async function updateSettings(input: SettingsInput): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings", { method: "PATCH", body: JSON.stringify(input) });
  return data;
}

/* ---------------- Night audit / daily close ---------------- */

export interface NightAuditStatus {
  hour: number;
  enabled: boolean;
  autoNoShows: boolean;
  timezone: string;
  localTime: string;
  today: string;
  closedToday: boolean;
  lastClose: DailyClose | null;
}

export interface DailyClose {
  id: string;
  businessDate: string;
  roomsAvailable: number;
  roomsSold: number;
  occupancyRate: string | number;
  adr: string | number;
  revpar: string | number;
  roomRevenue: string | number;
  fbRevenue: string | number;
  otherRevenue: string | number;
  totalRevenue: string | number;
  taxCollected: string | number;
  arrivals: number;
  departures: number;
  noShowsMarked: number;
  closedByUserId: string | null;
  closedAt: string;
}

export async function getNightAuditStatus(): Promise<NightAuditStatus> {
  const { data } = await apiRequest<NightAuditStatus>("/night-audit/status");
  return data;
}

export async function getDailyCloses(limit = 30): Promise<DailyClose[]> {
  const { data } = await apiRequest<DailyClose[]>(`/night-audit/history?limit=${limit}`);
  return data;
}

/** Close a business day by hand (YYYY-MM-DD) — for a missed night or a manual cut-off. */
export async function closeDay(businessDate: string): Promise<DailyClose> {
  const { data } = await apiRequest<DailyClose>("/night-audit/close", {
    method: "POST",
    body: JSON.stringify({ businessDate }),
  });
  return data;
}
