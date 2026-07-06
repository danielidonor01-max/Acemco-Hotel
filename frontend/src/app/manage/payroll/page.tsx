"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardContent, Button, StatusBadge, Badge } from "@/components/internal/ui";
import { listPayrollPeriods, setPayrollStatus } from "@/lib/data/operations";
import { type PayrollPeriod } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

// Advance one step through the payroll lifecycle.
const NEXT: Partial<Record<PayrollPeriod["status"], { to: PayrollPeriod["status"]; label: string }>> = {
  DRAFT: { to: "PROCESSING", label: "Begin processing" },
  PROCESSING: { to: "APPROVED", label: "Review & approve" },
  APPROVED: { to: "PAID", label: "Mark as paid" },
  PAID: { to: "CLOSED", label: "Close period" },
};

export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const { data: periods = [], isLoading } = useQuery({ queryKey: ["payroll"], queryFn: listPayrollPeriods });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PayrollPeriod["status"] }) => setPayrollStatus(id, status),
    onSuccess: () => { toast.success("Payroll period updated."); qc.invalidateQueries({ queryKey: ["payroll"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell title="Payroll" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Payroll" }]}>
      {isLoading ? (
        <p className="text-sm text-fg-soft">Loading payroll…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {periods.map((p) => {
            const next = NEXT[p.status];
            return (
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
                    <Badge tone={p.status === "PAID" || p.status === "CLOSED" ? "success" : "info"}>
                      {p.status === "PAID" ? "Disbursed" : p.status === "CLOSED" ? "Closed" : "In progress"}
                    </Badge>
                    {next && hasPermission("payroll", "APPROVE") && (
                      <Button size="sm" variant="outline" disabled={advance.isPending} onClick={() => advance.mutate({ id: p.id, status: next.to })}>
                        {advance.isPending && advance.variables?.id === p.id ? <Loader2 size={14} className="animate-spin" /> : null}
                        {next.label} <ArrowRight size={14} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {!isLoading && periods.length === 0 && (
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
