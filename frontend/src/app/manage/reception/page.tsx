"use client";

import { useState } from "react";
import { LogIn, LogOut, UserPlus, CheckCircle, ConciergeBell } from "lucide-react";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, EmptyState } from "@/components/internal/ui";
import { reservations, type Reservation } from "@/lib/mock";
import { getRoomType } from "@/lib/cms";
import { hasPermission } from "@/lib/permissions";
import { useRooms } from "@/stores/rooms.store";

export default function ReceptionPage() {
  const [done, setDone] = useState<Record<string, { kind: "in" | "out"; room?: string }>>({});
  const { rooms, setStatus } = useRooms();

  const arrivals = reservations.filter((r) => r.status === "CONFIRMED");
  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN");

  // Interlock (Domain §5 events): check-in → room OCCUPIED; check-out → room CLEANING.
  function checkIn(r: Reservation) {
    const room =
      rooms.find((rm) => rm.roomNumber === r.roomNumber) ??
      rooms.find((rm) => rm.roomTypeSlug === r.roomTypeSlug && rm.status === "AVAILABLE");
    if (room) setStatus(room.id, "OCCUPIED");
    setDone((d) => ({ ...d, [r.id]: { kind: "in", room: room?.roomNumber } }));
  }
  function checkOut(r: Reservation) {
    const room = rooms.find((rm) => rm.roomNumber === r.roomNumber);
    if (room) setStatus(room.id, "CLEANING");
    setDone((d) => ({ ...d, [r.id]: { kind: "out", room: room?.roomNumber } }));
  }

  return (
    <PageShell
      title="Reception"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reception" }]}
      actions={
        hasPermission("reception", "CREATE") && (
          <Button variant="outline"><UserPlus size={16} /> Walk-in</Button>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Arrivals */}
        <Card>
          <CardHeader><CardTitle>Expected Arrivals</CardTitle></CardHeader>
          <CardContent className="p-0">
            {arrivals.length === 0 ? (
              <div className="p-6"><EmptyState icon={ConciergeBell} title="No arrivals expected" /></div>
            ) : (
              <ul className="divide-y divide-line">
                {arrivals.map((r) => (
                  <GuestRow
                    key={r.id}
                    r={r}
                    done={done[r.id]?.kind === "in"}
                    action={
                      <Button size="sm" onClick={() => checkIn(r)}>
                        <LogIn size={15} /> Check in
                      </Button>
                    }
                    doneLabel={done[r.id]?.room ? `Checked in · Room ${done[r.id]!.room}` : "Checked in"}
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
            {inHouse.length === 0 ? (
              <div className="p-6"><EmptyState icon={ConciergeBell} title="No guests in-house" /></div>
            ) : (
              <ul className="divide-y divide-line">
                {inHouse.map((r) => (
                  <GuestRow
                    key={r.id}
                    r={r}
                    done={done[r.id]?.kind === "out"}
                    action={
                      <Button size="sm" variant="outline" onClick={() => checkOut(r)}>
                        <LogOut size={15} /> Check out
                      </Button>
                    }
                    doneLabel="Checked out · room now cleaning"
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

function GuestRow({
  r, action, done, doneLabel,
}: {
  r: Reservation; action: React.ReactNode; done: boolean; doneLabel: string;
}) {
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
      {done ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-ok"><CheckCircle size={15} /> {doneLabel}</span>
      ) : (
        action
      )}
    </li>
  );
}
