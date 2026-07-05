import { publicRequest } from "../api";
import { hasPublicApi } from "../config";
import { getVenue as getSampleVenue, type Venue, type MenuCategory } from "../cms";

interface ApiMenuCategory {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    description: string | null;
    price: string | number;
    tags: string[];
    isAvailable: boolean;
    isHidden: boolean;
    imageKey: string | null;
  }[];
}

export async function getVenue(slug: string): Promise<Venue | undefined> {
  const sample = getSampleVenue(slug);
  if (hasPublicApi() && sample) {
    try {
      const cats = await publicRequest<ApiMenuCategory[]>(`/menus/${sample.storefront.toLowerCase()}`);
      if (cats?.length) {
        const categories: MenuCategory[] = cats.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description ?? "",
            price: Number(i.price),
            tags: i.tags ?? [],
            isAvailable: i.isAvailable,
            isHidden: i.isHidden,
            slot: i.imageKey ?? undefined,
          })),
        }));
        return { ...sample, categories };
      }
    } catch {
      /* fall through to sample */
    }
  }
  return sample;
}
