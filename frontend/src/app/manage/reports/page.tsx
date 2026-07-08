"use client";

import { useQuery } from "@tanstack/react-query";
import { FileBarChart, BedDouble, TrendingUp, TrendingDown, Wallet, Boxes, Wrench, Banknote, Download, Gauge, Moon, Receipt } from "lucide-react";
import { PageShell, Card, CardContent, StatCard, Badge, Button } from "@/components/internal/ui";
import { getReportsOverview, getOccupancyReport } from "@/lib/data/operations";
import { getCompaniesAging } from "@/lib/data/companies";
import { reportDefs } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { exportCsv } from "@/lib/export";

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const canFinance = hasPermission("finance", "VIEW");
  const { data: o, isLoading } = useQuery({ queryKey: ["reports-overview"], queryFn: getReportsOverview });
  const { data: occ } = useQuery({ queryKey: ["reports-occupancy"], queryFn: () => getOccupancyReport(30) });
  const { data: aging } = useQuery({ queryKey: ["companies-aging"], queryFn: getCompaniesAging, enabled: canFinance });

  function onExportAr() {
    if (!aging) return;
    const rows = aging.companies.map((c) => [c.name, c.tier, c.current, c.days31_60, c.days61_90, c.days90plus, c.outstanding] as (string | number)[]);
    rows.push(["TOTAL", "", aging.totals.current, aging.totals.days31_60, aging.totals.days61_90, aging.totals.days90plus, aging.totals.outstanding]);
    exportCsv("acemco-receivables-aging", ["Company", "Tier", "0-30d", "31-60d", "61-90d", "90+d", "Outstanding"], rows);
  }

  function onExport() {
    if (!o) return;
    const rows: [string, string | number][] = [
      ["Occupancy rate (%)", o.occupancyRate],
      ["Total revenue (posted)", o.totalRevenue],
      ["Total expenses (posted)", o.totalExpense],
      ["Net position", o.netPosition],
      ["Inventory valuation", o.inventoryValuation],
      ["Work-order spend", o.workOrderSpend],
      ...(o.latestPayroll ? [[`Payroll (${o.latestPayroll.periodName}) net`, o.latestPayroll.totalNet] as [string, number]] : []),
      ...Object.entries(o.revenueByAccount).map(([acct, amt]) => [`Revenue · ${acct}`, amt] as [string, number]),
    ];
    exportCsv("acemco-reports-overview", ["Metric", "Value"], rows);
  }

  return (
    <PageShell
      title="Reports"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reports" }]}
      actions={hasPermission("reports", "EXPORT") && <Button variant="outline" disabled={!o} onClick={onExport}><Download size={16} /> Export overview</Button>}
    >
      {/* Live at-a-glance figures */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">At a glance</h2>
      {isLoading || !o ? (
        <p className="mb-8 text-sm text-fg-soft">Loading figures…</p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Occupancy" value={`${o.occupancyRate}%`} icon={BedDouble} />
          <StatCard title="Revenue (posted)" value={formatNaira(o.totalRevenue)} deltaType="positive" icon={TrendingUp} />
          <StatCard title="Expenses (posted)" value={formatNaira(o.totalExpense)} deltaType="negative" icon={TrendingDown} />
          <StatCard title="Net position" value={formatNaira(o.netPosition)} deltaType={o.netPosition >= 0 ? "positive" : "negative"} icon={Wallet} />
          <StatCard title="Inventory valuation" value={formatNaira(o.inventoryValuation)} icon={Boxes} />
          <StatCard title="Work-order spend" value={formatNaira(o.workOrderSpend)} icon={Wrench} />
          {o.latestPayroll && (
            <StatCard title={`Payroll — ${o.latestPayroll.periodName}`} value={formatNaira(o.latestPayroll.totalNet)} delta={`${o.latestPayroll.headcount} staff · net`} icon={Banknote} />
          )}
        </div>
      )}

      {/* Occupancy & ADR (last 30 days) */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Occupancy &amp; ADR · last 30 days</h2>
      {!occ ? (
        <p className="mb-8 text-sm text-fg-soft">Loading figures…</p>
      ) : (
        <div className="mb-8 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Occupancy (period)" value={`${occ.occupancyRate}%`} delta={`${occ.roomNights} room-nights`} icon={Gauge} />
            <StatCard title="ADR" value={formatNaira(occ.adr)} delta="Avg daily rate" icon={TrendingUp} />
            <StatCard title="RevPAR" value={formatNaira(occ.revpar)} delta="Rev per available room" icon={Wallet} />
            <StatCard title="Occupancy (now)" value={`${occ.currentOccupancy}%`} delta={`${occ.occupied}/${occ.totalRooms} rooms`} icon={BedDouble} />
          </div>
          <div className="flex flex-wrap gap-2">
            {occ.statusBreakdown.map((s) => (
              <span key={s.status} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs capitalize text-fg-soft">
                <Moon size={11} /> {s.status.replace(/_/g, " ").toLowerCase()} · {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Corporate receivables (AR aging) */}
      {canFinance && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Receivables · corporate AR aging</h2>
            {hasPermission("reports", "EXPORT") && aging && aging.companies.length > 0 && (
              <Button variant="outline" size="sm" onClick={onExportAr}><Download size={14} /> Export AR</Button>
            )}
          </div>
          {!aging ? (
            <p className="mb-8 text-sm text-fg-soft">Loading receivables…</p>
          ) : aging.companies.length === 0 ? (
            <Card className="mb-8"><CardContent className="flex items-center gap-2 p-5 text-sm text-fg-soft"><Receipt size={18} className="text-primary" /> No outstanding corporate balances — all settled.</CardContent></Card>
          ) : (
            <div className="mb-8 space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                <StatCard title="Total outstanding" value={formatNaira(aging.totals.outstanding)} delta={`${aging.companies.length} account(s)`} icon={Receipt} deltaType={aging.totals.outstanding > 0 ? "negative" : "neutral"} />
                <StatCard title="Current (0–30d)" value={formatNaira(aging.totals.current)} icon={Wallet} />
                <StatCard title="31–60 days" value={formatNaira(aging.totals.days31_60)} icon={Wallet} />
                <StatCard title="61–90 days" value={formatNaira(aging.totals.days61_90)} icon={Wallet} />
                <StatCard title="90+ days" value={formatNaira(aging.totals.days90plus)} icon={Wallet} deltaType={aging.totals.days90plus > 0 ? "negative" : "neutral"} delta={aging.totals.days90plus > 0 ? "overdue" : undefined} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-xs uppercase tracking-wide text-fg-muted">
                          <th className="px-4 py-2.5 text-left font-medium">Company</th>
                          <th className="px-3 py-2.5 text-right font-medium">0–30d</th>
                          <th className="px-3 py-2.5 text-right font-medium">31–60d</th>
                          <th className="px-3 py-2.5 text-right font-medium">61–90d</th>
                          <th className="px-3 py-2.5 text-right font-medium">90+d</th>
                          <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aging.companies.map((c) => (
                          <tr key={c.id} className="border-b border-line last:border-0">
                            <td className="px-4 py-2.5"><span className="font-medium text-fg">{c.name}</span> <Badge tone="neutral">{c.tier.toLowerCase()}</Badge></td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-fg-soft">{c.current ? formatNaira(c.current) : "—"}</td>
                            <td className={cn("px-3 py-2.5 text-right tabular-nums", c.days31_60 ? "text-warn" : "text-fg-muted")}>{c.days31_60 ? formatNaira(c.days31_60) : "—"}</td>
                            <td className={cn("px-3 py-2.5 text-right tabular-nums", c.days61_90 ? "text-warn" : "text-fg-muted")}>{c.days61_90 ? formatNaira(c.days61_90) : "—"}</td>
                            <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", c.days90plus ? "text-danger" : "text-fg-muted")}>{c.days90plus ? formatNaira(c.days90plus) : "—"}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-fg">{formatNaira(c.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-line font-semibold text-fg">
                          <td className="px-4 py-2.5">Total</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNaira(aging.totals.current)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNaira(aging.totals.days31_60)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNaira(aging.totals.days61_90)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNaira(aging.totals.days90plus)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{formatNaira(aging.totals.outstanding)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Report catalogue */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Report catalogue</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportDefs.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between">
                <FileBarChart size={22} className="text-primary" strokeWidth={1.5} />
                <Badge tone="neutral">{r.module}</Badge>
              </div>
              <p className="mt-3 font-semibold text-foreground">{r.name}</p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
