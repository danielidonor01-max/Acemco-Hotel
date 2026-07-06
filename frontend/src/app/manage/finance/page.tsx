"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, TrendingDown, Wallet, Download } from "lucide-react";
import { PageShell, StatCard, Button, StatusBadge, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { listTransactions, getFinanceSummary } from "@/lib/data/operations";
import { type Transaction } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";

type TxFilter = "ALL" | "REVENUE" | "EXPENSE" | "PAYROLL" | "REFUND";
const FILTERS: TxFilter[] = ["ALL", "REVENUE", "EXPENSE", "PAYROLL", "REFUND"];

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [filter, setFilter] = useState<TxFilter>("ALL");
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const { data: summary } = useQuery({ queryKey: ["finance-summary"], queryFn: getFinanceSummary });

  // Prefer the server roll-up; fall back to computing from the loaded rows.
  const posted = transactions.filter((t) => t.status === "POSTED");
  const revenue = summary?.revenue ?? posted.filter((t) => t.type === "REVENUE").reduce((s, t) => s + t.amount, 0);
  const expenses = summary ? summary.expense + summary.payroll : posted.filter((t) => t.type === "EXPENSE" || t.type === "PAYROLL").reduce((s, t) => s + t.amount, 0);
  const net = summary?.net ?? revenue - expenses;

  const filtered = useMemo(
    () => (filter === "ALL" ? transactions : transactions.filter((t) => t.type === filter)),
    [filter, transactions],
  );

  const columns: Column<Transaction>[] = [
    {
      key: "transactionNumber", header: "Transaction", sortValue: (t) => t.transactionNumber,
      render: (t) => (
        <div>
          <p className="font-medium text-foreground">{t.transactionNumber}</p>
          <p className="text-xs text-muted-foreground">{t.date}</p>
        </div>
      ),
    },
    { key: "description", header: "Description", render: (t) => <span className="text-muted-foreground">{t.description}</span> },
    { key: "account", header: "Account", render: (t) => <span className="text-muted-foreground">{t.account}</span> },
    { key: "type", header: "Type", render: (t) => <Badge tone={t.type === "REVENUE" ? "success" : t.type === "REFUND" ? "warning" : "neutral"}>{t.type.toLowerCase()}</Badge> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "amount", header: "Amount", align: "right", sortValue: (t) => t.amount,
      render: (t) => (
        <span className={cn("font-medium", t.direction === "CREDIT" ? "text-ok" : "text-foreground")}>
          {t.direction === "CREDIT" ? "+" : "−"}{formatNaira(t.amount)}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Finance"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Finance" }]}
      actions={hasPermission("finance", "EXPORT") && <Button variant="outline"><Download size={16} /> Export</Button>}
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Revenue (posted)" value={formatNaira(revenue)} delta="This period" deltaType="positive" icon={TrendingUp} />
        <StatCard title="Expenses (posted)" value={formatNaira(expenses)} delta="This period" deltaType="negative" icon={TrendingDown} />
        <StatCard title="Net" value={formatNaira(net)} delta={net >= 0 ? "In surplus" : "In deficit"} deltaType={net >= 0 ? "positive" : "negative"} icon={Wallet} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
              filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyState={<EmptyState icon={BarChart3} title="No transactions" />}
      />
    </PageShell>
  );
}
