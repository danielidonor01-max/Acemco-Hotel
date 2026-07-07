"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble, Gauge, Wallet, Users, CalendarArrowDown, CalendarArrowUp,
  Calendar, Package, Wrench, Sparkles, ArrowRight, Star, Ban, DoorClosed, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { PageShell, StatCard, Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/internal/ui";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { getDashboardBrief, getRevenueDaily } from "@/lib/data/operations";

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const { data: brief, isLoading } = useQuery({ queryKey: ["dashboard-brief"], queryFn: getDashboardBrief, retry: 2 });
  const { data: revenueDaily = [] } = useQuery({ queryKey: ["revenue-daily"], queryFn: () => getRevenueDaily(7), retry: 2, enabled: hasPermission("finance", "VIEW") });
  const maxRev = Math.max(1, ...revenueDaily.map((d) => d.amount));

  const canRooms = hasPermission("rooms", "VIEW");
  const canRes = hasPermission("reservations", "VIEW");
  const occ = brief?.occupancy;
  const alerts = brief?.alerts;

  return (
    <PageShell title="Dashboard" breadcrumb={[{ label: "Dashboard" }]}>
      {isLoading && !brief ? (
        <p className="text-sm text-fg-soft">Loading today’s brief…</p>
      ) : (
        <>
          {/* Headline figures */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canRooms && <StatCard title="Occupancy (now)" value={`${occ?.currentOccupancy ?? 0}%`} delta={`${occ?.occupied ?? 0}/${occ?.totalRooms ?? 0} rooms`} icon={Gauge} />}
            {canRooms && <StatCard title="ADR (30d)" value={formatNaira(occ?.adr ?? 0)} delta="Avg daily rate" icon={Wallet} deltaType="positive" />}
            {canRes && <StatCard title="Arrivals today" value={String(brief?.arrivals.length ?? 0)} delta={`${alerts?.unassignedArrivals ?? 0} unassigned`} icon={CalendarArrowDown} />}
            {canRes && <StatCard title="In-house" value={String(brief?.inHouse ?? 0)} delta={`${brief?.departures.length ?? 0} due to depart`} icon={Users} />}
          </div>

          {/* Action items */}
          {alerts && (
            <div className="mt-4 flex flex-wrap gap-2">
              <AlertChip show={canRes} icon={DoorClosed} label="Unassigned arrivals" count={alerts.unassignedArrivals} href="/manage/reception" tone="warn" />
              <AlertChip show={canRes} icon={AlertTriangle} label="Overdue checkouts" count={alerts.overdueCheckouts} href="/manage/reception" tone="danger" />
              <AlertChip show={canRes} icon={Ban} label="Blacklisted arrivals" count={alerts.blacklistedArrivals} href="/manage/reception" tone="danger" />
              <AlertChip show={canRes} icon={Calendar} label="Pending reservations" count={alerts.pendingReservations} href="/manage/reservations" tone="info" />
              <AlertChip show={hasPermission("inventory", "VIEW")} icon={Package} label="Low stock" count={alerts.lowStock} href="/manage/inventory" tone="warn" />
              <AlertChip show={hasPermission("maintenance", "VIEW")} icon={Wrench} label="Open work orders" count={alerts.openWorkOrders} href="/manage/maintenance" tone="info" />
              <AlertChip show={hasPermission("housekeeping", "VIEW")} icon={Sparkles} label="Housekeeping tasks" count={alerts.activeHousekeeping} href="/manage/housekeeping" tone="info" />
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Arrivals today */}
            {canRes && (
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Arrivals Today</CardTitle>
                  <Link href="/manage/reception" className="inline-flex items-center gap-1 text-sm text-brand-primary-dark hover:text-brand-primary-light">Reception <ArrowRight size={14} /></Link>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-line">
                    {brief?.arrivals.map((a) => (
                      <li key={a.id}>
                        <Link href={`/manage/reservations/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-brand-surface-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                              <span className="truncate">{a.guestName}</span>
                              {a.vip && <Badge tone="brand"><Star size={11} /> VIP</Badge>}
                              {a.blacklisted && <Badge tone="danger"><Ban size={11} /> Blacklist</Badge>}
                            </p>
                            <p className="text-xs text-fg-muted">{a.roomType} · {a.guests} guest{a.guests > 1 ? "s" : ""}</p>
                          </div>
                          {a.checkedIn ? <Badge tone="success">Checked in</Badge>
                            : a.roomAssigned ? <Badge tone="info">Room {a.roomNumber}</Badge>
                            : <Badge tone="warning">Unassigned</Badge>}
                        </Link>
                      </li>
                    ))}
                    {brief?.arrivals.length === 0 && <li className="px-5 py-6 text-center text-sm text-fg-soft">No arrivals today.</li>}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Departures today */}
            {canRes && (
              <Card>
                <CardHeader><CardTitle>Departures Today</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-line">
                    {brief?.departures.map((d) => (
                      <li key={d.id}>
                        <Link href={`/manage/reservations/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-brand-surface-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                              <span className="truncate">{d.guestName}</span>
                              {d.vip && <Badge tone="brand"><Star size={11} /> VIP</Badge>}
                              {d.overdue && <Badge tone="danger">Overdue</Badge>}
                            </p>
                            <p className="text-xs text-fg-muted">{d.roomNumber ? `Room ${d.roomNumber}` : "—"} · balance {formatNaira(d.balance)}</p>
                          </div>
                          <CalendarArrowUp size={16} className="text-fg-soft" />
                        </Link>
                      </li>
                    ))}
                    {brief?.departures.length === 0 && <li className="px-5 py-6 text-center text-sm text-fg-soft">No departures due.</li>}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Tonight's availability */}
            {canRes && (
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Tonight’s Availability</CardTitle>
                  <Link href="/manage/availability" className="inline-flex items-center gap-1 text-sm text-brand-primary-dark hover:text-brand-primary-light">Calendar <ArrowRight size={14} /></Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {brief?.availabilityTonight.map((t) => {
                    const pct = t.capacity ? (t.available / t.capacity) * 100 : 0;
                    const tone = t.available <= 0 ? "bg-danger" : pct <= 34 ? "bg-warn" : "bg-ok";
                    return (
                      <div key={t.slug}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-fg">{t.name}</span>
                          <span className={cn("font-medium tabular-nums", t.available <= 0 ? "text-danger" : "text-fg-soft")}>{t.available}/{t.capacity} free</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-brand-surface-3">
                          <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(4, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {brief?.availabilityTonight.length === 0 && <p className="text-center text-sm text-fg-soft">No room types configured.</p>}
                </CardContent>
              </Card>
            )}

            {/* Revenue trend */}
            {hasPermission("finance", "VIEW") && (
              <Card>
                <CardHeader><CardTitle>Revenue — Last 7 Days</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex h-40 items-end gap-2">
                    {revenueDaily.map((d) => (
                      <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${formatNaira(d.amount)}`}>
                        <div className="w-full rounded-t bg-brand-primary/70" style={{ height: `${Math.round((d.amount / maxRev) * 100)}%` }} />
                      </div>
                    ))}
                    {revenueDaily.length === 0 && <p className="w-full text-center text-sm text-fg-muted">No revenue data yet.</p>}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-fg-muted">
                    {revenueDaily.map((d) => <span key={d.date}>{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</span>)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}

function AlertChip({
  show, icon: Icon, label, count, href, tone,
}: {
  show: boolean; icon: LucideIcon; label: string; count: number; href: string; tone: "warn" | "danger" | "info";
}) {
  if (!show) return null;
  const active = count > 0;
  const tones = {
    warn: "border-warn/40 bg-warn-bg text-warn",
    danger: "border-danger/40 bg-danger-bg text-danger",
    info: "border-info/40 bg-info-bg text-info",
  };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? tones[tone] : "border-line text-fg-muted hover:text-fg",
      )}
    >
      <Icon size={14} />
      <span>{label}</span>
      <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums", active ? "bg-white/60" : "bg-brand-surface-3")}>{count}</span>
    </Link>
  );
}
