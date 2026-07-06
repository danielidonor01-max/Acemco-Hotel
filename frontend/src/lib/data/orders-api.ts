import { apiRequest, publicRequest } from "@/lib/api";
import { hasApi, hasPublicApi } from "@/lib/config";
import type { Order, OrderStatus, OrderSource } from "@/lib/orders";
import { venues, boutiqueProducts, type Storefront } from "@/lib/cms";
import { getVenue } from "@/lib/data/menus";

interface ApiMenuCat { id: string; name: string; items: { id: string; name: string; price: string | number; tags: string[]; isAvailable: boolean; isHidden: boolean }[] }

interface ApiOrderItem {
  menuItemId: string;
  quantity: number;
  unitPrice: string | number;
  notes?: string | null;
  menuItem?: { name: string } | null;
}
interface ApiOrder {
  id: string;
  orderNumber: string;
  storefront: Storefront;
  source: OrderSource;
  status: OrderStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  roomNumber?: string | null;
  tableNumber?: string | null;
  deliveryLocation?: string | null;
  specialInstructions?: string | null;
  totalAmount: string | number;
  createdAt: string;
  items: ApiOrderItem[];
}

const toOrder = (o: ApiOrder): Order => ({
  id: o.id,
  orderNumber: o.orderNumber,
  storefront: o.storefront,
  source: o.source,
  status: o.status,
  customerName: o.customerName ?? undefined,
  customerPhone: o.customerPhone ?? undefined,
  roomNumber: o.roomNumber ?? undefined,
  tableNumber: o.tableNumber ?? undefined,
  deliveryLocation: o.deliveryLocation ?? undefined,
  specialInstructions: o.specialInstructions ?? undefined,
  totalAmount: Number(o.totalAmount),
  createdAt: o.createdAt,
  lines: o.items.map((i) => ({
    menuItemId: i.menuItemId,
    name: i.menuItem?.name ?? "Item",
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    notes: i.notes ?? undefined,
  })),
});

export async function listOrders(): Promise<Order[]> {
  if (!hasApi()) return [];
  const { data } = await apiRequest<ApiOrder[]>("/orders");
  return data.map(toOrder);
}

export async function advanceOrder(id: string): Promise<void> {
  await apiRequest(`/orders/${id}/advance`, { method: "POST" });
}

export async function cancelOrder(id: string): Promise<void> {
  await apiRequest(`/orders/${id}/cancel`, { method: "POST" });
}

export interface NewOrder {
  storefront: Storefront | "BOUTIQUE";
  items: { menuItemId: string; quantity: number; notes?: string }[];
  tableNumber?: string;
  customerName?: string;
  specialInstructions?: string;
}

export async function createOrder(input: NewOrder): Promise<Order> {
  const { data } = await apiRequest<ApiOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "INTERNAL_POS" }),
  });
  return toOrder(data);
}

/* ---------------- POS catalogue (real menu-item IDs) ---------------- */

export interface Sellable {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  meta?: string;
}
export interface PosCatalogue {
  items: Sellable[];
  categories: string[];
  kind: "food" | "retail";
  /** true when items carry real DB ids and orders can be posted to the API. */
  live: boolean;
}

export async function getPosCatalogue(storefront: Storefront | "BOUTIQUE"): Promise<PosCatalogue> {
  if (storefront === "BOUTIQUE") {
    // Prefer the live boutique menu (real item IDs) so sales post to the API.
    if (hasPublicApi()) {
      try {
        const cats = await publicRequest<ApiMenuCat[]>("/menus/boutique");
        if (cats?.length) {
          const items: Sellable[] = cats.flatMap((c) =>
            c.items.filter((i) => !i.isHidden).map((i) => ({
              id: i.id, name: i.name, price: Number(i.price), category: c.name,
              available: i.isAvailable, meta: (i.tags ?? []).join(" · ") || undefined,
            })),
          );
          if (items.length) return { items, categories: [...new Set(items.map((i) => i.category))], kind: "retail", live: true };
        }
      } catch {
        /* fall through to local sample */
      }
    }
    const items: Sellable[] = boutiqueProducts.map((p) => ({
      id: p.id, name: p.name, price: p.price, category: p.category,
      available: p.stockQty > 0,
      meta: p.stockQty > 0 ? `${p.stockQty} in stock · ${p.sku}` : "Out of stock",
    }));
    return { items, categories: [...new Set(items.map((i) => i.category))], kind: "retail", live: false };
  }

  const sampleVenue = venues.find((v) => v.storefront === storefront);
  const venue = sampleVenue ? (await getVenue(sampleVenue.slug)) ?? sampleVenue : undefined;
  const items: Sellable[] = (venue?.categories ?? []).flatMap((c) =>
    c.items
      .filter((i) => !i.isHidden)
      .map((i) => ({
        id: i.id, name: i.name, price: i.price, category: c.name,
        available: i.isAvailable,
        meta: i.tags.join(" · ") || undefined,
      })),
  );
  return { items, categories: venue?.categories.map((c) => c.name) ?? [], kind: "food", live: hasApi() };
}
