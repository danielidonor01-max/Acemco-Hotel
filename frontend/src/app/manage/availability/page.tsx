"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, BedDouble, Loader2, LayoutGrid, AlignLeft } from "lucide-react";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/internal/ui";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/internal/date-picker";
import { getAvailabilityByType, getAvailabilityCalendar } from "@/lib/data/availability";
import { listReservations } from "@/lib/data/reservations";
import { formatNaira, cn } from "@/lib/utils";
import { roomTypes, getRoomType } from "@/lib/cms";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Green when comfortably free, amber when tight, red when sold out. */
function cellTone(available: number, capacity: number) {
  if (capacity === 0) return "bg-secondary text-muted-foreground";
  if (available <= 0) return "bg-danger-bg text-danger";
  if (available / capacity <= 0.34) return "bg-warn-bg text-warn";
  return "bg-ok-bg text-ok";
}

// ─── Status colour mapping for timeline bars ────────────────────────────────
const STATUS_BAR: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:      { bg: "bg-info/20 border-info/50",    text: "text-info",    label: "Pending" },
  CONFIRMED:    { bg: "bg-ok-bg border-ok/40",         text: "text-ok",     label: "Confirmed" },
  CHECKED_IN:   { bg: "bg-brand-primary/20 border-brand-primary/50", text: "text-brand-primary-dark", label: "In-house" },
  CHECKED_OUT:  { bg: "bg-secondary border-border",   text: "text-muted-foreground", label: "Checked out" },
  CANCELLED:    { bg: "bg-danger-bg/50 border-danger/30", text: "text-danger", label: "Cancelled" },
  NO_SHOW:      { bg: "bg-danger-bg/50 border-danger/30", text: "text-danger", label: "No-show" },
};

type ViewTab = "heatmap" | "timeline";
type TimeSpan = "week" | "month";

export default function AvailabilityPage() {
  const today = useMemo(() => new Date(), []);
  const [checkIn, setCheckIn] = useState(iso(today));
  const [checkOut, setCheckOut] = useState(iso(new Date(today.getTime() + 86_400_000)));
  const [view, setView] = useState<ViewTab>("timeline");
  const [timeSpan, setTimeSpan] = useState<TimeSpan>("week");

  const days = timeSpan === "week" ? 7 : 28;
  const validSpan = !!checkIn && !!checkOut && new Date(checkOut) > new Date(checkIn);

  const { data: avail = [], isFetching } = useQuery({
    queryKey: ["availability", checkIn, checkOut],
    queryFn: () => getAvailabilityByType(checkIn, checkOut),
    enabled: validSpan,
  });

  const { data: cal } = useQuery({
    queryKey: ["availability-calendar", days],
    queryFn: () => getAvailabilityCalendar(days),
    staleTime: 60_000,
  });

  // Reservations for the timeline bars
  const { data: reservationList = [] } = useQuery({
    queryKey: ["reservations"],
    queryFn: listReservations,
    staleTime: 60_000,
  });

  return (
    <PageShell
      title="Availability"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Availability" }]}
      actions={
        <div className="flex items-center gap-1 rounded-lg border border-line bg-brand-surface p-0.5">
          <ViewBtn active={view === "timeline"} icon={AlignLeft} label="Timeline" onClick={() => setView("timeline")} />
          <ViewBtn active={view === "heatmap"} icon={LayoutGrid} label="Heatmap" onClick={() => setView("heatmap")} />
        </div>
      }
    >
      {/* ── Heatmap view ── */}
      {view === "heatmap" && (
        <>
          {/* Date-range lookup */}
          <Card className="mb-6">
            <CardHeader><CardTitle>Check availability</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="grid gap-1.5">
                  <Label>Check-in</Label>
                  <DatePicker value={checkIn} onChange={setCheckIn} placeholder="Select date" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Check-out</Label>
                  <DatePicker value={checkOut} min={checkIn} onChange={setCheckOut} placeholder="Select date" />
                </div>
                {isFetching && <span className="mb-2 inline-flex items-center gap-1.5 text-sm text-fg-soft"><Loader2 size={14} className="animate-spin" /> checking…</span>}
              </div>

              {!validSpan ? (
                <p className="mt-4 text-sm text-danger">Check-out must be after check-in.</p>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {avail.map((t) => (
                    <div key={t.roomTypeId} className="rounded-xl border border-line p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-fg">{t.name}</p>
                          <p className="text-xs text-fg-muted">{formatNaira(t.basePrice)}/night · {t.nights} night{t.nights > 1 ? "s" : ""}</p>
                        </div>
                        <BedDouble size={18} className="text-primary" strokeWidth={1.5} />
                      </div>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className={cn("text-3xl font-bold tracking-tight", t.available > 0 ? "text-fg" : "text-danger")}>{t.available}</span>
                        <span className="text-sm text-fg-muted">/ {t.capacity} free</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.available <= 0 ? <Badge tone="danger">Sold out</Badge> : t.available / t.capacity <= 0.34 ? <Badge tone="warning">Low</Badge> : <Badge tone="success">Available</Badge>}
                        {t.held > 0 && <Badge tone="neutral">{t.held} booked</Badge>}
                        {t.outOfService > 0 && <Badge tone="neutral">{t.outOfService} out of service</Badge>}
                      </div>
                      <p className="mt-3 text-sm text-fg-soft">Stay total {formatNaira(t.totalPrice)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 14-day heatmap */}
          <Card>
            <CardHeader><CardTitle>Next {cal?.days ?? 14} days · rooms free per type</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!cal ? (
                <p className="p-6 text-sm text-fg-soft">Loading calendar…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="sticky left-0 z-10 bg-brand-surface px-4 py-2.5 text-left font-medium text-fg-soft">Room type</th>
                        {cal.calendar.map((d) => {
                          const dt = new Date(d.date);
                          return (
                            <th key={d.date} className="min-w-[46px] px-1.5 py-2.5 text-center text-xs font-medium text-fg-muted">
                              <div className="capitalize">{dt.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</div>
                              <div className="text-fg-soft">{dt.getDate()}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {cal.roomTypes.map((rt) => (
                        <tr key={rt.id} className="border-b border-line last:border-0">
                          <td className="sticky left-0 z-10 bg-brand-surface px-4 py-2 text-left">
                            <span className="font-medium text-fg">{rt.name}</span>
                            <span className="ml-1.5 text-xs text-fg-muted">({rt.capacity})</span>
                          </td>
                          {cal.calendar.map((d) => {
                            const cell = d.cells.find((c) => c.roomTypeId === rt.id);
                            const available = cell?.available ?? 0;
                            return (
                              <td key={d.date} className="px-1 py-1 text-center">
                                <span
                                  className={cn("inline-flex h-8 w-9 items-center justify-center rounded-md text-xs font-semibold tabular-nums", cellTone(available, rt.capacity))}
                                  title={`${rt.name} · ${d.date}: ${available} of ${rt.capacity} free`}
                                >
                                  {available}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Timeline / Gantt view ── */}
      {view === "timeline" && (
        <TimelineView
          days={days}
          timeSpan={timeSpan}
          onChangeSpan={setTimeSpan}
          cal={cal}
          reservations={reservationList}
          today={today}
        />
      )}
    </PageShell>
  );
}

// ─── Timeline view ───────────────────────────────────────────────────────────

interface TimelineViewProps {
  days: number;
  timeSpan: TimeSpan;
  onChangeSpan: (s: TimeSpan) => void;
  cal: Awaited<ReturnType<typeof getAvailabilityCalendar>> | undefined;
  reservations: Awaited<ReturnType<typeof listReservations>>;
  today: Date;
}

function TimelineView({ days, timeSpan, onChangeSpan, cal, reservations, today }: TimelineViewProps) {
  const COL_W = 48; // px per day column
  const ROW_H = 44; // px per reservation bar row
  const LABEL_W = 150; // px for room-type label column

  // Build the date sequence for the visible window
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate.getTime() + i * 86_400_000);
    return d.toISOString().slice(0, 10);
  });

  // Identify the room types we'll use (from CMS – same source as everything else)
  const allTypes = roomTypes;

  // For each room type, collect active reservations in the window
  const activeStatuses = new Set(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"]);
  const windowEnd = dates[dates.length - 1];

  const resByType = useMemo(() => {
    return new Map(
      allTypes.map((rt) => {
        const res = reservations
          .filter(
            (r) =>
              r.roomTypeSlug === rt.slug &&
              activeStatuses.has(r.status) &&
              r.checkInDate <= windowEnd &&
              r.checkOutDate > dates[0],
          )
          .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
        return [rt.slug, res];
      }),
    );
  }, [reservations, allTypes, dates]);

  // Month/week separator markers
  const monthBoundaries = new Set<string>();
  dates.forEach((d) => {
    if (new Date(d).getUTCDate() === 1) monthBoundaries.add(d);
  });

  const todayStr = today.toISOString().slice(0, 10);

  // Legend colours
  const LEGEND = [
    { label: "Confirmed", cls: "bg-ok-bg border-ok/40 text-ok" },
    { label: "In-house", cls: "bg-brand-primary/20 border-brand-primary/50 text-brand-primary-dark" },
    { label: "Pending", cls: "bg-info/20 border-info/50 text-info" },
    { label: "Checked out", cls: "bg-secondary border-border text-muted-foreground" },
    { label: "Cancelled", cls: "bg-danger-bg/50 border-danger/30 text-danger" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange size={18} className="text-primary" strokeWidth={1.5} />
            Reservation timeline · {timeSpan === "week" ? "7 days" : "28 days"} from today
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Week / Month toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-brand-surface p-0.5">
              {(["week", "month"] as TimeSpan[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onChangeSpan(s)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    timeSpan === s
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {s === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-2">
          {LEGEND.map((l) => (
            <span key={l.label} className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium", l.cls)}>
              {l.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!cal ? (
          <div className="flex items-center gap-2 p-8 text-sm text-fg-soft">
            <Loader2 size={14} className="animate-spin" />
            Loading timeline…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: LABEL_W + COL_W * days }}>
              {/* ── Column headers ── */}
              <div className="flex border-b border-line" style={{ paddingLeft: LABEL_W }}>
                {dates.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const isToday = d === todayStr;
                  const isMonthStart = monthBoundaries.has(d);
                  return (
                    <div
                      key={d}
                      style={{ width: COL_W, minWidth: COL_W }}
                      className={cn(
                        "flex flex-col items-center justify-center border-r border-line py-2 text-center text-xs",
                        isToday && "bg-brand-primary/8",
                        isMonthStart && "border-l-2 border-l-brand-primary/40",
                      )}
                    >
                      <span className={cn("font-medium uppercase", isToday ? "text-brand-primary-dark" : "text-fg-muted")}>
                        {dt.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                      </span>
                      <span className={cn(
                        "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                        isToday ? "bg-brand-primary text-white" : "text-fg-soft",
                      )}>
                        {dt.getDate()}
                      </span>
                      {isMonthStart && (
                        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-primary/70">
                          {dt.toLocaleDateString(undefined, { month: "short" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Room type rows ── */}
              {allTypes.map((rt, rtIdx) => {
                const rowRes = resByType.get(rt.slug) ?? [];
                const capacity = cal.roomTypes.find((c) => c.slug === rt.slug)?.capacity ?? "—";
                const isLast = rtIdx === allTypes.length - 1;

                return (
                  <div
                    key={rt.slug}
                    className={cn("flex", !isLast && "border-b border-line")}
                    style={{ minHeight: ROW_H + rowRes.length * (ROW_H + 4) + 8 }}
                  >
                    {/* Row label */}
                    <div
                      className="sticky left-0 z-10 flex flex-shrink-0 flex-col justify-center border-r border-line bg-brand-surface px-4 py-3"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      <span className="text-sm font-semibold text-fg">{rt.name}</span>
                      <span className="text-xs text-fg-muted">{capacity} rooms</span>
                    </div>

                    {/* Timeline grid + bars */}
                    <div className="relative flex-1" style={{ minHeight: ROW_H }}>
                      {/* Day column stripes */}
                      <div className="absolute inset-0 flex">
                        {dates.map((d) => {
                          const isToday = d === todayStr;
                          const calDay = cal.calendar.find((c) => c.date === d);
                          const cell = calDay?.cells.find((c) => c.roomTypeId === (cal.roomTypes.find((t) => t.slug === rt.slug)?.id));
                          const avail = cell?.available ?? null;
                          const cap = cell?.capacity ?? 0;
                          return (
                            <div
                              key={d}
                              style={{ width: COL_W, minWidth: COL_W }}
                              className={cn(
                                "h-full border-r border-line/50",
                                isToday && "bg-brand-primary/5",
                                monthBoundaries.has(d) && "border-l border-l-brand-primary/30",
                              )}
                              title={avail !== null ? `${rt.name} · ${d}: ${avail} of ${cap} free` : undefined}
                            />
                          );
                        })}
                      </div>

                      {/* Capacity availability dots at top */}
                      <div className="absolute top-1 left-0 flex" style={{ pointerEvents: "none" }}>
                        {dates.map((d) => {
                          const calDay = cal.calendar.find((c) => c.date === d);
                          const rtId = cal.roomTypes.find((t) => t.slug === rt.slug)?.id;
                          const cell = calDay?.cells.find((c) => c.roomTypeId === rtId);
                          if (!cell) return <div key={d} style={{ width: COL_W, minWidth: COL_W }} />;
                          const pct = cell.capacity > 0 ? cell.available / cell.capacity : 1;
                          const dotColor = cell.available <= 0 ? "bg-danger" : pct <= 0.34 ? "bg-warn" : "bg-ok";
                          return (
                            <div key={d} style={{ width: COL_W, minWidth: COL_W }} className="flex items-center justify-center">
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
                                title={`${cell.available}/${cell.capacity} free`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Reservation bars */}
                      <div className="absolute top-5 left-0 flex flex-col gap-1 px-1" style={{ width: "100%" }}>
                        {rowRes.map((r) => {
                          // Clip the bar to the visible window
                          const barStart = r.checkInDate < dates[0] ? dates[0] : r.checkInDate;
                          const barEnd = r.checkOutDate > dates[dates.length - 1] ? dates[dates.length - 1] : r.checkOutDate;
                          const startIdx = dates.indexOf(barStart);
                          const endIdx = dates.indexOf(barEnd);
                          if (startIdx < 0 && endIdx < 0) return null;

                          const left = (startIdx < 0 ? 0 : startIdx) * COL_W + 2;
                          const effectiveEnd = endIdx < 0 ? dates.length : endIdx;
                          const width = Math.max(1, effectiveEnd - (startIdx < 0 ? 0 : startIdx)) * COL_W - 4;
                          const style = STATUS_BAR[r.status] ?? STATUS_BAR.PENDING;
                          const isArriving = r.checkInDate >= dates[0] && r.checkInDate <= dates[dates.length - 1];
                          const isDeparting = r.checkOutDate > dates[0] && r.checkOutDate <= dates[dates.length - 1];

                          return (
                            <div
                              key={r.id}
                              className={cn(
                                "absolute flex items-center gap-1.5 overflow-hidden rounded-md border px-2 text-xs font-medium leading-none transition-shadow hover:shadow-md",
                                style.bg,
                                style.text,
                              )}
                              style={{ left, width, height: ROW_H - 8, top: 0 }}
                              title={`${r.reservationNumber} · ${r.guestName}\n${r.checkInDate} → ${r.checkOutDate}\nStatus: ${r.status}`}
                            >
                              {isArriving && <span className="text-[10px] opacity-70" title="Arrives">↘</span>}
                              <span className="truncate">{r.guestName}</span>
                              {isDeparting && <span className="ml-auto text-[10px] opacity-70 flex-shrink-0" title="Departs">↙</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Today marker line */}
              {dates.includes(todayStr) && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-brand-primary/60 z-20"
                  style={{ left: LABEL_W + dates.indexOf(todayStr) * COL_W + COL_W / 2 }}
                  aria-label="Today"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ViewBtn({
  active, icon: Icon, label, onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-brand-primary text-white shadow-sm" : "text-fg-muted hover:text-fg",
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
