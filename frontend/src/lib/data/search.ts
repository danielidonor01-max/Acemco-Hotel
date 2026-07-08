import { apiRequest } from "@/lib/api";

export interface SearchResult {
  type: "reservation" | "guest" | "room" | "order";
  title: string;
  subtitle: string;
  href: string;
}

export async function globalSearch(q: string): Promise<SearchResult[]> {
  // Short queries never hit the API; a failed search must not break the top bar, so it yields no results.
  if (q.trim().length < 2) return [];
  try {
    const { data } = await apiRequest<SearchResult[]>(`/search?q=${encodeURIComponent(q.trim())}`);
    return data;
  } catch {
    return [];
  }
}
