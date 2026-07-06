import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";
import { site } from "@/lib/cms";

export interface HotelSettings {
  hotelName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
}

const fallback: HotelSettings = {
  hotelName: site.hotelName, tagline: site.tagline, phone: site.phone,
  whatsapp: site.whatsapp, email: site.email, address: site.address, city: site.city,
};

export async function getSettings(): Promise<HotelSettings> {
  if (!hasApi()) return fallback;
  try {
    const { data } = await apiRequest<HotelSettings>("/settings");
    return data;
  } catch {
    return fallback;
  }
}

export async function updateSettings(input: Partial<HotelSettings>): Promise<HotelSettings> {
  const { data } = await apiRequest<HotelSettings>("/settings", { method: "PATCH", body: JSON.stringify(input) });
  return data;
}
