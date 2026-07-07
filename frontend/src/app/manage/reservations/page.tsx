"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Modal } from "@/components/internal/modal";
import { DatePicker } from "@/components/internal/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { reservations as seed, type Reservation, type ReservationStatus } from "@/lib/mock";
import { listReservations, createReservation, isApiEnabled } from "@/lib/data/reservations";
import { listCompanies } from "@/lib/data/companies";
import { roomTypes, getRoomType } from "@/lib/cms";

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

export default function ReservationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  // Reads live from the API when configured, else the seed (offline demo).
  const { data: list = seed } = useQuery({
    queryKey: ["reservations"],
    queryFn: listReservations,
    initialData: seed,
  });
  const [filter, setFilter] = useState<ReservationStatus | "ALL">("ALL");
  const [open, setOpen] = useState(false);

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
      key: "dates", header: "Dates", sortValue: (r) => r.checkInDate,
      render: (r) => <span className="whitespace-nowrap text-fg-soft">{r.checkInDate} → {r.checkOutDate}</span>,
    },
    { key: "guests", header: "Guests", align: "center", render: (r) => r.adults + r.children },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "totalAmount", header: "Amount", align: "right", sortValue: (r) => r.totalAmount,
      render: (r) => (
        <div className="text-right">
          <p className="font-medium text-fg">{formatNaira(r.totalAmount)}</p>
          <Badge tone={r.depositPaid ? "success" : "warning"} className="mt-0.5">
            {r.depositPaid ? "Deposit paid" : "Unpaid"}
          </Badge>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Reservations"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reservations" }]}
      actions={
        hasPermission("reservations", "CREATE") && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> New Reservation
          </Button>
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
        onCreated={(r) => {
          if (isApiEnabled()) queryClient.invalidateQueries({ queryKey: ["reservations"] });
          else queryClient.setQueryData<Reservation[]>(["reservations"], (prev = []) => [r, ...prev]);
          setOpen(false);
        }}
        nextNumber={`RES-2026-${String(54 + list.length).padStart(5, "0")}`}
      />
    </PageShell>
  );
}

function NewReservationModal({
  open, onClose, onCreated, nextNumber,
}: {
  open: boolean; onClose: () => void; onCreated: (r: Reservation) => void; nextNumber: string;
}) {
  const [form, setForm] = useState({
    guestName: "", guestPhone: "", roomTypeSlug: roomTypes[0].slug,
    checkInDate: "", checkOutDate: "", adults: 2, children: 0,
    type: "INDIVIDUAL" as "INDIVIDUAL" | "CORPORATE" | "CONFERENCE", companyId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: listCompanies });

  const create = useMutation({
    mutationFn: async (): Promise<Reservation> => {
      const [firstName, ...rest] = form.guestName.trim().split(/\s+/);
      const lastName = rest.join(" ") || firstName;
      if (isApiEnabled()) {
        return createReservation({
          firstName, lastName, phone: form.guestPhone.trim(),
          roomTypeSlug: form.roomTypeSlug,
          checkInDate: form.checkInDate, checkOutDate: form.checkOutDate,
          adults: form.adults, children: form.children,
          type: form.type,
          companyId: form.type !== "INDIVIDUAL" && form.companyId ? form.companyId : undefined,
        });
      }
      const rt = getRoomType(form.roomTypeSlug)!;
      const nights = Math.round((+new Date(form.checkOutDate) - +new Date(form.checkInDate)) / 86_400_000);
      return {
        id: `res-${Date.now()}`,
        reservationNumber: nextNumber,
        guestName: form.guestName, guestPhone: form.guestPhone,
        roomTypeSlug: form.roomTypeSlug,
        checkInDate: form.checkInDate, checkOutDate: form.checkOutDate,
        adults: form.adults, children: form.children,
        status: "PENDING", source: "INTERNAL",
        totalAmount: rt.basePrice * nights, depositPaid: false,
      };
    },
    onSuccess: (r) => {
      toast.success(`Reservation ${r.reservationNumber} created.`);
      setForm({ guestName: "", guestPhone: "", roomTypeSlug: roomTypes[0].slug, checkInDate: "", checkOutDate: "", adults: 2, children: 0, type: "INDIVIDUAL", companyId: "" });
      setError(null);
      onCreated(r);
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Domain rule: checkOut strictly after checkIn.
    if (!form.checkInDate || !form.checkOutDate || new Date(form.checkOutDate) <= new Date(form.checkInDate)) {
      setError("Check-out date must be after check-in date.");
      return;
    }
    setError(null);
    create.mutate();
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
                {roomTypes.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>{r.name} — {formatNaira(r.basePrice)}/night</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 size={14} className="animate-spin" />} Create Reservation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
