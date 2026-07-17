"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Users, Trash2, Building2, CalendarRange, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Modal } from "@/components/internal/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import { useRoomTypes } from "@/lib/data/room-types";
import { getGroups, getGroup, createGroup, cancelGroup, type GroupRoomLine } from "@/lib/data/groups";
import { formatNaira, cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function GroupsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canCreate = hasPermission("reservations", "CREATE");

  const [adding, setAdding] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({ queryKey: ["groups"], queryFn: () => getGroups(40) });

  return (
    <PageShell
      title="Group Bookings"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Group Bookings" }]}
      actions={canCreate ? <Button onClick={() => setAdding(true)}><Plus size={14} /> New group</Button> : undefined}
    >
      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <p className="text-sm text-fg-muted">
            Several rooms booked together — a wedding party, a company offsite. A group is reserved all-or-nothing:
            if any room can&apos;t be placed, none are, so you never end up half-booked.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-fg-muted"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading…</p>
          ) : groups.length === 0 ? (
            <div className="rounded-md border border-line bg-brand-surface-2 px-3 py-8 text-center">
              <Users size={22} className="mx-auto text-fg-muted" strokeWidth={1.5} />
              <p className="mt-3 font-medium text-fg">No group bookings yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-fg-soft">Book multiple rooms as one unit — one organiser, one combined bill.</p>
              {canCreate && <Button className="mt-4" size="sm" onClick={() => setAdding(true)}><Plus size={14} /> New group</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-muted">
                    <th className="pb-2 pr-3 font-medium">Group</th>
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Company</th>
                    <th className="pb-2 pr-3 text-right font-medium">Rooms</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="cursor-pointer border-b border-line/60 hover:bg-brand-surface-2" onClick={() => setDetailId(g.id)}>
                      <td className="py-2.5 pr-3 font-medium text-fg">{g.groupNumber}</td>
                      <td className="py-2.5 pr-3 text-fg-soft">{g.name}</td>
                      <td className="py-2.5 pr-3 text-fg-soft">{g.company?.name ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-fg-soft">{g._count?.reservations ?? "—"}</td>
                      <td className="py-2.5 whitespace-nowrap text-fg-muted">{new Date(g.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {adding && (
        <NewGroupDialog onClose={() => setAdding(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["groups"] }); setAdding(false); }} />
      )}
      {detailId && (
        <GroupDetail id={detailId} canCancel={hasPermission("reservations", "UPDATE")} onClose={() => setDetailId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["groups"] })} />
      )}
    </PageShell>
  );
}

function NewGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { roomTypes } = useRoomTypes();
  const firstSlug = roomTypes[0]?.slug ?? "";
  const [name, setName] = useState("");
  const [org, setOrg] = useState({ firstName: "", lastName: "", phone: "", whatsapp: "", email: "" });
  const [rooms, setRooms] = useState<GroupRoomLine[]>([{ roomTypeSlug: firstSlug, checkInDate: today(), checkOutDate: plusDays(1), adults: 2, children: 0 }]);

  const addRoom = () => setRooms((r) => [...r, { roomTypeSlug: firstSlug || r[0]?.roomTypeSlug || "", checkInDate: today(), checkOutDate: plusDays(1), adults: 2, children: 0 }]);
  const setRoom = (i: number, patch: Partial<GroupRoomLine>) => setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRoom = (i: number) => setRooms((rs) => rs.filter((_, j) => j !== i));

  const create = useMutation({
    mutationFn: () => createGroup({
      name: name.trim(),
      organiser: { ...org, whatsapp: org.whatsapp || undefined, email: org.email || undefined },
      rooms: rooms.map((r) => ({ ...r, roomTypeSlug: r.roomTypeSlug || firstSlug })),
    }),
    onSuccess: (res) => { toast.success(`${res.group.groupNumber} booked — ${res.rooms} rooms, ${formatNaira(res.total)}.`); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = name.trim() && org.firstName && org.lastName && org.phone && rooms.length > 0 &&
    rooms.every((r) => r.roomTypeSlug && r.checkInDate && r.checkOutDate && new Date(r.checkOutDate) > new Date(r.checkInDate));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New group booking</DialogTitle>
          <DialogDescription>One organiser holds the group; each room can have its own type, dates, and occupancy. It books all-or-nothing.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label htmlFor="g-name">Group name</Label>
            <Input id="g-name" placeholder="Adeyemi wedding party" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">Organiser</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="First name" value={org.firstName} onChange={(e) => setOrg({ ...org, firstName: e.target.value })} />
              <Input placeholder="Last name" value={org.lastName} onChange={(e) => setOrg({ ...org, lastName: e.target.value })} />
              <Input placeholder="Phone" value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
              <Input placeholder="WhatsApp (optional — defaults to phone)" value={org.whatsapp} onChange={(e) => setOrg({ ...org, whatsapp: e.target.value })} />
              <Input placeholder="Email (optional)" className="sm:col-span-2" value={org.email} onChange={(e) => setOrg({ ...org, email: e.target.value })} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Rooms ({rooms.length})</p>
              <Button size="sm" variant="ghost" onClick={addRoom}><Plus size={13} /> Add room</Button>
            </div>
            <div className="space-y-2">
              {rooms.map((r, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-line p-2 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
                  <Select value={r.roomTypeSlug} onValueChange={(v) => setRoom(i, { roomTypeSlug: v })}>
                    <SelectTrigger><SelectValue placeholder="Room type" /></SelectTrigger>
                    <SelectContent>{roomTypes.map((t) => <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" value={r.checkInDate} onChange={(e) => setRoom(i, { checkInDate: e.target.value })} />
                  <Input type="date" min={r.checkInDate} value={r.checkOutDate} onChange={(e) => setRoom(i, { checkOutDate: e.target.value })} />
                  <Select value={String(r.adults)} onValueChange={(v) => setRoom(i, { adults: Number(v) })}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <button type="button" onClick={() => removeRoom(i)} disabled={rooms.length === 1} className="text-fg-muted hover:text-danger disabled:opacity-30" aria-label="Remove room">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-muted">Each room is priced per night through your rate rules. Availability is checked for the whole group at once.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} Book {rooms.length} room{rooms.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  CONFIRMED: "success", CHECKED_IN: "info", CHECKED_OUT: "neutral", PENDING: "warning", CANCELLED: "danger", NO_SHOW: "danger",
};

function GroupDetail({ id, canCancel, onClose, onChanged }: { id: string; canCancel: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: g, isLoading } = useQuery({ queryKey: ["group", id], queryFn: () => getGroup(id) });
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancel = useMutation({
    mutationFn: () => cancelGroup(id),
    onSuccess: (r) => {
      toast.success(`${r.cancelled} room(s) cancelled${r.totalFee > 0 ? ` · fees ${formatNaira(r.totalFee)}` : ""}${r.skipped.length ? ` · ${r.skipped.length} left (already in-house)` : ""}.`);
      qc.invalidateQueries({ queryKey: ["group", id] });
      onChanged();
      setConfirmCancel(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const n = (v: string | number) => Number(v);
  const cancellable = g?.reservations.some((r) => ["PENDING", "CONFIRMED"].includes(r.status));

  return (
    <Modal open onClose={onClose} title={g ? `${g.groupNumber} · ${g.name}` : "Group"} description={g?.company ? g.company.name : undefined} size="2xl">
      {isLoading || !g ? (
        <p className="py-8 text-center text-sm text-muted-foreground"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rooms" value={String(g.summary.rooms)} icon={CalendarRange} />
            <Stat label="Active" value={String(g.summary.activeRooms)} icon={Users} />
            <Stat label="Total value" value={formatNaira(g.summary.totalValue)} icon={Building2} />
            <Stat label="Billed to date" value={formatNaira(g.summary.billedToDate)} icon={Building2} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Reservation</th>
                  <th className="pb-2 pr-3 font-medium">Guest</th>
                  <th className="pb-2 pr-3 font-medium">Room</th>
                  <th className="pb-2 pr-3 font-medium">Dates</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.reservations.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-medium text-fg">{r.reservationNumber}</td>
                    <td className="py-2 pr-3 text-fg-soft">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "—"}</td>
                    <td className="py-2 pr-3 text-fg-soft">{r.roomType?.name ?? "—"}{r.room ? ` · ${r.room.roomNumber}` : ""}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-fg-soft">
                      {new Date(r.checkInDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} → {new Date(r.checkOutDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="py-2 pr-3"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Badge></td>
                    <td className="py-2 text-right tabular-nums text-fg">{formatNaira(n(r.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {g.notes && <p className="text-xs text-fg-muted">Note: {g.notes}</p>}

          {canCancel && cancellable && (
            <div className="flex justify-end border-t border-line pt-3">
              {confirmCancel ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-fg-soft">Cancel all cancellable rooms? Fees may apply per your policy.</span>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmCancel(false)}>No</Button>
                  <Button size="sm" variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                    {cancel.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Cancel group
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}><Trash2 size={13} /> Cancel group</Button>
              )}
            </div>
          )}
          {g.summary.statuses.CHECKED_IN || g.summary.statuses.CHECKED_OUT ? (
            <p className="flex items-start gap-1.5 text-xs text-fg-muted">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Rooms already checked in or out won&apos;t be cancelled — process those at reception.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="rounded-md border border-line bg-brand-surface-2 p-3">
      <span className="flex items-center gap-1.5 text-xs text-fg-muted"><Icon size={12} /> {label}</span>
      <span className="mt-1 block font-semibold tabular-nums text-fg">{value}</span>
    </div>
  );
}
