"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, AlertTriangle, Boxes, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, StatCard, Button, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listInventory, createInventoryItem, updateInventoryItem } from "@/lib/data/operations";
import { type InventoryItem, type Department } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";

const DEPT_OPTIONS: Department[] = ["RESTAURANT", "LOUNGE", "BOUTIQUE", "HOUSEKEEPING", "MAINTENANCE", "OFFICE", "GENERAL"];
const DEPTS: (Department | "ALL")[] = ["ALL", ...DEPT_OPTIONS];

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [dept, setDept] = useState<Department | "ALL">("ALL");
  const [lowOnly, setLowOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const canEdit = hasPermission("inventory", "UPDATE");
  const { data: items = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: listInventory });

  const filtered = useMemo(
    () => items.filter((i) => (dept === "ALL" || i.department === dept) && (!lowOnly || i.currentQty < i.minStockLevel)),
    [items, dept, lowOnly],
  );
  const lowCount = items.filter((i) => i.currentQty < i.minStockLevel).length;
  const stockValue = items.reduce((s, i) => s + i.currentQty * i.unitCost, 0);

  const columns: Column<InventoryItem>[] = [
    {
      key: "name", header: "Item", sortValue: (i) => i.name,
      render: (i) => (
        <div>
          <p className="font-medium text-foreground">{i.name}</p>
          <p className="text-xs text-muted-foreground">{i.sku}</p>
        </div>
      ),
    },
    { key: "department", header: "Department", render: (i) => <span className="capitalize text-muted-foreground">{i.department.toLowerCase()}</span> },
    { key: "location", header: "Location", render: (i) => <span className="text-muted-foreground">{i.location}</span> },
    {
      key: "currentQty", header: "In stock", align: "right", sortValue: (i) => i.currentQty,
      render: (i) => {
        const low = i.currentQty < i.minStockLevel;
        return (
          <span className={cn("inline-flex items-center gap-1.5 font-medium", low ? "text-warn" : "text-foreground")}>
            {low && <AlertTriangle size={13} />}
            {i.currentQty} {i.unit} <span className="text-muted-foreground">/ min {i.minStockLevel}</span>
          </span>
        );
      },
    },
    { key: "unitCost", header: "Unit cost", align: "right", sortValue: (i) => i.unitCost, render: (i) => formatNaira(i.unitCost) },
    {
      key: "value", header: "Value", align: "right", sortValue: (i) => i.currentQty * i.unitCost,
      render: (i) => <span className="font-medium text-foreground">{formatNaira(i.currentQty * i.unitCost)}</span>,
    },
  ];

  return (
    <PageShell
      title="Inventory"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Inventory" }]}
      actions={hasPermission("inventory", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Item</Button>}
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Items" value={String(items.length)} icon={Boxes} />
        <StatCard title="Low Stock Alerts" value={String(lowCount)} delta="Below minimum level" deltaType={lowCount ? "negative" : "neutral"} icon={AlertTriangle} />
        <StatCard title="Stock Value" value={formatNaira(stockValue)} icon={Wallet} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DEPTS.map((d) => (
          <button
            type="button"
            key={d}
            onClick={() => setDept(d)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
              dept === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {d.toLowerCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLowOnly((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
            lowOnly ? "border-warn bg-warn-bg text-warn" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertTriangle size={13} /> Low stock only
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        onRowClick={canEdit ? (i) => setEditing(i) : undefined}
        emptyState={<EmptyState icon={Package} title="No items match" description="Try a different department or clear the low-stock filter." />}
      />
      {creating && <ItemDialog onClose={() => setCreating(false)} />}
      {editing && <ItemDialog item={editing} onClose={() => setEditing(null)} />}
    </PageShell>
  );
}

function ItemDialog({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? "", sku: item?.sku ?? "", department: (item?.department ?? "GENERAL") as Department, unit: item?.unit ?? "",
    currentQty: String(item?.currentQty ?? 0), minStockLevel: String(item?.minStockLevel ?? 0), unitCost: String(item?.unitCost ?? 0), location: item?.location ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(), department: form.department, unit: form.unit.trim(),
        currentQty: Number(form.currentQty) || 0, minStockLevel: Number(form.minStockLevel) || 0,
        unitCost: Number(form.unitCost) || 0, location: form.location.trim() || undefined,
      };
      return isEdit ? updateInventoryItem(item!.id, payload) : createInventoryItem({ ...payload, sku: form.sku.trim() });
    },
    onSuccess: () => { toast.success(isEdit ? "Item updated." : "Item added."); qc.invalidateQueries({ queryKey: ["inventory"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.name.trim() && form.sku.trim() && form.unit.trim() && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "New Inventory Item"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update stock levels, cost, or location." : "Add an item to the stock register."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="i-name">Name</Label><Input id="i-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-sku">SKU</Label><Input id="i-sku" value={form.sku} disabled={isEdit} onChange={(e) => set("sku", e.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => set("department", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPT_OPTIONS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="i-unit">Unit</Label><Input id="i-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="kg, piece, bottle…" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5"><Label htmlFor="i-qty">In stock</Label><Input id="i-qty" type="number" value={form.currentQty} onChange={(e) => set("currentQty", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-min">Min level</Label><Input id="i-min" type="number" value={form.minStockLevel} onChange={(e) => set("minStockLevel", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="i-cost">Unit cost</Label><Input id="i-cost" type="number" value={form.unitCost} onChange={(e) => set("unitCost", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="i-loc">Location</Label><Input id="i-loc" value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Add item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
