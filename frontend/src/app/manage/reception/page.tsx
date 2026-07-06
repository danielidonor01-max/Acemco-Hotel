"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, CheckCircle, ConciergeBell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, EmptyState } from "@/components/internal/ui";
import { listReservations, checkInReservation, checkOutReservation } from "@/lib/data/reservations";
import { type Reservation } from "@/lib/mock";
import { getRoomType } from "@/lib/cms";

export default function ReceptionPage() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({ queryKey: ["reservations"], queryFn: listReservations });

  const arrivals = useMemo(() => list.filter((r) => r.status === "CONFIRMED"), [list]);
  const inHouse = useMemo(() => list.filter((r) => r.status === "CHECKED_IN"), [list]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reservations"] });
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const checkIn = useMutation({
    mutationFn: (r: Reservation) => checkInReservation(r.id),
    onSuccess: (r) => { toast.success(`Checked in${r.roomNumber ? ` · Room ${r.roomNumber}` : ""}.`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const checkOut = useMutation({
    mutationFn: (r: Reservation) => checkOutReservation(r.id),
    onSuccess: () => { toast.success("Checked out · room now cleaning."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Reception"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reception" }]}
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
                      <Button size="sm" disabled={checkIn.isPending && checkIn.variables?.id === r.id} onClick={() => checkIn.mutate(r)}>
                        {checkIn.isPending && checkIn.variables?.id === r.id ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} Check in
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
                    action={
                      <Button size="sm" variant="outline" disabled={checkOut.isPending && checkOut.variables?.id === r.id} onClick={() => checkOut.mutate(r)}>
                        {checkOut.isPending && checkOut.variables?.id === r.id ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Check out
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
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
