import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";

export interface SearchResult {
  type: "reservation" | "guest" | "room" | "order";
  title: string;
  subtitle: string;
  href: string;
}

export async function globalSearch(q: string): Promise<SearchResult[]> {
  if (!hasApi() || q.trim().length < 2) return [];
  try {
    const { data } = await apiRequest<SearchResult[]>(`/search?q=${encodeURIComponent(q.trim())}`);
    return data;
  } catch {
    return [];
  }
}
