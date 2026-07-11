import { apiRequest, publicRequest } from "@/lib/api";
import { hasPublicApi } from "@/lib/config";
import type { Order, OrderStatus, OrderSource } from "@/lib/orders";
import { type Storefront } from "@/lib/cms";

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

/** Live menu for a storefront, or null when the API has none. Never a sample. */
async function fetchLiveMenu(storefront: Storefront | "BOUTIQUE"): Promise<Omit<PosCatalogue, "kind" | "live"> | null> {
  if (!hasPublicApi()) return null;
  try {
    const cats = await publicRequest<ApiMenuCat[]>(`/menus/${storefront.toLowerCase()}`);
    const items: Sellable[] = (cats ?? []).flatMap((c) =>
      c.items
        .filter((i) => !i.isHidden)
        .map((i) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price),
          category: c.name,
          available: i.isAvailable,
          meta: (i.tags ?? []).join(" · ") || undefined,
        })),
    );
    if (!items.length) return null;
    return { items, categories: [...new Set(items.map((i) => i.category))] };
  } catch {
    return null;
  }
}

/**
 * The sellable catalogue, sourced ONLY from the live menu so every line carries a
 * real DB `menuItemId` and the sale can actually be posted.
 *
 * There is deliberately no sample fallback. It used to fall back to hardcoded
 * items whose ids don't exist in the database, and the terminal then routed the
 * sale into a client-side store — staff rang up real money that was never
 * persisted and never reached Orders or Finance. An unpopulated menu now yields
 * `live: false` with no items, and the terminal refuses to sell (see POSTerminal).
 */
export async function getPosCatalogue(storefront: Storefront | "BOUTIQUE"): Promise<PosCatalogue> {
  const kind: PosCatalogue["kind"] = storefront === "BOUTIQUE" ? "retail" : "food";
  const menu = await fetchLiveMenu(storefront);
  if (!menu) return { items: [], categories: [], kind, live: false };
  return { ...menu, kind, live: true };
}
