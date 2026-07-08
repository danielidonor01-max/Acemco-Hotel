import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface ManagedRoomType {
  id: string;
  slug: string;
  name: string;
  description: string;
  bedConfiguration: string;
  maxOccupancy: number;
  basePrice: number;
  features: string[];
  images: string[];
  isActive: boolean;
  sortOrder: number;
  roomCount: number;
  reservationCount: number;
}

interface ApiRoomType {
  id: string; slug: string; name: string; description: string;
  bedConfiguration: string; maxOccupancy: number; basePrice: string | number;
  features: string[]; images: string[]; isActive: boolean; sortOrder: number;
  _count?: { rooms: number; reservations: number };
}

const toRoomType = (r: ApiRoomType): ManagedRoomType => ({
  id: r.id, slug: r.slug, name: r.name, description: r.description ?? "",
  bedConfiguration: r.bedConfiguration ?? "", maxOccupancy: r.maxOccupancy,
  basePrice: Number(r.basePrice), features: r.features ?? [], images: r.images ?? [],
  isActive: r.isActive, sortOrder: r.sortOrder,
  roomCount: r._count?.rooms ?? 0, reservationCount: r._count?.reservations ?? 0,
});

export async function listRoomTypes(): Promise<ManagedRoomType[]> {
  const { data } = await apiRequest<ApiRoomType[]>("/room-types");
  return data.map(toRoomType);
}

export interface RoomTypeInput {
  name: string;
  description?: string;
  bedConfiguration?: string;
  maxOccupancy?: number;
  basePrice?: number;
  features?: string[];
  isActive?: boolean;
  sortOrder?: number;
}
export async function createRoomType(input: RoomTypeInput): Promise<void> {
  await apiRequest("/room-types", { method: "POST", body: JSON.stringify(input) });
}
export async function updateRoomType(id: string, input: Partial<RoomTypeInput>): Promise<void> {
  await apiRequest(`/room-types/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function deleteRoomType(id: string): Promise<void> {
  await apiRequest(`/room-types/${id}`, { method: "DELETE" });
}

/**
 * Shared room-type source for the management UI. `roomTypes` is the active,
 * sorted list for booking selects; `getRoomType` resolves any slug (active or
 * not) so existing reservations still render their type name.
 */
export function useRoomTypes() {
  const { data = [], isLoading } = useQuery({ queryKey: ["room-types"], queryFn: listRoomTypes });
  const roomTypes = data.filter((t) => t.isActive);
  const getRoomType = (slug: string) => data.find((t) => t.slug === slug);
  return { roomTypes, all: data, getRoomType, isLoading };
}
