"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, Loader2, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Modal } from "@/components/internal/modal";
import { DatePicker } from "@/components/internal/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { type Reservation, type ReservationStatus } from "@/lib/mock";
import { listReservations, createReservation, createCorporateBooking, duplicateInfo, type DuplicateInfo } from "@/lib/data/reservations";
import { listCompanies } from "@/lib/data/companies";
import { getAvailabilityByType } from "@/lib/data/availability";
import { useRoomTypes } from "@/lib/data/room-types";

const RES_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "CORPORATE", label: "Corporate" },
  { value: "CONFERENCE", label: "Conference / Event" },
] as const;

const FILTERS: { label: string; value: ReservationStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Checked in", value: "CHECKED_IN" },
  { label: "Checked out", value: "CHECKED_OUT" },
  { label: "Cancelled", value: "CANCELLED" },
];

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

/**
 * Payment state derived from the reservation's lifecycle — not just `depositPaid`.
 * The table used to show "Unpaid" purely on depositPaid, so a guest who had
 * checked out and settled their bill still read "Unpaid", contradicting their
 * bill. This states where the money actually stands at each stage.
 */
function paymentLabel(r: Reservation): { label: string; tone: BadgeTone } {
  switch (r.status) {
    case "CHECKED_OUT":
      // Settled at checkout — corporate stays are billed to the company (invoiced).
      return r.type === "CORPORATE"
        ? { label: "Invoiced", tone: "info" }
        : { label: "Settled", tone: "success" };
    case "CHECKED_IN":
      return { label: "Open bill", tone: "info" }; // charges accruing, settled at checkout
    case "CONFIRMED":
    case "PENDING":
      return r.depositPaid ? { label: "Deposit paid", tone: "info" } : { label: "Awaiting payment", tone: "warning" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral" };
    case "NO_SHOW":
      return { label: "No-show", tone: "danger" };
    default:
      return { label: "—", tone: "neutral" };
  }
}

export default function ReservationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const { getRoomType } = useRoomTypes();
  const { data: list = [] } = useQuery({
    queryKey: ["reservations"],
    queryFn: listReservations,
  });
  const [filter, setFilter] = useState<ReservationStatus | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [corpOpen, setCorpOpen] = useState(false);

  const filtered = useMemo(
    () => (filter === "ALL" ? list : list.filter((r) => r.status === filter)),
    [list, filter],
  );

  const columns: Column<Reservation>[] = [
    {
      key: "reservationNumber", header: "Reservation", sortValue: (r) => r.reservationNumber,
      render: (r) => (
        <div>
          <p className="font-medium text-fg">{r.reservationNumber}</p>
          <p className="text-xs text-fg-muted">{r.source.replace(/_/g, " ").toLowerCase()}</p>
        </div>
      ),
    },
    {
      key: "guestName", header: "Guest", sortValue: (r) => r.guestName,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          {r.guestName}
          {r.isVip && <span className="text-brand-primary-dark" title="VIP">★</span>}
        </span>
      ),
    },
    { key: "roomType", header: "Room type", render: (r) => getRoomType(r.roomTypeSlug)?.name ?? "—" },
    {
      // Room location — the physical room once assigned. Blank until check-in /
      // room assignment, so staff can see at a glance who's actually roomed.
      key: "room", header: "Room", align: "center",
      render: (r) => r.roomNumber
        ? <span className="font-medium tabular-nums text-fg">{r.roomNumber}</span>
        : <span className="text-fg-muted">—</span>,
    },
    {
      key: "dates", header: "Dates", sortValue: (r) => r.checkInDate,
      render: (r) => <span className="whitespace-nowrap text-fg-soft">{r.checkInDate} → {r.checkOutDate}</span>,
    },
    { key: "guests", header: "Guests", align: "center", render: (r) => r.adults + r.children },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "totalAmount", header: "Amount", align: "right", sortValue: (r) => r.totalAmount,
      render: (r) => {
        const pay = paymentLabel(r);
        return (
          <div className="text-right">
            <p className="font-medium text-fg">{formatNaira(r.totalAmount)}</p>
            <Badge tone={pay.tone} className="mt-0.5">{pay.label}</Badge>
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      title="Reservations"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reservations" }]}
      actions={
        hasPermission("reservations", "CREATE") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCorpOpen(true)}><Building2 size={16} /> Corporate Booking</Button>
            <Button onClick={() => setOpen(true)}><Plus size={16} /> New Reservation</Button>
          </div>
        )
      }
    >
      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {FILTERS.map((f) => {
          const n = f.value === "ALL" ? list.length : list.filter((r) => r.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
                filter === f.value ? "border-brand-primary font-medium text-fg" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {f.label} <span className="text-fg-muted">({n})</span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/manage/reservations/${r.id}`)}
        emptyState={<EmptyState icon={Calendar} title="No reservations found" description="Try a different filter or create a new reservation." />}
      />

      <NewReservationModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
          setOpen(false);
        }}
        nextNumber={`RES-2026-${String(54 + list.length).padStart(5, "0")}`}
      />

      {corpOpen && <CorporateBookingModal onClose={() => setCorpOpen(false)} onDone={() => { queryClient.invalidateQueries({ queryKey: ["reservations"] }); setCorpOpen(false); }} />}
    </PageShell>
  );
}

function CorporateBookingModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const { roomTypes } = useRoomTypes();
  const defaultSlug = roomTypes[0]?.slug ?? "";
  const [companyId, setCompanyId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [rows, setRows] = useState([{ firstName: "", lastName: "", phone: "", roomTypeSlug: "" }]);
  const [error, setError] = useState<string | null>(null);

  // Default each unset row to the first active room type once the catalogue loads.
  useEffect(() => {
    if (defaultSlug) setRows((rs) => rs.map((r) => (r.roomTypeSlug ? r : { ...r, roomTypeSlug: defaultSlug })));
  }, [defaultSlug]);

  const setRow = (i: number, k: string, v: string) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((rs) => [...rs, { firstName: "", lastName: "", phone: "", roomTypeSlug: defaultSlug }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = useMutation({
    mutationFn: () => createCorporateBooking({
      companyId, checkInDate, checkOutDate,
      guests: rows.map((r) => ({ firstName: r.firstName.trim(), lastName: r.lastName.trim(), phone: r.phone.trim(), roomTypeSlug: r.roomTypeSlug })),
    }),
    onSuccess: (r) => { toast.success(`${r.count} corporate reservation(s) created.`); onDone(); },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return setError("Select a company.");
    if (!checkInDate || !checkOutDate || new Date(checkOutDate) <= new Date(checkInDate)) return setError("Check-out must be after check-in.");
    if (rows.some((r) => !r.firstName.trim() || !r.lastName.trim() || !r.phone.trim())) return setError("Complete every guest row.");
    setError(null);
    save.mutate();
  }

  const inputCls = "w-full rounded-md border border-line bg-brand-surface px-2.5 py-1.5 text-sm text-fg focus:border-brand-primary focus:outline-none";

  return (
    <Modal open onClose={onClose} title="Corporate Booking" description="Book several rooms under one company account. Charges bill to the company.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <span className="text-sm font-medium text-fg-soft">Company *</span>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select a corporate account" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.tier.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <span className="text-sm font-medium text-fg-soft">Check-in *</span>
            <div className="mt-1"><DatePicker value={checkInDate} onChange={setCheckInDate} placeholder="Select date" /></div>
          </div>
          <div>
            <span className="text-sm font-medium text-fg-soft">Check-out *</span>
            <div className="mt-1"><DatePicker value={checkOutDate} min={checkInDate} onChange={setCheckOutDate} placeholder="Select date" /></div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-fg-soft">Guests &amp; rooms ({rows.length})</span>
            <Button type="button" size="sm" variant="outline" onClick={addRow}><Plus size={14} /> Add room</Button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
                <input placeholder="First name" value={r.firstName} onChange={(e) => setRow(i, "firstName", e.target.value)} className={inputCls} />
                <input placeholder="Last name" value={r.lastName} onChange={(e) => setRow(i, "lastName", e.target.value)} className={inputCls} />
                <input placeholder="Phone" value={r.phone} onChange={(e) => setRow(i, "phone", e.target.value)} className={inputCls} />
                <Select value={r.roomTypeSlug} onValueChange={(v) => setRow(i, "roomTypeSlug", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{roomTypes.map((rt) => <SelectItem key={rt.slug} value={rt.slug}>{rt.name}</SelectItem>)}</SelectContent>
                </Select>
                <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} className="flex items-center justify-center px-2 text-fg-muted hover:text-danger disabled:opacity-30" aria-label="Remove row"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Create {rows.length} reservation{rows.length !== 1 ? "s" : ""}</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewReservationModal({
  open, onClose, onCreated, nextNumber,
}: {
  open: boolean; onClose: () => void; onCreated: (r: Reservation) => void; nextNumber: string;
}) {
  const [form, setForm] = useState({
    guestName: "", guestPhone: "", roomTypeSlug: "",
    checkInDate: "", checkOutDate: "", adults: 2, children: 0,
    type: "INDIVIDUAL" as "INDIVIDUAL" | "CORPORATE" | "CONFERENCE", companyId: "", deposit: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [dupPrompt, setDupPrompt] = useState<DuplicateInfo | null>(null);
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const { roomTypes, getRoomType } = useRoomTypes();
  useEffect(() => {
    if (!form.roomTypeSlug && roomTypes[0]) setForm((f) => ({ ...f, roomTypeSlug: roomTypes[0].slug }));
  }, [roomTypes, form.roomTypeSlug]);

  const validDates = !!form.checkInDate && !!form.checkOutDate && new Date(form.checkOutDate) > new Date(form.checkInDate);
  const { data: avail = [] } = useQuery({
    queryKey: ["availability", form.checkInDate, form.checkOutDate],
    queryFn: () => getAvailabilityByType(form.checkInDate, form.checkOutDate),
    enabled: open && validDates,
  });
  const availOf = (slug: string) => avail.find((a) => a.slug === slug);
  const selectedAvail = availOf(form.roomTypeSlug);
  const soldOut = !!selectedAvail && selectedAvail.available <= 0;

  const create = useMutation({
    mutationFn: async (confirmDuplicate: boolean): Promise<Reservation> => {
      const [firstName, ...rest] = form.guestName.trim().split(/\s+/);
      const lastName = rest.join(" ") || firstName;
      return createReservation({
        firstName, lastName, phone: form.guestPhone.trim(),
        roomTypeSlug: form.roomTypeSlug,
        checkInDate: form.checkInDate, checkOutDate: form.checkOutDate,
        adults: form.adults, children: form.children,
        type: form.type,
        companyId: form.type !== "INDIVIDUAL" && form.companyId ? form.companyId : undefined,
        depositAmount: form.deposit ? Number(form.deposit) : undefined,
        ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
      });
    },
    onSuccess: (r) => {
      toast.success(`Reservation ${r.reservationNumber} created.`);
      setForm({ guestName: "", guestPhone: "", roomTypeSlug: roomTypes[0]?.slug ?? "", checkInDate: "", checkOutDate: "", adults: 2, children: 0, type: "INDIVIDUAL", companyId: "", deposit: "" });
      setError(null);
      setDupPrompt(null);
      onCreated(r);
    },
    onError: (e: Error) => {
      // This guest already has an overlapping booking — surface it and let the
      // clerk confirm rather than silently creating a duplicate.
      const dup = duplicateInfo(e);
      if (dup) { setDupPrompt(dup); setError(null); return; }
      setError(e.message);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Domain rule: checkOut strictly after checkIn.
    if (!form.checkInDate || !form.checkOutDate || new Date(form.checkOutDate) <= new Date(form.checkInDate)) {
      setError("Check-out date must be after check-in date.");
      return;
    }
    setError(null);
    setDupPrompt(null);
    create.mutate(false);
  }

  const inputCls = "mt-1 w-full rounded-md border border-line bg-brand-surface px-3 py-2 text-sm text-fg focus:border-brand-primary focus:outline-none";

  return (
    <Modal open={open} onClose={onClose} title="New Reservation" description="Create a reservation on behalf of a guest.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="block sm:col-span-2">
            <span className="text-sm font-medium text-fg-soft">Reservation type</span>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type, companyId: v === "INDIVIDUAL" ? "" : form.companyId })}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{RES_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.type !== "INDIVIDUAL" && (
            <div className="block sm:col-span-2">
              <span className="text-sm font-medium text-fg-soft">Company {form.type === "CORPORATE" ? "*" : ""}</span>
              <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select a corporate account" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.tier.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 text-xs text-fg-muted">Charges on this stay are billed to the company.</p>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Guest name *</span>
            <input required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Phone *</span>
            <input required type="tel" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} className={inputCls} />
          </label>
          <div className="block sm:col-span-2">
            <span className="text-sm font-medium text-fg-soft">Room type</span>
            <Select value={form.roomTypeSlug} onValueChange={(v) => setForm({ ...form, roomTypeSlug: v })}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roomTypes.map((r) => {
                  const a = availOf(r.slug);
                  return (
                    <SelectItem key={r.slug} value={r.slug}>
                      {r.name} — {formatNaira(r.basePrice)}/night{a ? ` · ${a.available} free` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {validDates && selectedAvail && (
              <p className="mt-1.5 text-xs">
                {soldOut ? (
                  <span className="text-danger">Sold out for these dates — no {getRoomType(form.roomTypeSlug)?.name} available.</span>
                ) : (
                  <span className={cn(selectedAvail.available / selectedAvail.capacity <= 0.34 ? "text-warn" : "text-ok")}>
                    {selectedAvail.available} of {selectedAvail.capacity} {getRoomType(form.roomTypeSlug)?.name} free for these dates.
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="block">
            <span className="text-sm font-medium text-fg-soft">Check-in *</span>
            <div className="mt-1"><DatePicker value={form.checkInDate} onChange={(v) => setForm({ ...form, checkInDate: v })} placeholder="Select date" /></div>
          </div>
          <div className="block">
            <span className="text-sm font-medium text-fg-soft">Check-out *</span>
            <div className="mt-1"><DatePicker value={form.checkOutDate} min={form.checkInDate} onChange={(v) => setForm({ ...form, checkOutDate: v })} placeholder="Select date" /></div>
          </div>
          <div className="block">
            <span className="text-sm font-medium text-fg-soft">Adults</span>
            <Select value={String(form.adults)} onValueChange={(v) => setForm({ ...form, adults: Number(v) })}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="block">
            <span className="text-sm font-medium text-fg-soft">Children</span>
            <Select value={String(form.children)} onValueChange={(v) => setForm({ ...form, children: Number(v) })}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{[0, 1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="block sm:col-span-2">
            <span className="text-sm font-medium text-fg-soft">Deposit taken (₦)</span>
            <input type="number" min={0} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} className={inputCls} placeholder="0 — optional prepayment credited to the bill at check-in" />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {dupPrompt ? (
          <div className="rounded-md border border-warn/40 bg-warn/10 p-4">
            <p className="text-sm font-medium text-fg">This guest already has a reservation</p>
            <p className="mt-1 text-sm text-fg-soft">
              {dupPrompt.reservationNumber} covers overlapping dates
              {" "}({fmtDayMon(dupPrompt.checkInDate)} → {fmtDayMon(dupPrompt.checkOutDate)}).
              Create another one anyway?
            </p>
            <div className="mt-3 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDupPrompt(null)}>Go back</Button>
              <Button type="button" onClick={() => create.mutate(true)} disabled={create.isPending}>
                {create.isPending && <Loader2 size={14} className="animate-spin" />} Create anyway
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || soldOut}>
              {create.isPending && <Loader2 size={14} className="animate-spin" />} Create Reservation
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}

/** "18 Jul" — compact date for the duplicate-reservation prompt. */
function fmtDayMon(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
