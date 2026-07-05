"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar } from "lucide-react";
import { PageShell, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Modal } from "@/components/internal/modal";
import { hasPermission } from "@/lib/permissions";
import { formatNaira, cn } from "@/lib/utils";
import { reservations as seed, type Reservation, type ReservationStatus } from "@/lib/mock";
import { listReservations } from "@/lib/data/reservations";
import { roomTypes, getRoomType } from "@/lib/cms";

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
          {r.isVip && <span className="text-brand-primary" title="VIP">★</span>}
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
        onCreate={(r) => {
          queryClient.setQueryData<Reservation[]>(["reservations"], (prev = []) => [r, ...prev]);
          setOpen(false);
        }}
        nextNumber={`RES-2026-${String(54 + list.length).padStart(5, "0")}`}
      />
    </PageShell>
  );
}

function NewReservationModal({
  open, onClose, onCreate, nextNumber,
}: {
  open: boolean; onClose: () => void; onCreate: (r: Reservation) => void; nextNumber: string;
}) {
  const [form, setForm] = useState({
    guestName: "", guestPhone: "", roomTypeSlug: roomTypes[0].slug,
    checkInDate: "", checkOutDate: "", adults: 2, children: 0,
  });
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Domain rule: checkOut strictly after checkIn.
    if (!form.checkInDate || !form.checkOutDate || new Date(form.checkOutDate) <= new Date(form.checkInDate)) {
      setError("Check-out date must be after check-in date.");
      return;
    }
    const rt = getRoomType(form.roomTypeSlug)!;
    const nights = Math.round((+new Date(form.checkOutDate) - +new Date(form.checkInDate)) / 86_400_000);
    onCreate({
      id: `res-${Date.now()}`,
      reservationNumber: nextNumber,
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      roomTypeSlug: form.roomTypeSlug,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: form.adults,
      children: form.children,
      status: "PENDING",
      source: "INTERNAL",
      totalAmount: rt.basePrice * nights,
      depositPaid: false,
    });
    setForm({ guestName: "", guestPhone: "", roomTypeSlug: roomTypes[0].slug, checkInDate: "", checkOutDate: "", adults: 2, children: 0 });
    setError(null);
  }

  const inputCls = "mt-1 w-full rounded-md border border-line bg-brand-surface px-3 py-2 text-sm text-fg focus:border-brand-primary focus:outline-none";

  return (
    <Modal open={open} onClose={onClose} title="New Reservation" description="Create a reservation on behalf of a guest.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Guest name *</span>
            <input required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Phone *</span>
            <input required type="tel" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-fg-soft">Room type</span>
            <select value={form.roomTypeSlug} onChange={(e) => setForm({ ...form, roomTypeSlug: e.target.value })} className={inputCls}>
              {roomTypes.map((r) => <option key={r.slug} value={r.slug}>{r.name} — {formatNaira(r.basePrice)}/night</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Check-in *</span>
            <input required type="date" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Check-out *</span>
            <input required type="date" min={form.checkInDate} value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Adults</span>
            <select value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} className={inputCls}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Children</span>
            <select value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} className={inputCls}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Reservation</Button>
        </div>
      </form>
    </Modal>
  );
}
