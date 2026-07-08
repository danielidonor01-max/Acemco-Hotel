import { apiRequest } from "@/lib/api";

export interface HotelSettings {
  hotelName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
}

export async function getSettings(): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings");
  return data;
}

export async function updateSettings(input: Partial<HotelSettings>): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings", { method: "PATCH", body: JSON.stringify(input) });
  return data;
}
