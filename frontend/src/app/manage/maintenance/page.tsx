"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/internal/date-picker";
import { listAssets, listWorkOrders, createWorkOrder, updateWorkOrderStatus, createAsset, type AssetArea } from "@/lib/data/operations";
import { type Asset, type WorkOrder } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

const PRIORITY_TONE = { LOW: "neutral", NORMAL: "info", HIGH: "warning", CRITICAL: "danger" } as const;
const WO_STATUSES: WorkOrder["status"][] = ["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];
const WO_TYPES: WorkOrder["type"][] = ["CORRECTIVE", "PREVENTIVE", "INSPECTION"];
const WO_PRIORITIES: WorkOrder["priority"][] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const ASSET_STATUSES: Asset["status"][] = ["OPERATIONAL", "INSPECTION_DUE", "NEEDS_REPAIR", "UNDER_REPAIR", "DECOMMISSIONED"];
const ASSET_AREAS: AssetArea[] = ["ROOM", "POOL", "BAR", "RESTAURANT", "RECEPTION", "GYM", "LOUNGE", "KITCHEN", "EXTERIOR", "BACK_OF_HOUSE", "OTHER"];

export default function MaintenancePage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: listAssets });
  const { data: workOrders = [], isLoading } = useQuery({ queryKey: ["work-orders"], queryFn: listWorkOrders });
  const canUpdate = hasPermission("maintenance", "UPDATE");

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkOrder["status"] }) => updateWorkOrderStatus(id, status),
    onSuccess: () => { toast.success("Work order updated."); qc.invalidateQueries({ queryKey: ["work-orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assetColumns: Column<Asset>[] = [
    {
      key: "assetNumber", header: "Asset", sortValue: (a) => a.assetNumber,
      render: (a) => (
        <div>
          <p className="font-medium text-foreground">{a.name}</p>
          <p className="text-xs text-muted-foreground">{a.assetNumber} · {a.category}</p>
        </div>
      ),
    },
    { key: "location", header: "Location", render: (a) => <span className="text-muted-foreground">{a.location}</span> },
    { key: "nextInspection", header: "Next inspection", sortValue: (a) => a.nextInspection, render: (a) => <span className="text-muted-foreground">{a.nextInspection || "—"}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  ];

  const woColumns: Column<WorkOrder>[] = [
    {
      key: "workOrderNumber", header: "Work Order", sortValue: (w) => w.workOrderNumber,
      render: (w) => (
        <div>
          <p className="font-medium text-foreground">{w.workOrderNumber}</p>
          <p className="text-xs text-muted-foreground">{w.asset}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (w) => <Badge tone="neutral">{w.type.toLowerCase()}</Badge> },
    { key: "priority", header: "Priority", render: (w) => <Badge tone={PRIORITY_TONE[w.priority]}>{w.priority.toLowerCase()}</Badge> },
    { key: "assignedTo", header: "Assigned", render: (w) => <span className="text-muted-foreground">{w.assignedTo ?? "Unassigned"}</span> },
    { key: "estimatedCost", header: "Est. cost", align: "right", sortValue: (w) => w.estimatedCost, render: (w) => formatNaira(w.estimatedCost) },
    {
      key: "status", header: "Status",
      render: (w) =>
        canUpdate ? (
          <Select value={w.status} onValueChange={(v) => setStatus.mutate({ id: w.id, status: v as WorkOrder["status"] })}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{WO_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <StatusBadge status={w.status} />
        ),
    },
  ];

  const openWo = workOrders.filter((w) => w.status !== "COMPLETED").length;

  return (
    <PageShell
      title="Maintenance"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Maintenance" }]}
      actions={hasPermission("maintenance", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Work Order</Button>}
    >
      <Tabs defaultValue="workorders">
        <TabsList>
          <TabsTrigger value="workorders">Work Orders ({openWo})</TabsTrigger>
          <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="workorders" className="mt-4">
          <DataTable columns={woColumns} data={workOrders} isLoading={isLoading} emptyState={<EmptyState icon={Wrench} title="No work orders" />} />
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          {hasPermission("maintenance", "CREATE") && (
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setCreatingAsset(true)}><Plus size={15} /> Add asset</Button>
            </div>
          )}
          <DataTable columns={assetColumns} data={assets} emptyState={<EmptyState icon={Wrench} title="No assets" />} />
        </TabsContent>
      </Tabs>
      {creating && <WorkOrderDialog assets={assets} onClose={() => setCreating(false)} />}
      {creatingAsset && <AssetDialog onClose={() => setCreatingAsset(false)} />}
    </PageShell>
  );
}

function AssetDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ assetNumber: "", name: "", category: "", area: "OTHER" as AssetArea, roomNumber: "", location: "", status: "OPERATIONAL" as Asset["status"], nextInspection: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => createAsset({
      assetNumber: form.assetNumber.trim(), name: form.name.trim(), category: form.category.trim(),
      area: form.area, roomNumber: form.area === "ROOM" ? form.roomNumber.trim() || undefined : undefined,
      location: form.location.trim(), status: form.status, nextInspection: form.nextInspection || undefined,
    }),
    onSuccess: () => { toast.success("Asset added."); qc.invalidateQueries({ queryKey: ["assets"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.assetNumber.trim() && form.name.trim() && form.category.trim() && form.location.trim() && !save.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Asset</DialogTitle>
          <DialogDescription>Register a piece of equipment or infrastructure, and where it lives.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="a-num">Asset no.</Label><Input id="a-num" value={form.assetNumber} onChange={(e) => set("assetNumber", e.target.value)} placeholder="AST-0049" /></div>
            <div className="grid gap-1.5"><Label htmlFor="a-name">Name</Label><Input id="a-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="a-cat">Category</Label><Input id="a-cat" value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
            <div className="grid gap-1.5">
              <Label>Area</Label>
              <Select value={form.area} onValueChange={(v) => set("area", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_AREAS.map((a) => <SelectItem key={a} value={a} className="capitalize">{a.replace(/_/g, " ").toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.area === "ROOM" && (
              <div className="grid gap-1.5"><Label htmlFor="a-room">Room number</Label><Input id="a-room" value={form.roomNumber} onChange={(e) => set("roomNumber", e.target.value)} placeholder="e.g. 101" /></div>
            )}
            <div className="grid gap-1.5"><Label htmlFor="a-loc">Location detail</Label><Input id="a-loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Rooftop, Basement" /></div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Next inspection</Label><DatePicker value={form.nextInspection} onChange={(v) => set("nextInspection", v)} placeholder="Optional" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Add asset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkOrderDialog({ assets, onClose }: { assets: Asset[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ assetId: "", type: "CORRECTIVE" as WorkOrder["type"], priority: "NORMAL" as WorkOrder["priority"], assignedTo: "", estimatedCost: "0" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => createWorkOrder({
      assetId: form.assetId || undefined, type: form.type, priority: form.priority,
      assignedTo: form.assignedTo.trim() || undefined, estimatedCost: Number(form.estimatedCost) || 0,
    }),
    onSuccess: () => { toast.success("Work order created."); qc.invalidateQueries({ queryKey: ["work-orders"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
          <DialogDescription>Raise a maintenance work order.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Asset</Label>
            <Select value={form.assetId} onValueChange={(v) => set("assetId", v)}>
              <SelectTrigger><SelectValue placeholder="Select an asset (optional)" /></SelectTrigger>
              <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.assetNumber}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WO_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WO_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="w-assign">Assigned to</Label><Input id="w-assign" value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="w-cost">Est. cost</Label><Input id="w-cost" type="number" value={form.estimatedCost} onChange={(e) => set("estimatedCost", e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
