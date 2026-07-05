import { notFound } from "next/navigation";
import { Phone, Users, CalendarDays, Home } from "lucide-react";
import { PageShell, Card, CardHeader, CardTitle, CardContent, StatusBadge, Badge } from "@/components/internal/ui";
import { ReservationActions } from "@/components/internal/reservation-actions";
import { getReservation } from "@/lib/mock";
import { getRoomType } from "@/lib/cms";
import { formatNaira } from "@/lib/utils";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = getReservation(id);
  if (!r) notFound();

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
            <CardHeader><CardTitle>Reservation Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Detail icon={Users} label="Guest">
                {r.guestName} {r.isVip && <span className="text-brand-primary" title="VIP">★</span>}
              </Detail>
              <Detail icon={Phone} label="Phone">{r.guestPhone}</Detail>
              <Detail icon={Home} label="Room type">{room?.name}{r.roomNumber ? ` · Room ${r.roomNumber}` : ""}</Detail>
              <Detail icon={Users} label="Occupancy">{r.adults} adult(s), {r.children} child(ren)</Detail>
              <Detail icon={CalendarDays} label="Check-in">{r.checkInDate}</Detail>
              <Detail icon={CalendarDays} label="Check-out">{r.checkOutDate} ({nights} night{nights !== 1 ? "s" : ""})</Detail>
              <Detail icon={Home} label="Source">{r.source.replace(/_/g, " ").toLowerCase()}</Detail>
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

        {/* Folio summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Folio</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label={`Room · ${nights} night(s)`} value={formatNaira((room?.basePrice ?? 0) * nights)} />
              <Row label="Taxes & service" value={formatNaira(Math.round(r.totalAmount * 0.075))} />
              <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-fg">
                <span>Total</span>
                <span>{formatNaira(r.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
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
