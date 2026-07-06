"use client";

import { useQuery } from "@tanstack/react-query";
import { FileBarChart, BedDouble, TrendingUp, TrendingDown, Wallet, Boxes, Wrench, Banknote } from "lucide-react";
import { PageShell, Card, CardContent, StatCard, Badge } from "@/components/internal/ui";
import { getReportsOverview } from "@/lib/data/operations";
import { reportDefs } from "@/lib/mock-modules";
import { formatNaira } from "@/lib/utils";

export default function ReportsPage() {
  const { data: o, isLoading } = useQuery({ queryKey: ["reports-overview"], queryFn: getReportsOverview });

  return (
    <PageShell title="Reports" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Reports" }]}>
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
