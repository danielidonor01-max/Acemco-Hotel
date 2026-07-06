"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, TrendingUp, TrendingDown, Wallet, Download, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, StatCard, Button, StatusBadge, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/internal/date-picker";
import { listTransactions, getFinanceSummary, createTransaction } from "@/lib/data/operations";
import { type Transaction } from "@/lib/mock-modules";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { exportCsv } from "@/lib/export";

type TxFilter = "ALL" | "REVENUE" | "EXPENSE" | "PAYROLL" | "REFUND";
const FILTERS: TxFilter[] = ["ALL", "REVENUE", "EXPENSE", "PAYROLL", "REFUND"];
const TX_TYPES: Transaction["type"][] = ["REVENUE", "EXPENSE", "PAYROLL", "REFUND"];

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [filter, setFilter] = useState<TxFilter>("ALL");
  const [creating, setCreating] = useState(false);
  const { data: transactions = [], isLoading } = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const { data: summary } = useQuery({ queryKey: ["finance-summary"], queryFn: getFinanceSummary });

  const posted = transactions.filter((t) => t.status === "POSTED");
  const revenue = summary?.revenue ?? posted.filter((t) => t.type === "REVENUE").reduce((s, t) => s + t.amount, 0);
  const expenses = summary ? summary.expense + summary.payroll : posted.filter((t) => t.type === "EXPENSE" || t.type === "PAYROLL").reduce((s, t) => s + t.amount, 0);
  const net = summary?.net ?? revenue - expenses;

  const filtered = useMemo(
    () => (filter === "ALL" ? transactions : transactions.filter((t) => t.type === filter)),
    [filter, transactions],
  );

  function onExport() {
    exportCsv(
      "acemco-transactions",
      ["Transaction", "Date", "Type", "Account", "Description", "Direction", "Amount", "Status"],
      filtered.map((t) => [t.transactionNumber, t.date, t.type, t.account, t.description, t.direction, t.amount, t.status]),
    );
  }

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
      actions={
        <div className="flex gap-2">
          {hasPermission("finance", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New</Button>}
          {hasPermission("finance", "EXPORT") && <Button variant="outline" onClick={onExport}><Download size={16} /> Export</Button>}
        </div>
      }
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

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyState={<EmptyState icon={BarChart3} title="No transactions" />} />
      {creating && <TransactionDialog onClose={() => setCreating(false)} />}
    </PageShell>
  );
}

function TransactionDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: "EXPENSE" as Transaction["type"], amount: "", account: "", description: "", date: "", status: "POSTED" as Transaction["status"] });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => createTransaction({
      type: form.type,
      amount: Number(form.amount) || 0,
      direction: form.type === "REVENUE" ? "CREDIT" : "DEBIT",
      account: form.account.trim(),
      description: form.description.trim(),
      date: form.date,
      status: form.status,
    }),
    onSuccess: () => {
      toast.success("Transaction recorded.");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.account.trim() && form.description.trim() && Number(form.amount) > 0 && form.date && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>Record a revenue, expense, or refund entry.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TX_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="t-amt">Amount (₦)</Label><Input id="t-amt" type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="t-acct">Account</Label><Input id="t-acct" value={form.account} onChange={(e) => set("account", e.target.value)} placeholder="e.g. Utilities" /></div>
          <div className="grid gap-1.5"><Label htmlFor="t-desc">Description</Label><Input id="t-desc" value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Date</Label><DatePicker value={form.date} onChange={(v) => set("date", v)} placeholder="Select date" /></div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["POSTED", "PENDING", "VOIDED"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
