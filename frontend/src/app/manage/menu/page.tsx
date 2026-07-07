"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UtensilsCrossed, Plus, Pencil, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge, EmptyState } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listMenu, createMenuCategory, createMenuItem, updateMenuItem, deleteMenuItem,
  type MenuCategoryRow, type MenuItemRow, type MenuStorefront,
} from "@/lib/data/menu";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";

const STOREFRONTS: MenuStorefront[] = ["RESTAURANT", "LOUNGE", "BOUTIQUE"];

export default function MenuPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("pos.restaurant", "UPDATE");
  const [sf, setSf] = useState<MenuStorefront>("RESTAURANT");
  const [newCat, setNewCat] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ categoryId: string; item?: MenuItemRow } | null>(null);
  const { data: categories = [], isLoading } = useQuery({ queryKey: ["menu"], queryFn: listMenu });

  const shown = useMemo(() => categories.filter((c) => c.storefront === sf), [categories, sf]);

  return (
    <PageShell
      title="Menu & POS Items"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Menu" }]}
      actions={canEdit && <Button onClick={() => setNewCat(true)}><Plus size={16} /> New Category</Button>}
    >
      <p className="mb-5 max-w-2xl text-sm text-fg-soft">
        Items, prices, and availability for every storefront. These drive both the POS terminals and
        the public website menus. Prices are captured on each order at the time it&apos;s placed.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {STOREFRONTS.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setSf(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
              sf === s ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark" : "border-line-2 text-fg-soft hover:text-fg",
            )}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-fg-soft">Loading menu…</p>
      ) : shown.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No categories" description="Create a category to start adding items." />
      ) : (
        <div className="space-y-5">
          {shown.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} canEdit={canEdit} onAddItem={() => setItemDialog({ categoryId: cat.id })} onEditItem={(item) => setItemDialog({ categoryId: cat.id, item })} />
          ))}
        </div>
      )}

      {newCat && <CategoryDialog storefront={sf} onClose={() => setNewCat(false)} />}
      {itemDialog && <ItemDialog categoryId={itemDialog.categoryId} item={itemDialog.item} onClose={() => setItemDialog(null)} />}
    </PageShell>
  );
}

function CategoryCard({ cat, canEdit, onAddItem, onEditItem }: {
  cat: MenuCategoryRow; canEdit: boolean; onAddItem: () => void; onEditItem: (i: MenuItemRow) => void;
}) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateMenuItem(id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => { toast.success("Item removed."); qc.invalidateQueries({ queryKey: ["menu"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{cat.name}</CardTitle>
        {canEdit && <Button size="sm" variant="outline" onClick={onAddItem}><Plus size={14} /> Add item</Button>}
      </CardHeader>
      <CardContent className="p-0">
        {cat.items.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-fg-muted">No items yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cat.items.map((i) => (
              <li key={i.id} className={cn("flex items-center gap-3 px-5 py-3", i.isHidden && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-fg">
                    {i.name}
                    {i.isHidden && <Badge tone="neutral">hidden</Badge>}
                    {!i.isAvailable && !i.isHidden && <Badge tone="warning">unavailable</Badge>}
                  </p>
                  {i.description && <p className="truncate text-xs text-fg-muted">{i.description}</p>}
                </div>
                <span className="w-24 text-right text-sm font-medium text-fg">{formatNaira(i.price)}</span>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" title={i.isAvailable ? "Mark unavailable" : "Mark available"} disabled={toggle.isPending} onClick={() => toggle.mutate({ id: i.id, isAvailable: !i.isAvailable })}>
                      {i.isAvailable ? <Check size={14} className="text-ok" /> : <Check size={14} className="text-fg-muted" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onEditItem(i)}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => del.mutate(i.id)}><Trash2 size={14} className="text-danger" /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryDialog({ storefront, onClose }: { storefront: MenuStorefront; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => createMenuCategory({ storefront, name: name.trim() }),
    onSuccess: () => { toast.success("Category added."); qc.invalidateQueries({ queryKey: ["menu"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription className="capitalize">For the {storefront.toLowerCase()} storefront.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starters" /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ categoryId, item, onClose }: { categoryId: string; item?: MenuItemRow; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? "", description: item?.description ?? "", price: String(item?.price ?? ""),
    tags: (item?.tags ?? []).join(", "), isAvailable: item?.isAvailable ?? true,
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const base = { name: form.name.trim(), description: form.description.trim() || undefined, price: Number(form.price) || 0, tags, isAvailable: form.isAvailable };
      return isEdit ? updateMenuItem(item!.id, base) : createMenuItem({ categoryId, ...base });
    },
    onSuccess: () => { toast.success(isEdit ? "Item updated." : "Item added."); qc.invalidateQueries({ queryKey: ["menu"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.name.trim() && Number(form.price) > 0 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "New Item"}</DialogTitle>
          <DialogDescription>Item name, price, and availability.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div className="grid gap-1.5"><Label htmlFor="i-name">Name</Label><Input id="i-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-price">Price (₦)</Label><Input id="i-price" type="number" value={form.price} onChange={(e) => set("price", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="i-desc">Description</Label><Textarea id="i-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="i-tags">Tags (comma-separated)</Label><Input id="i-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Spicy, Vegetarian" /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg"><Checkbox checked={form.isAvailable} onCheckedChange={(v) => set("isAvailable", !!v)} /> Available to order</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} {isEdit ? "Save" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
