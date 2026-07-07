"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, CheckCircle, ConciergeBell, Loader2, UserPlus, Award, Star, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge, EmptyState } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/internal/date-picker";
import { listReservations, checkInReservation, checkOutReservation, walkInReservation } from "@/lib/data/reservations";
import { getGuestProfile } from "@/lib/data/guests";
import { getAvailableRooms } from "@/lib/data/availability";
import { type Reservation } from "@/lib/mock";
import { getRoomType, roomTypes } from "@/lib/cms";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "CREDIT"];

export default function ReceptionPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({ queryKey: ["reservations"], queryFn: listReservations });
  const [walkIn, setWalkIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState<Reservation | null>(null);
  const [checkingIn, setCheckingIn] = useState<Reservation | null>(null);

  const arrivals = useMemo(() => list.filter((r) => r.status === "CONFIRMED"), [list]);
  const inHouse = useMemo(() => list.filter((r) => r.status === "CHECKED_IN"), [list]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reservations"] });
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["housekeeping"] });
  };

  return (
    <PageShell
      title="Reception"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reception" }]}
      actions={hasPermission("reservations", "CREATE") && <Button variant="outline" onClick={() => setWalkIn(true)}><UserPlus size={16} /> Walk-in</Button>}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Arrivals */}
        <Card>
          <CardHeader><CardTitle>Expected Arrivals</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-fg-soft">Loading…</p>
            ) : arrivals.length === 0 ? (
              <div className="p-6"><EmptyState icon={ConciergeBell} title="No arrivals expected" /></div>
            ) : (
              <ul className="divide-y divide-line">
                {arrivals.map((r) => (
                  <GuestRow
                    key={r.id}
                    r={r}
                    action={
                      <Button size="sm" onClick={() => setCheckingIn(r)}>
                        <LogIn size={15} /> Check in
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* In-house / departures */}
        <Card>
          <CardHeader><CardTitle>In-House (Departures)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-fg-soft">Loading…</p>
            ) : inHouse.length === 0 ? (
              <div className="p-6"><EmptyState icon={ConciergeBell} title="No guests in-house" /></div>
            ) : (
              <ul className="divide-y divide-line">
                {inHouse.map((r) => (
                  <GuestRow
                    key={r.id}
                    r={r}
                    action={<Button size="sm" variant="outline" onClick={() => setCheckingOut(r)}><LogOut size={15} /> Check out</Button>}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {walkIn && <WalkInDialog onClose={() => setWalkIn(false)} onDone={invalidate} />}
      {checkingOut && <CheckoutDialog reservation={checkingOut} onClose={() => setCheckingOut(null)} onDone={invalidate} />}
      {checkingIn && <CheckInDialog reservation={checkingIn} onClose={() => setCheckingIn(null)} onDone={invalidate} />}
    </PageShell>
  );
}

function CheckInDialog({ reservation, onClose, onDone }: { reservation: Reservation; onClose: () => void; onDone: () => void }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["guest-profile", reservation.guestId],
    queryFn: () => getGuestProfile(reservation.guestId!),
    enabled: !!reservation.guestId,
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ["available-rooms", reservation.id],
    queryFn: () => getAvailableRooms(reservation.id),
  });

  // "" = auto-assign the next free room. Preselect any room already held for this stay.
  const [roomId, setRoomId] = useState("");
  useEffect(() => {
    if (reservation.roomNumber) {
      const held = rooms.find((r) => r.roomNumber === reservation.roomNumber);
      if (held) setRoomId(held.id);
    }
  }, [rooms, reservation.roomNumber]);

  const checkIn = useMutation({
    mutationFn: () => checkInReservation(reservation.id, roomId || undefined),
    onSuccess: (r) => { toast.success(`Checked in${r.roomNumber ? ` · Room ${r.roomNumber}` : ""}.`); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tier = profile?.guest.tier ?? reservation.tier;
  const isVip = tier === "VIP" || reservation.isVip;
  const blacklisted = profile?.guest.isBlacklisted ?? reservation.isBlacklisted;
  const vipRecommended = profile?.vipRecommended ?? false;
  const stats = profile?.stats;
  const returning = (stats?.totalStays ?? 0) > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {returning ? "Welcome back" : "Check in"} — {reservation.guestName}
            {isVip && <Badge tone="brand"><Star size={12} /> VIP</Badge>}
          </DialogTitle>
          <DialogDescription>
            {reservation.reservationNumber} · {getRoomType(reservation.roomTypeSlug)?.name}
            {reservation.roomNumber ? ` · Room ${reservation.roomNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* Alerts */}
          {blacklisted && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              <Ban size={16} className="mt-0.5 shrink-0" />
              <div><p className="font-semibold">Blacklisted guest</p><p className="text-xs opacity-90">Escalate to a duty manager before proceeding.</p></div>
            </div>
          )}
          {vipRecommended && !isVip && (
            <div className="flex items-start gap-2 rounded-lg border border-brand-primary/40 bg-brand-primary/10 p-3 text-sm text-brand-primary-dark">
              <Award size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Qualifies for VIP consideration</p>
                <p className="text-xs opacity-90">Loyalty score {profile?.loyaltyScore}/100. Consider extending VIP courtesies.</p>
              </div>
            </div>
          )}

          {/* Relationship intelligence */}
          {isLoading ? (
            <p className="text-sm text-fg-soft">Loading guest history…</p>
          ) : !reservation.guestId ? (
            <p className="text-sm text-fg-soft">No linked guest profile.</p>
          ) : profile ? (
            <div className="rounded-lg border border-line p-3 text-sm">
              {returning ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <Stat label="Previous stays" value={String(stats!.totalStays)} />
                  <Stat label="Nights" value={String(stats!.totalNights)} />
                  <Stat label="Lifetime spend" value={formatNaira(stats!.lifetimeSpend)} />
                  <Stat label="Last visit" value={stats!.lastVisit ? stats!.lastVisit.slice(0, 10) : "—"} />
                  {stats!.favouriteRoomType && <Stat label="Prefers" value={stats!.favouriteRoomType} />}
                  {profile.companies.length > 0 && <Stat label="Company" value={profile.companies[0]} />}
                </div>
              ) : (
                <p className="text-fg-soft">First stay with Acemco — a chance to make a strong first impression.</p>
              )}
              {profile.favouriteItems.length > 0 && (
                <div className="mt-3 border-t border-line pt-2">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">Usually orders</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.favouriteItems.slice(0, 4).map((it) => (
                      <span key={it.name} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-soft">{it.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Room assignment */}
          <div className="grid gap-1.5">
            <Label>Assign room</Label>
            <Select value={roomId || "auto"} onValueChange={(v) => setRoomId(v === "auto" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-assign · next free {getRoomType(reservation.roomTypeSlug)?.name}</SelectItem>
                {rooms.map((rm) => (
                  <SelectItem key={rm.id} value={rm.id} disabled={!rm.assignable}>
                    Room {rm.roomNumber} · Floor {rm.floor}
                    {rm.assignable ? (rm.status !== "AVAILABLE" ? ` · ${rm.status.toLowerCase()}` : "") : ` · ${(rm.reason ?? "unavailable").toLowerCase()}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
            {checkIn.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Confirm check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="font-medium text-fg">{value}</p>
    </div>
  );
}

function GuestRow({ r, action }: { r: Reservation; action: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
          {r.guestName}
          {r.isVip && <span className="text-brand-primary-dark" title="VIP guest — alert at check-in">★</span>}
        </p>
        <p className="text-xs text-fg-muted">
          {r.reservationNumber} · {getRoomType(r.roomTypeSlug)?.name}
          {r.roomNumber ? ` · Room ${r.roomNumber}` : ""}
        </p>
      </div>
      {action}
    </li>
  );
}

function CheckoutDialog({ reservation, onClose, onDone }: { reservation: Reservation; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState("CASH");
  const checkOut = useMutation({
    mutationFn: () => checkOutReservation(reservation.id, method),
    onSuccess: () => { toast.success("Checked out · folio settled · room now cleaning."); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Check out — {reservation.guestName}</DialogTitle>
          <DialogDescription>Settle the folio and release the room. Choose how the balance was paid.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Payment method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.toLowerCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={checkOut.isPending} onClick={() => checkOut.mutate()}>
            {checkOut.isPending && <Loader2 size={14} className="animate-spin" />} Settle & check out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalkInDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    guestName: "", phone: "", roomTypeSlug: roomTypes[0].slug, checkInDate: "", checkOutDate: "", adults: 1, children: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const [firstName, ...rest] = form.guestName.trim().split(/\s+/);
      return walkInReservation({
        firstName, lastName: rest.join(" ") || firstName, phone: form.phone.trim(),
        roomTypeSlug: form.roomTypeSlug, checkInDate: form.checkInDate, checkOutDate: form.checkOutDate,
        adults: form.adults, children: form.children,
      });
    },
    onSuccess: (r) => { toast.success(`${r.guestName} checked in${r.roomNumber ? ` · Room ${r.roomNumber}` : ""}.`); onDone(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim() || !form.phone.trim() || !form.checkInDate || !form.checkOutDate) { setError("Fill in name, phone and dates."); return; }
    if (new Date(form.checkOutDate) <= new Date(form.checkInDate)) { setError("Check-out must be after check-in."); return; }
    setError(null); save.mutate();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Walk-in Check-in</DialogTitle>
          <DialogDescription>Create the booking and check the guest in immediately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="w-name">Guest name</Label><Input id="w-name" value={form.guestName} onChange={(e) => set("guestName", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="w-phone">Phone</Label><Input id="w-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5">
            <Label>Room type</Label>
            <Select value={form.roomTypeSlug} onValueChange={(v) => set("roomTypeSlug", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roomTypes.map((rt) => <SelectItem key={rt.slug} value={rt.slug}>{rt.name} — {formatNaira(rt.basePrice)}/night</SelectItem>)}</SelectContent>
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Check in guest</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
