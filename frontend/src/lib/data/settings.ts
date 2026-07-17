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
}

export interface SettingsInput {
  hotelName?: string; tagline?: string; phone?: string; whatsapp?: string;
  email?: string; address?: string; city?: string;
  rateFloorMultiplier?: number; rateCeilingMultiplier?: number;
  cancellationFreeUntilHours?: number; cancellationLateFeePercent?: number;
  noShowFeePercent?: number; depositRefundable?: boolean;
}

export async function getSettings(): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings");
  return data;
}

export async function updateSettings(input: SettingsInput): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings", { method: "PATCH", body: JSON.stringify(input) });
  return data;
}
