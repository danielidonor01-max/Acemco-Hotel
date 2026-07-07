"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, BedDouble, Loader2 } from "lucide-react";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/internal/ui";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/internal/date-picker";
import { getAvailabilityByType, getAvailabilityCalendar } from "@/lib/data/availability";
import { formatNaira, cn } from "@/lib/utils";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Green when comfortably free, amber when tight, red when sold out. */
function cellTone(available: number, capacity: number) {
  if (capacity === 0) return "bg-secondary text-muted-foreground";
  if (available <= 0) return "bg-danger-bg text-danger";
  if (available / capacity <= 0.34) return "bg-warn-bg text-warn";
  return "bg-ok-bg text-ok";
}

export default function AvailabilityPage() {
  const today = useMemo(() => new Date(), []);
  const [checkIn, setCheckIn] = useState(iso(today));
  const [checkOut, setCheckOut] = useState(iso(new Date(today.getTime() + 86_400_000)));

  const validSpan = !!checkIn && !!checkOut && new Date(checkOut) > new Date(checkIn);

  const { data: avail = [], isFetching } = useQuery({
    queryKey: ["availability", checkIn, checkOut],
    queryFn: () => getAvailabilityByType(checkIn, checkOut),
    enabled: validSpan,
  });

  const { data: cal } = useQuery({
    queryKey: ["availability-calendar"],
    queryFn: () => getAvailabilityCalendar(14),
  });

  return (
    <PageShell
      title="Availability"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Availability" }]}
    >
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

      {/* 14-day calendar heatmap */}
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
    </PageShell>
  );
}
