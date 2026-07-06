import { publicRequest } from "../api";
import { hasPublicApi } from "../config";
import { roomTypes as sampleRoomTypes, getRoomType as getSampleRoomType, type RoomType } from "../cms";

interface ApiRoomType {
  id: string;
  slug: string;
  name: string;
  description: string;
  bedConfiguration: string;
  maxOccupancy: number;
  basePrice: string | number;
  features: string[];
  images: string[];
  available?: number;
}

/** Merge live operational data over the sample presentation shape. */
function toRoomType(api: ApiRoomType): RoomType {
  const sample = getSampleRoomType(api.slug);
  return {
    slug: api.slug,
    name: api.name,
    tier: sample?.tier ?? "Signature",
    summary: sample?.summary ?? api.description.slice(0, 90),
    description: api.description,
    bedConfiguration: api.bedConfiguration,
    maxOccupancy: api.maxOccupancy,
    sizeSqm: sample?.sizeSqm ?? 30,
    basePrice: Number(api.basePrice),
    features: api.features?.length ? api.features : sample?.features ?? [],
    heroSlot: api.images?.[0] ?? sample?.heroSlot, // Sanity/S3 image key when present, else static fallback
    gallerySlots: sample?.gallerySlots ?? 4,
  };
}

export async function getRoomTypes(): Promise<RoomType[]> {
  if (hasPublicApi()) {
    try {
      const rows = await publicRequest<ApiRoomType[]>("/rooms");
      if (rows?.length) return rows.map(toRoomType);
    } catch {
      /* fall through to sample */
    }
  }
  return sampleRoomTypes;
}

export async function getRoomType(slug: string): Promise<(RoomType & { available?: number }) | undefined> {
  if (hasPublicApi()) {
    try {
      const row = await publicRequest<ApiRoomType>(`/rooms/${slug}`);
      if (row) return { ...toRoomType(row), available: row.available };
    } catch {
      /* fall through */
    }
  }
  return getSampleRoomType(slug);
}
