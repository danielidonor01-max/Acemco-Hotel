import { apiRequest } from "@/lib/api";

export interface Conference {
  id: string;
  reference: string;
  name: string;
  company: string | null;
  companyId: string | null;
  date: string;
  total: number;
  status: string;
}

export async function listConferences(): Promise<Conference[]> {
  const { data } = await apiRequest<Omit<Conference, "id">[]>("/conferences");
  return data.map((c) => ({ ...c, id: c.reference, total: Number(c.total) }));
}

export interface NewConference {
  companyId: string;
  name: string;
  date: string;
  attendees?: number;
  hallFee: number;
  mealsAmount?: number;
  coffeeAmount?: number;
  roomsAmount?: number;
}
export async function createConference(input: NewConference): Promise<{ reference: string }> {
  const { data } = await apiRequest<{ reference: string }>("/conferences", { method: "POST", body: JSON.stringify(input) });
  return data;
}
