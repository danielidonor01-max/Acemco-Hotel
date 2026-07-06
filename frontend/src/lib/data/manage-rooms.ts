import { apiRequest } from "@/lib/api";
import { hasApi } from "@/lib/config";
import { rooms as sampleRooms, type RoomStatus } from "@/lib/mock";
import { getRoomType } from "@/lib/cms";

export type { RoomStatus };

export interface ManageRoom {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeSlug: string;
  roomTypeName: string;
  status: RoomStatus;
}

interface ApiRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomType?: { name: string; slug: string } | null;
}

const toRoom = (r: ApiRoom): ManageRoom => ({
  id: r.id,
  roomNumber: r.roomNumber,
  floor: r.floor,
  roomTypeSlug: r.roomType?.slug ?? "",
  roomTypeName: r.roomType?.name ?? "—",
  status: r.status,
});

export async function listRooms(): Promise<ManageRoom[]> {
  if (!hasApi()) {
    return sampleRooms.map((r) => ({
      ...r,
      roomTypeName: getRoomType(r.roomTypeSlug)?.name ?? "—",
    }));
  }
  const { data } = await apiRequest<ApiRoom[]>("/rooms");
  return data.map(toRoom);
}

export async function updateRoomStatus(id: string, status: RoomStatus): Promise<void> {
  await apiRequest(`/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
