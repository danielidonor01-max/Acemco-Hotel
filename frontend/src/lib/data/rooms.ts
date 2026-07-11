import { publicRequest } from "../api";
import { hasPublicApi } from "../config";
import { getRoomType as getSampleRoomType, type RoomType } from "../cms";

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

/**
 * Live room type, with the sample used only for PRESENTATION defaults a guest
 * can't be misled by (tier label, room size, how many gallery tiles to lay out).
 * Everything a guest books on — name, description, price, occupancy — comes from
 * the API.
 */
function toRoomType(api: ApiRoomType): RoomType {
  const sample = getSampleRoomType(api.slug);
  return {
    slug: api.slug,
    name: api.name,
    tier: sample?.tier ?? "Signature",
    summary: api.description?.slice(0, 90) || sample?.summary || "",
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

/**
 * The bookable catalogue — live API only, never the sample.
 *
 * These used to fall back to the hardcoded sample rooms, so if the API was
 * unreachable (or a room type was renamed/removed) the site kept advertising
 * rooms at prices the hotel doesn't offer, and a guest could submit a booking for
 * a `roomTypeSlug` the backend would reject. Showing nothing is honest; showing
 * an invented room at an invented price is not.
 */
export async function getRoomTypes(): Promise<RoomType[]> {
  if (!hasPublicApi()) return [];
  try {
    const rows = await publicRequest<ApiRoomType[]>("/rooms");
    return rows?.length ? rows.map(toRoomType) : [];
  } catch {
    return [];
  }
}

export async function getRoomType(slug: string): Promise<(RoomType & { available?: number }) | undefined> {
  if (!hasPublicApi()) return undefined;
  try {
    const row = await publicRequest<ApiRoomType>(`/rooms/${slug}`);
    return row ? { ...toRoomType(row), available: row.available } : undefined;
  } catch {
    return undefined;
  }
}
