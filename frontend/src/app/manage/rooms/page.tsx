"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  User,
  CalendarDays,
  Sparkles,
  Wrench,
  Package,
  Star,
  Clock,
  ArrowRight,
  UserCheck,
  UserMinus,
  BedDouble,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, StatusBadge, Badge, Button } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  listRooms,
  updateRoomStatus,
  getRoomDetail,
  type ManageRoom,
  type RoomStatus,
  type ArrivalSummary,
} from "@/lib/data/manage-rooms";
import { assignRoom } from "@/lib/data/availability";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const STATUSES: RoomStatus[] = [
  "AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "INSPECTION", "MAINTENANCE", "OUT_OF_ORDER", "BLOCKED",
];

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "2-digit" });
}

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
      {/* Filter chips */}
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
                  <RoomCard key={r.id} room={r} onClick={() => setSelected(r)} />
                ))}
              </div>
            </div>
          ))}
          {floors.length === 0 && <p className="text-sm text-fg-soft">No rooms match this status.</p>}
        </div>
      )}

      {selected && <RoomDetailModal room={selected} canEdit={canEdit} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

/* ─────────────── Room Card ─────────────── */
function RoomCard({ room: r, onClick }: { room: ManageRoom; onClick: () => void }) {
  const occ = r.currentReservation;
  const upcoming = r.upcomingReservation;
  return (
    <Card
      className="cursor-pointer p-4 transition-all hover:border-brand-primary/50 hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span className="text-lg font-bold text-fg">{r.roomNumber}</span>
        <StatusDot status={r.status} />
      </div>
      <p className="mt-0.5 truncate text-xs text-fg-muted">{r.roomTypeName}</p>

      {/* Occupant hint */}
      {occ && (
        <p className="mt-2 flex items-center gap-1 truncate text-xs font-medium text-fg" title={occ.guestName}>
          <User size={11} className="shrink-0 text-brand-primary" />
          <span className="truncate">{occ.guestName}</span>
          {occ.isVip && <Star size={10} className="shrink-0 text-brand-primary-dark" fill="currentColor" />}
        </p>
      )}

      {/* Upcoming arrival hint */}
      {!occ && upcoming && (
        <p className="mt-2 flex items-center gap-1 truncate text-xs text-info" title={`Arriving ${upcoming.checkInDate}`}>
          <Clock size={11} className="shrink-0" />
          <span className="truncate">{upcoming.guestName}</span>
        </p>
      )}

      <div className="mt-2"><StatusBadge status={r.status} /></div>
    </Card>
  );
}

/* ─────────────── Room Detail Modal ─────────────── */
function RoomDetailModal({ room, canEdit, onClose }: { room: ManageRoom; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["room-detail", room.id], queryFn: () => getRoomDetail(room.id) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["room-detail", room.id] });
  };

  const change = useMutation({
    mutationFn: (status: RoomStatus) => updateRoomStatus(room.id, status),
    onSuccess: () => { toast.success(`Room ${room.roomNumber} updated.`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: ({ resId, roomId }: { resId: string; roomId: string | null }) => assignRoom(resId, roomId),
    onSuccess: (_d, vars) => {
      toast.success(vars.roomId ? `Room ${room.roomNumber} assigned.` : "Assignment cleared.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const occ = data?.occupant;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Room {room.roomNumber}</DialogTitle>
          <DialogDescription>
            {room.roomTypeName} · Floor {room.floor} ·{" "}
            <span className="capitalize">{room.status.replace(/_/g, " ").toLowerCase()}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-fg-muted">Loading room…</p>
        ) : (
          <div className="grid gap-5 text-sm">

            {/* ── Occupancy ── */}
            <Section icon={User} title="Occupancy">
              {occ ? (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 font-medium text-fg">
                    {occ.name}
                    {occ.isVip && <Star size={13} className="text-brand-primary-dark" fill="currentColor" />}
                  </p>
                  <p className="text-fg-muted">{occ.phone}</p>
                  <p className="flex items-center gap-1.5 text-fg-soft">
                    <CalendarDays size={13} /> {fmt(occ.checkInDate)} → {fmt(occ.checkOutDate)}
                  </p>
                  <Link
                    href={`/manage/reservations/${occ.reservationId}`}
                    onClick={onClose}
                    className="inline-block text-brand-primary-dark hover:underline"
                  >
                    {occ.reservationNumber} →
                  </Link>
                </div>
              ) : (
                <p className="text-fg-muted">No current occupant.</p>
              )}
            </Section>

            {/* ── Assigned Upcoming Arrivals ── */}
            <Section icon={UserCheck} title="Assigned Upcoming Arrivals">
              {data && data.assignedUpcoming.length > 0 ? (
                <ul className="space-y-2">
                  {data.assignedUpcoming.map((res) => (
                    <ArrivalRow
                      key={res.id}
                      arrival={res}
                      action={
                        canEdit
                          ? {
                              label: "Clear",
                              tone: "danger" as const,
                              icon: UserMinus,
                              loading: assign.isPending && assign.variables?.resId === res.id,
                              onClick: () => assign.mutate({ resId: res.id, roomId: null }),
                            }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted">No upcoming stays assigned to this room.</p>
              )}
            </Section>

            {/* ── Unassigned Arrivals (same type) ── */}
            <Section icon={BedDouble} title={`Unassigned Arrivals · ${room.roomTypeName}`}>
              {data && data.unassignedArrivals.length > 0 ? (
                <ul className="space-y-2">
                  {data.unassignedArrivals.map((res) => (
                    <ArrivalRow
                      key={res.id}
                      arrival={res}
                      action={
                        canEdit
                          ? {
                              label: "Assign",
                              tone: "success" as const,
                              icon: ArrowRight,
                              loading: assign.isPending && assign.variables?.resId === res.id,
                              onClick: () => assign.mutate({ resId: res.id, roomId: room.id }),
                            }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted">No unassigned arrivals for this room type.</p>
              )}
            </Section>

            {/* ── Housekeeping ── */}
            <Section icon={Sparkles} title="Housekeeping">
              <p className="text-fg-soft">
                Assigned: <span className="text-fg">{data?.assignedHousekeeper ?? "Unassigned"}</span>
              </p>
              {data && data.housekeeping.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {data.housekeeping.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="capitalize text-fg-soft">{t.type.replace(/_/g, " ").toLowerCase()}</span>
                      <Badge tone={t.status === "COMPLETED" ? "success" : t.status === "IN_PROGRESS" ? "info" : "neutral"}>
                        {t.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-fg-muted">No tasks.</p>
              )}
            </Section>

            {/* ── Maintenance ── */}
            <Section icon={Wrench} title="Maintenance">
              {data && data.maintenanceIssues.length > 0 ? (
                <ul className="space-y-1">
                  {data.maintenanceIssues.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-2">
                      <span className="text-fg-soft">{w.workOrderNumber} · {w.asset}</span>
                      <Badge tone={w.priority === "CRITICAL" || w.priority === "HIGH" ? "danger" : "warning"}>
                        {w.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted">No open issues.</p>
              )}
            </Section>

            {/* ── Assets ── */}
            <Section icon={Package} title="Assets in this room">
              {data && data.assets.length > 0 ? (
                <ul className="space-y-1">
                  {data.assets.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="text-fg-soft">
                        {a.name} <span className="text-fg-muted">· {a.assetNumber}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-muted">No assets registered here.</p>
              )}
            </Section>

            {/* ── Status Control ── */}
            {canEdit && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Set status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      variant={s === room.status ? "default" : "outline"}
                      size="sm"
                      disabled={change.isPending}
                      onClick={() => change.mutate(s)}
                    >
                      {change.isPending && change.variables === s && <Loader2 size={13} className="animate-spin" />}
                      <span className="capitalize">{s.replace(/_/g, " ").toLowerCase()}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Arrival Row ─────────────── */
interface ArrivalAction {
  label: string;
  tone: "success" | "danger";
  icon: typeof ArrowRight;
  loading: boolean;
  onClick: () => void;
}

function ArrivalRow({ arrival, action }: { arrival: ArrivalSummary; action?: ArrivalAction }) {
  const ActionIcon = action?.icon;
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium text-fg">
          <span className="truncate">{arrival.guestName}</span>
          {arrival.isVip && <Star size={11} className="shrink-0 text-brand-primary-dark" fill="currentColor" />}
        </p>
        <p className="text-xs text-fg-muted">{arrival.reservationNumber}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-soft">
          <CalendarDays size={11} />
          {fmt(arrival.checkInDate)} → {fmt(arrival.checkOutDate)}
        </p>
      </div>
      {action && (
        <button
          type="button"
          disabled={action.loading}
          onClick={action.onClick}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            action.tone === "success"
              ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
              : "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
          )}
        >
          {action.loading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            ActionIcon && <ActionIcon size={11} />
          )}
          {action.label}
        </button>
      )}
    </li>
  );
}

/* ─────────────── Helpers ─────────────── */
function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Icon size={13} /> {title}
      </p>
      {children}
    </div>
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
