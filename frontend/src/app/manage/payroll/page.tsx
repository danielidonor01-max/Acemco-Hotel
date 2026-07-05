"use client";

import { Banknote, ArrowRight } from "lucide-react";
import { PageShell, Card, CardContent, Button, StatusBadge, Badge } from "@/components/internal/ui";
import { payrollPeriods } from "@/lib/mock-modules";
import { hasPermission } from "@/lib/permissions";
import { formatNaira } from "@/lib/utils";

export default function PayrollPage() {
  return (
    <PageShell title="Payroll" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Payroll" }]}>
      <div className="grid gap-4 md:grid-cols-2">
        {payrollPeriods.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">{p.periodName}</p>
                  <p className="text-xs text-muted-foreground">{p.startDate} → {p.endDate}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <Metric label="Headcount" value={String(p.headcount)} />
                <Metric label="Gross" value={formatNaira(p.totalGross)} />
                <Metric label="Net" value={formatNaira(p.totalNet)} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <Badge tone={p.status === "PAID" ? "success" : "info"}>{p.status === "PAID" ? "Disbursed" : "In progress"}</Badge>
                {hasPermission("payroll", "APPROVE") && (
                  <Button size="sm" variant="outline">
                    {p.status === "PROCESSING" ? "Review & approve" : "View payslips"} <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {payrollPeriods.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 text-muted-foreground">
          <Banknote size={40} strokeWidth={1} /> No payroll periods yet.
        </div>
      )}
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
