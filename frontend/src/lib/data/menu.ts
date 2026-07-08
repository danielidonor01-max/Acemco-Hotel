import { apiRequest } from "@/lib/api";

export type MenuStorefront = "RESTAURANT" | "LOUNGE" | "BOUTIQUE";

export interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageKey: string | null;
  tags: string[];
  isAvailable: boolean;
  isHidden: boolean;
}
export interface MenuCategoryRow {
  id: string;
  storefront: MenuStorefront;
  name: string;
  isActive: boolean;
  items: MenuItemRow[];
}

export async function listMenu(): Promise<MenuCategoryRow[]> {
  const { data } = await apiRequest<any[]>("/menu");
  return data.map((c) => ({
    id: c.id, storefront: c.storefront, name: c.name, isActive: c.isActive,
    items: (c.items ?? []).map((i: any) => ({ ...i, price: Number(i.price), tags: i.tags ?? [], imageKey: i.imageKey ?? null })),
  }));
}

export async function createMenuCategory(input: { storefront: MenuStorefront; name: string }): Promise<void> {
  await apiRequest("/menu/categories", { method: "POST", body: JSON.stringify(input) });
}

export interface NewMenuItem {
  categoryId: string; name: string; description?: string; price: number; imageKey?: string; tags?: string[]; isAvailable?: boolean;
}
export async function createMenuItem(input: NewMenuItem): Promise<void> {
  await apiRequest("/menu/items", { method: "POST", body: JSON.stringify(input) });
}
export async function updateMenuItem(id: string, input: Partial<Omit<NewMenuItem, "categoryId">> & { isHidden?: boolean }): Promise<void> {
  await apiRequest(`/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function deleteMenuItem(id: string): Promise<void> {
  await apiRequest(`/menu/items/${id}`, { method: "DELETE" });
}
