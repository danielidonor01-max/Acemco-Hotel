"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Users, CalendarDays, Home, Plus, Loader2, Printer, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, StatusBadge, Badge, Button } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/internal/date-picker";
import { ReservationActions } from "@/components/internal/reservation-actions";
import { getReservationById, editReservation } from "@/lib/data/reservations";
import { getFolio, addFolioLine } from "@/lib/data/operations";
import { printGuestFolio, type FolioHeader } from "@/lib/print-folio";
import { useAuth } from "@/providers/auth-provider";
import { getRoomType, roomTypes } from "@/lib/cms";
import { type Reservation } from "@/lib/mock";
import { formatNaira } from "@/lib/utils";

const FOLIO_LINE_TYPES = ["SERVICE", "LAUNDRY", "RESTAURANT", "LOUNGE", "BOUTIQUE", "DAMAGE", "DISCOUNT", "TAX"];
const QUICK_CHARGES: { label: string; type: string; description: string }[] = [
  { label: "Laundry", type: "LAUNDRY", description: "Laundry service" },
  { label: "Minibar", type: "SERVICE", description: "Minibar" },
  { label: "Spa", type: "SERVICE", description: "Spa & wellness" },
  { label: "Damage", type: "DAMAGE", description: "Damage charge" },
];

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data: r, isLoading } = useQuery({ queryKey: ["reservation", id], queryFn: () => getReservationById(id) });

  if (isLoading) {
    return (
      <PageShell title="Reservation" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reservations", href: "/manage/reservations" }, { label: "…" }]}>
        <p className="text-sm text-fg-soft">Loading reservation…</p>
      </PageShell>
    );
  }
  if (!r) return notFound();

  const room = getRoomType(r.roomTypeSlug);
  const nights = Math.round((+new Date(r.checkOutDate) - +new Date(r.checkInDate)) / 86_400_000);

  return (
    <PageShell
      title={r.reservationNumber}
      breadcrumb={[
        { label: "Dashboard", href: "/manage/dashboard" },
        { label: "Reservations", href: "/manage/reservations" },
        { label: r.reservationNumber },
      ]}
      actions={<StatusBadge status={r.status} />}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Reservation Details</CardTitle>
              {(r.status === "PENDING" || r.status === "CONFIRMED") && hasPermission("reservations", "UPDATE") && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</Button>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Detail icon={Users} label="Guest">
                {r.guestName} {r.isVip && <span className="text-brand-primary-dark" title="VIP">★</span>}
              </Detail>
              <Detail icon={Phone} label="Phone">{r.guestPhone || "—"}</Detail>
              <Detail icon={Home} label="Room type">{room?.name}{r.roomNumber ? ` · Room ${r.roomNumber}` : ""}</Detail>
              <Detail icon={Users} label="Occupancy">{r.adults} adult(s), {r.children} child(ren)</Detail>
              <Detail icon={CalendarDays} label="Check-in">{r.checkInDate}</Detail>
              <Detail icon={CalendarDays} label="Check-out">{r.checkOutDate} ({nights} night{nights !== 1 ? "s" : ""})</Detail>
              <Detail icon={Home} label="Source">{r.source.replace(/_/g, " ").toLowerCase()}</Detail>
              <Detail icon={Home} label="Type">
                <span className="capitalize">{(r.type ?? "INDIVIDUAL").toLowerCase()}</span>
                {r.company && <span className="text-fg-muted"> · {r.company}</span>}
              </Detail>
              <Detail icon={Users} label="Deposit">
                <Badge tone={r.depositPaid ? "success" : "warning"}>{r.depositPaid ? "Paid" : "Unpaid"}</Badge>
              </Detail>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent><ReservationActions reservation={r} /></CardContent>
          </Card>
        </div>

        {/* Folio */}
        <div className="space-y-6">
          <FolioPanel
            reservationId={r.id}
            nights={nights}
            baseTotal={r.totalAmount}
            header={{ guestName: r.guestName, reservationNumber: r.reservationNumber, roomType: room?.name, room: r.roomNumber, checkIn: r.checkInDate, checkOut: r.checkOutDate, company: r.company }}
          />
        </div>
      </div>
      {editing && <EditReservationDialog reservation={r} onClose={() => setEditing(false)} />}
    </PageShell>
  );
}

function EditReservationDialog({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    roomTypeSlug: reservation.roomTypeSlug,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    adults: reservation.adults,
    children: reservation.children,
  });
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => editReservation(reservation.id, {
      roomTypeSlug: form.roomTypeSlug,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: form.adults,
      children: form.children,
    }),
    onSuccess: () => {
      toast.success("Reservation updated.");
      qc.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["folio", reservation.id] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = !form.checkInDate || !form.checkOutDate || new Date(form.checkOutDate) <= new Date(form.checkInDate);
  const rt = getRoomType(form.roomTypeSlug);
  const nights = invalid ? 0 : Math.round((+new Date(form.checkOutDate) - +new Date(form.checkInDate)) / 86_400_000);
  const estimate = rt ? rt.basePrice * nights : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit reservation</DialogTitle>
          <DialogDescription>Change dates, room type or occupancy. Availability is re-checked and the total recalculated. If the room no longer fits, its assignment is cleared.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Room type</Label>
            <Select value={form.roomTypeSlug} onValueChange={(v) => set("roomTypeSlug", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roomTypes.map((t) => <SelectItem key={t.slug} value={t.slug}>{t.name} — {formatNaira(t.basePrice)}/night</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Check-in</Label><DatePicker value={form.checkInDate} onChange={(v) => set("checkInDate", v)} placeholder="Select date" /></div>
            <div className="grid gap-1.5"><Label>Check-out</Label><DatePicker value={form.checkOutDate} min={form.checkInDate} onChange={(v) => set("checkOutDate", v)} placeholder="Select date" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Adults</Label>
              <Select value={String(form.adults)} onValueChange={(v) => set("adults", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Children</Label>
              <Select value={String(form.children)} onValueChange={(v) => set("children", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[0, 1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {invalid ? (
            <p className="text-sm text-danger">Check-out must be after check-in.</p>
          ) : (
            <p className="text-sm text-fg-soft">New total · {nights} night{nights !== 1 ? "s" : ""} — <span className="font-medium text-fg">{formatNaira(estimate)}</span></p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={invalid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-fg-muted">
        <Icon size={13} /> {label}
      </p>
      <p className="mt-1 text-fg">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-fg-soft">
      <span>{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}

function FolioPanel({ reservationId, nights, baseTotal, header }: { reservationId: string; nights: number; baseTotal: number; header: FolioHeader }) {
  const { hasPermission } = useAuth();
  const [adding, setAdding] = useState<{ description: string; type: string } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["folio", reservationId], queryFn: () => getFolio(reservationId) });
  const canEdit = hasPermission("reservations", "UPDATE");

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Folio</CardTitle>
        <div className="flex items-center gap-2">
          {data?.folio && <Badge tone={data.folio.status === "SETTLED" ? "success" : "info"}>{data.folio.status.toLowerCase()}</Badge>}
          {data?.folio && (
            <button type="button" onClick={() => printGuestFolio({ ...header, status: data.folio!.status }, data.lines, data.balance)} className="rounded p-1 text-fg-muted hover:text-fg" title="Print / PDF">
              <Printer size={15} />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <p className="text-fg-soft">Loading folio…</p>
        ) : data?.folio ? (
          <>
            {data.lines.map((l) => (
              <Row key={l.id} label={l.description} value={formatNaira(l.amount)} />
            ))}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-fg">
              <span>Balance</span>
              <span>{formatNaira(data.balance)}</span>
            </div>
            {canEdit && data.folio.status === "OPEN" && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHARGES.map((q) => (
                    <Button key={q.label} size="sm" variant="ghost" className="border border-line" onClick={() => setAdding({ description: q.description, type: q.type })}>
                      + {q.label}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setAdding({ description: "", type: "SERVICE" })}>
                  <Plus size={14} /> Add charge
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* No folio yet (guest not checked in) — show the reservation estimate. */}
            <Row label={`Room · ${nights} night(s)`} value={formatNaira(baseTotal)} />
            <Row label="Taxes & service" value={formatNaira(Math.round(baseTotal * 0.075))} />
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-fg">
              <span>Estimated total</span>
              <span>{formatNaira(baseTotal)}</span>
            </div>
            <p className="text-xs text-fg-muted">A folio opens automatically at check-in.</p>
          </>
        )}
      </CardContent>
      {adding && data?.folio && <AddChargeDialog folioId={data.folio.id} reservationId={reservationId} preset={adding} onClose={() => setAdding(null)} />}
    </Card>
  );
}

function AddChargeDialog({ folioId, reservationId, preset, onClose }: { folioId: string; reservationId: string; preset: { description: string; type: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ description: preset.description, amount: "", type: preset.type });
  const save = useMutation({
    mutationFn: () => addFolioLine(folioId, { description: form.description.trim(), amount: Number(form.amount) || 0, type: form.type }),
    onSuccess: () => { toast.success("Charge posted."); qc.invalidateQueries({ queryKey: ["folio", reservationId] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.description.trim() && Number(form.amount) !== 0 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add charge</DialogTitle>
          <DialogDescription>Post a line to the guest folio. Use a negative amount for a discount.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="fl-desc">Description</Label><Input id="fl-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="fl-amt">Amount (₦)</Label><Input id="fl-amt" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FOLIO_LINE_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Post charge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
