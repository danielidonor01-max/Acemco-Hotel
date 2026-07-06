"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, StatusBadge, Button } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listRooms, updateRoomStatus, type ManageRoom, type RoomStatus } from "@/lib/data/manage-rooms";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const STATUSES: RoomStatus[] = [
  "AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "INSPECTION", "MAINTENANCE", "OUT_OF_ORDER", "BLOCKED",
];

export default function RoomsAdminPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("rooms", "UPDATE");
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const [selected, setSelected] = useState<ManageRoom | null>(null);
  const { data: rooms = [], isLoading } = useQuery({ queryKey: ["rooms"], queryFn: listRooms });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rooms) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rooms]);

  const floors = useMemo(() => {
    const byFloor = new Map<number, ManageRoom[]>();
    for (const r of rooms) {
      if (filter !== "ALL" && r.status !== filter) continue;
      if (!byFloor.has(r.floor)) byFloor.set(r.floor, []);
      byFloor.get(r.floor)!.push(r);
    }
    return [...byFloor.entries()].sort((a, b) => a[0] - b[0]);
  }, [filter, rooms]);

  return (
    <PageShell
      title="Rooms"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Rooms" }]}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip label="All" count={rooms.length} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s.replace(/_/g, " ").toLowerCase()} count={counts[s] ?? 0} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-fg-soft">Loading rooms…</p>
      ) : (
        <div className="space-y-8">
          {floors.map(([floor, list]) => (
            <div key={floor}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">Floor {floor}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {list.map((r) => (
                  <Card
                    key={r.id}
                    className={cn("p-4", canEdit && "cursor-pointer transition-colors hover:border-brand-primary/50")}
                    onClick={canEdit ? () => setSelected(r) : undefined}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-lg font-bold text-fg">{r.roomNumber}</span>
                      <StatusDot status={r.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-fg-muted">{r.roomTypeName}</p>
                    <div className="mt-3"><StatusBadge status={r.status} /></div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {floors.length === 0 && <p className="text-sm text-fg-soft">No rooms match this status.</p>}
        </div>
      )}

      {selected && <StatusDialog room={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

function StatusDialog({ room, onClose }: { room: ManageRoom; onClose: () => void }) {
  const qc = useQueryClient();
  const change = useMutation({
    mutationFn: (status: RoomStatus) => updateRoomStatus(room.id, status),
    onSuccess: () => { toast.success(`Room ${room.roomNumber} updated.`); qc.invalidateQueries({ queryKey: ["rooms"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Room {room.roomNumber}</DialogTitle>
          <DialogDescription>{room.roomTypeName} · Floor {room.floor}. Set a new status.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={s === room.status ? "default" : "outline"}
              size="sm"
              disabled={change.isPending}
              onClick={() => (s === room.status ? onClose() : change.mutate(s))}
            >
              {change.isPending && change.variables === s && <Loader2 size={13} className="animate-spin" />}
              <span className="capitalize">{s.replace(/_/g, " ").toLowerCase()}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
        active ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark" : "border-line-2 text-fg-soft hover:text-fg",
      )}
    >
      {label} <span className="text-fg-muted">{count}</span>
    </button>
  );
}

const DOT: Record<string, string> = {
  AVAILABLE: "bg-ok", OCCUPIED: "bg-brand-primary", RESERVED: "bg-info",
  CLEANING: "bg-warn", INSPECTION: "bg-warn", MAINTENANCE: "bg-warn",
  OUT_OF_ORDER: "bg-danger", BLOCKED: "bg-danger",
};
function StatusDot({ status }: { status: RoomStatus }) {
  return <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", DOT[status] ?? "bg-fg-muted")} />;
}
