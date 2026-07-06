"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble, Banknote, CalendarArrowDown, CalendarArrowUp, Calendar,
  Package, Wrench, Sparkles, ArrowRight,
} from "lucide-react";
import { PageShell, StatCard, Card, CardHeader, CardTitle, CardContent, StatusBadge } from "@/components/internal/ui";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";
import { getDashboardStats, listHousekeeping } from "@/lib/data/operations";
import { listReservations } from "@/lib/data/reservations";
import { getRoomType } from "@/lib/cms";

const EMPTY = { occupancyRate: 0, revenueToday: 0, arrivalsToday: 0, departuresToday: 0, pendingReservations: 0, lowStockAlerts: 0, openWorkOrders: 0, activeHousekeeping: 0 };

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const { data: s = EMPTY } = useQuery({ queryKey: ["dashboard-stats"], queryFn: getDashboardStats, select: (d) => d ?? EMPTY });
  const { data: reservations = [] } = useQuery({ queryKey: ["reservations"], queryFn: listReservations });
  const { data: tasks = [] } = useQuery({ queryKey: ["housekeeping"], queryFn: listHousekeeping });

  const arrivals = reservations.filter((r) => r.status === "CONFIRMED").slice(0, 5);
  const pending = reservations.filter((r) => r.status === "PENDING");
  const activeHk = tasks.filter((t) => t.status !== "COMPLETED");

  return (
    <PageShell title="Dashboard" breadcrumb={[{ label: "Dashboard" }]}>
      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {hasPermission("rooms", "VIEW") && (
          <StatCard title="Occupancy Rate" value={`${s.occupancyRate}%`} delta="Live" deltaType="positive" icon={BedDouble} />
        )}
        {hasPermission("finance", "VIEW") && (
          <StatCard title="Revenue (posted)" value={formatNaira(s.revenueToday)} delta="Posted revenue" deltaType="positive" icon={Banknote} />
        )}
        {hasPermission("reservations", "VIEW") && (
          <StatCard title="Arrivals Today" value={String(s.arrivalsToday)} delta="Across all room types" icon={CalendarArrowDown} />
        )}
        {hasPermission("reservations", "VIEW") && (
          <StatCard title="Departures Today" value={String(s.departuresToday)} delta="Scheduled" deltaType="neutral" icon={CalendarArrowUp} />
        )}
      </div>

      {/* Secondary stat row */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat show={hasPermission("reservations", "VIEW")} icon={Calendar} label="Pending" value={s.pendingReservations} />
        <MiniStat show={hasPermission("inventory", "VIEW")} icon={Package} label="Low stock" value={s.lowStockAlerts} tone="warn" />
        <MiniStat show={hasPermission("maintenance", "VIEW")} icon={Wrench} label="Open work orders" value={s.openWorkOrders} />
        <MiniStat show={hasPermission("housekeeping", "VIEW")} icon={Sparkles} label="Active housekeeping" value={s.activeHousekeeping} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Arrivals */}
        {hasPermission("reservations", "VIEW") && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Arrivals Today</CardTitle>
              <Link href="/manage/reservations" className="inline-flex items-center gap-1 text-sm text-brand-primary-dark hover:text-brand-primary-light">
                View all <ArrowRight size={14} />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {arrivals.map((r) => (
                  <li key={r.id}>
                    <Link href={`/manage/reservations/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-brand-surface-2">
                      <div>
                        <p className="text-sm font-medium text-fg">
                          {r.guestName} {r.isVip && <span className="ml-1 text-brand-primary-dark">★</span>}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {getRoomType(r.roomTypeSlug)?.name} · {r.adults + r.children} guest(s)
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
                {arrivals.length === 0 && <li className="px-5 py-6 text-center text-sm text-fg-soft">No arrivals today.</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Pending reservations */}
        {hasPermission("reservations", "VIEW") && (
          <Card>
            <CardHeader><CardTitle>Pending Reservations</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {pending.map((r) => (
                  <li key={r.id}>
                    <Link href={`/manage/reservations/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-brand-surface-2">
                      <div>
                        <p className="text-sm font-medium text-fg">{r.guestName}</p>
                        <p className="text-xs text-fg-muted">{r.reservationNumber} · {r.checkInDate}</p>
                      </div>
                      <span className="text-sm font-medium text-fg">{formatNaira(r.totalAmount)}</span>
                    </Link>
                  </li>
                ))}
                {pending.length === 0 && <li className="px-5 py-6 text-center text-sm text-fg-soft">No pending reservations.</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Housekeeping */}
        {hasPermission("housekeeping", "VIEW") && (
          <Card>
            <CardHeader><CardTitle>Active Housekeeping</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {activeHk.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-fg">Room {t.roomNumber}</p>
                      <p className="text-xs text-fg-muted">{t.type.replace(/_/g, " ").toLowerCase()} · {t.assignedTo ?? "Unassigned"}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
                {activeHk.length === 0 && <li className="px-5 py-6 text-center text-sm text-fg-soft">All caught up.</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Revenue trend (illustrative) */}
        {hasPermission("finance", "VIEW") && (
          <Card>
            <CardHeader><CardTitle>Revenue — Last 7 Days</CardTitle></CardHeader>
            <CardContent>
              <div className="flex h-40 items-end gap-2">
                {[62, 48, 80, 55, 90, 72, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-brand-primary/70" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-fg-muted">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function MiniStat({
  show, icon: Icon, label, value, tone,
}: {
  show: boolean; icon: typeof Package; label: string; value: number; tone?: "warn";
}) {
  if (!show) return null;
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={tone === "warn" ? "text-warn" : "text-brand-primary-dark"}><Icon size={22} strokeWidth={1.5} /></span>
      <div>
        <p className="text-2xl font-bold text-fg">{value}</p>
        <p className="text-xs text-fg-muted">{label}</p>
      </div>
    </Card>
  );
}
