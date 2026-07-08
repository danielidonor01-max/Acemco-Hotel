"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listRoomTypes, createRoomType, updateRoomType, deleteRoomType,
  type ManagedRoomType,
} from "@/lib/data/room-types";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

export default function RoomTypesPage() {
  const { hasPermission } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedRoomType | null>(null);
  const { data: types = [], isLoading } = useQuery({ queryKey: ["room-types"], queryFn: listRoomTypes });

  const columns: Column<ManagedRoomType>[] = [
    { key: "name", header: "Room type", sortValue: (t) => t.name, render: (t) => (
      <div><span className="font-medium text-foreground">{t.name}</span><span className="ml-2 text-xs text-fg-muted">{t.slug}</span></div>
    ) },
    { key: "basePrice", header: "Base price", align: "right", sortValue: (t) => t.basePrice, render: (t) => <span className="tabular-nums">{formatNaira(t.basePrice)}</span> },
    { key: "maxOccupancy", header: "Sleeps", align: "center", sortValue: (t) => t.maxOccupancy, render: (t) => t.maxOccupancy },
    { key: "bedConfiguration", header: "Beds", render: (t) => <span className="text-muted-foreground">{t.bedConfiguration || "—"}</span> },
    { key: "roomCount", header: "Rooms", align: "center", sortValue: (t) => t.roomCount, render: (t) => <span className="text-muted-foreground">{t.roomCount}</span> },
    { key: "isActive", header: "Status", render: (t) => <Badge tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "active" : "inactive"}</Badge> },
  ];

  return (
    <PageShell
      title="Room Types"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Room Types" }]}
      actions={hasPermission("rooms", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Room Type</Button>}
    >
      <DataTable
        columns={columns}
        data={types}
        isLoading={isLoading}
        onRowClick={(t) => setEditing(t)}
        emptyState={<EmptyState icon={BedDouble} title="No room types" description="Add a room type (category) that rooms and reservations are booked against." />}
      />
      {creating && <RoomTypeDialog onClose={() => setCreating(false)} />}
      {editing && <RoomTypeDialog roomType={editing} onClose={() => setEditing(null)} />}
    </PageShell>
  );
}

function RoomTypeDialog({ roomType, onClose }: { roomType?: ManagedRoomType; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const editingExisting = !!roomType;
  const [form, setForm] = useState({
    name: roomType?.name ?? "",
    description: roomType?.description ?? "",
    bedConfiguration: roomType?.bedConfiguration ?? "",
    maxOccupancy: roomType?.maxOccupancy ?? 2,
    basePrice: roomType ? String(roomType.basePrice) : "",
    features: (roomType?.features ?? []).join(", "),
    isActive: roomType?.isActive ?? true,
  });
  const set = (k: keyof typeof form, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["room-types"] });
  const payload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    bedConfiguration: form.bedConfiguration.trim() || undefined,
    maxOccupancy: Number(form.maxOccupancy),
    basePrice: form.basePrice ? Number(form.basePrice) : 0,
    features: form.features.split(",").map((f) => f.trim()).filter(Boolean),
    isActive: form.isActive,
  });

  const save = useMutation({
    mutationFn: () => (editingExisting ? updateRoomType(roomType!.id, payload()) : createRoomType(payload())),
    onSuccess: () => { toast.success(editingExisting ? "Room type updated." : "Room type added."); invalidate(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteRoomType(roomType!.id),
    onSuccess: () => { toast.success("Room type deleted."); invalidate(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.name.trim() && !save.isPending;
  const inUse = (roomType?.roomCount ?? 0) > 0 || (roomType?.reservationCount ?? 0) > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingExisting ? "Edit room type" : "New room type"}</DialogTitle>
          <DialogDescription>
            {editingExisting
              ? "The slug is fixed once created (public-site links depend on it)."
              : "A category rooms and reservations are booked against. The slug is generated from the name."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="rt-name">Name</Label><Input id="rt-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Deluxe King" /></div>
          <div className="grid gap-1.5"><Label htmlFor="rt-desc">Description</Label><Input id="rt-desc" value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="rt-price">Base price (₦ / night)</Label><Input id="rt-price" type="number" min={0} value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} /></div>
            <div className="grid gap-1.5">
              <Label>Max occupancy</Label>
              <Select value={String(form.maxOccupancy)} onValueChange={(v) => set("maxOccupancy", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="rt-bed">Bed configuration</Label><Input id="rt-bed" value={form.bedConfiguration} onChange={(e) => set("bedConfiguration", e.target.value)} placeholder="e.g. 1 King bed" /></div>
          <div className="grid gap-1.5"><Label htmlFor="rt-feat">Features (comma-separated)</Label><Input id="rt-feat" value={form.features} onChange={(e) => set("features", e.target.value)} placeholder="Sea view, Minibar, Balcony" /></div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.isActive ? "active" : "inactive"} onValueChange={(v) => set("isActive", v === "active")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active — bookable</SelectItem>
                <SelectItem value="inactive">Inactive — hidden from new bookings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {editingExisting && (
            <p className="text-xs text-fg-muted">{roomType!.roomCount} room(s) · {roomType!.reservationCount} reservation(s) use this type.</p>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <div>
            {editingExisting && hasPermission("rooms", "DELETE") && (
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()} title={inUse ? "In use — will be blocked; deactivate instead" : "Delete room type"}>
                {remove.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} {editingExisting ? "Save changes" : "Add room type"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
