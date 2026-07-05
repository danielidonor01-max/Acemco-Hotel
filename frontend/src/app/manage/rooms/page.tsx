"use client";

import { useMemo, useState } from "react";
import { PageShell, Card, StatusBadge } from "@/components/internal/ui";
import { type RoomStatus, type Room } from "@/lib/mock";
import { useRooms } from "@/stores/rooms.store";
import { getRoomType } from "@/lib/cms";
import { cn } from "@/lib/utils";

const STATUSES: RoomStatus[] = [
  "AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "INSPECTION", "MAINTENANCE", "OUT_OF_ORDER", "BLOCKED",
];

export default function RoomsAdminPage() {
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const rooms = useRooms((s) => s.rooms);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rooms) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rooms]);

  const floors = useMemo(() => {
    const byFloor = new Map<number, Room[]>();
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
      {/* Status summary / filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip label="All" count={rooms.length} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s.replace(/_/g, " ").toLowerCase()} count={counts[s] ?? 0} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      <div className="space-y-8">
        {floors.map(([floor, list]) => (
          <div key={floor}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">Floor {floor}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {list.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-lg font-bold text-fg">{r.roomNumber}</span>
                    <StatusDot status={r.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-fg-muted">{getRoomType(r.roomTypeSlug)?.name}</p>
                  <div className="mt-3"><StatusBadge status={r.status} /></div>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {floors.length === 0 && <p className="text-sm text-fg-soft">No rooms match this status.</p>}
      </div>
    </PageShell>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
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
