"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Percent, Download, Receipt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge, StatCard } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import {
  getTaxRates, createTaxRate, updateTaxRate, deactivateTaxRate, getTaxReport,
  TAX_DEPARTMENTS, type TaxRate, type TaxDepartment,
} from "@/lib/data/tax";
import { formatNaira, cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

export default function TaxPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings", "UPDATE");
  const canViewReport = hasPermission("finance", "VIEW");

  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState({ from: monthStart(), to: today() });

  const { data: rates = [], isLoading, isError, error } = useQuery({ queryKey: ["tax-rates"], queryFn: getTaxRates });
  const { data: report, isFetching: loadingReport } = useQuery({
    queryKey: ["tax-report", range.from, range.to],
    queryFn: () => getTaxReport(range.from, range.to),
    enabled: canViewReport && Boolean(range.from && range.to),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateTaxRate(id),
    onSuccess: () => { toast.success("Tax rate deactivated."); qc.invalidateQueries({ queryKey: ["tax-rates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    if (!report) return;
    const rows = [
      ["Tax return", `${report.from} to ${report.to}`],
      [],
      ["Department", "Net", "Tax", "Gross", "Charges"],
      ...report.byDepartment.map((d) => [d.department, d.net, d.tax, d.gross, d.count]),
      [],
      ["TOTAL", report.totals.net, report.totals.tax, report.totals.gross, report.totals.charges],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-return-${report.from}_${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell
      title="Tax & Compliance"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Tax & Compliance" }]}
      actions={canEdit ? <Button onClick={() => setAdding(true)}><Plus size={14} /> New tax</Button> : undefined}
    >
      <div className="grid gap-6">
        {/* Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Tax rates</CardTitle>
            <p className="text-sm text-fg-muted">
              These rates drive every bill — the POS till, guest folios, corporate invoices and the return below all read them.
              Changing a rate here changes all of them at once.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-fg-muted"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading…</p>
            ) : isError ? (
              <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
                <AlertTriangle size={15} /> Couldn&apos;t load tax rates: {(error as Error).message}
              </div>
            ) : rates.length === 0 ? (
              <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-6 text-center">
                <p className="text-sm font-medium text-fg">No tax configured</p>
                <p className="mt-1 text-sm text-fg-soft">Guests are being billed with no tax applied. Add your VAT rate to bill lawfully.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-muted">
                      <th className="pb-2 pr-3 font-medium">Tax</th>
                      <th className="pb-2 pr-3 font-medium">Rate</th>
                      <th className="pb-2 pr-3 font-medium">Applies to</th>
                      <th className="pb-2 pr-3 font-medium">Pricing</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.id} className={cn("border-b border-line/60", !r.isActive && "opacity-50")}>
                        <td className="py-2.5 pr-3">
                          <span className="font-medium text-fg">{r.name}</span>
                          <span className="ml-2 text-xs text-fg-muted">{r.code}</span>
                          {!r.isActive && <Badge className="ml-2">Inactive</Badge>}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-fg">{Number(r.rate)}%</td>
                        <td className="py-2.5 pr-3">
                          <span className="text-xs text-fg-soft">{r.appliesTo.join(", ").toLowerCase()}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={r.isInclusive ? "brand" : undefined}>
                            {r.isInclusive ? "Included in price" : "Added on top"}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          {canEdit && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
                              {r.isActive && (
                                <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(r.id)} disabled={deactivate.isPending}>
                                  Deactivate
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Return */}
        {canViewReport && (
          <Card>
            <CardHeader>
              <CardTitle>Tax collected</CardTitle>
              <p className="text-sm text-fg-muted">
                What you&apos;ve charged guests and owe the authorities, straight from the charge ledger. Use this to file.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="tx-from">From</Label>
                  <Input id="tx-from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-40" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tx-to">To</Label>
                  <Input id="tx-to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-40" />
                </div>
                {loadingReport && <Loader2 size={15} className="mb-2.5 animate-spin text-fg-muted" />}
                <div className="ml-auto">
                  <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!report || report.totals.charges === 0}>
                    <Download size={14} /> Export CSV
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard title="Net (excl. tax)" value={formatNaira(report?.totals.net ?? 0)} icon={Receipt} />
                <StatCard title="Tax collected" value={formatNaira(report?.totals.tax ?? 0)} icon={Percent} />
                <StatCard title="Gross billed" value={formatNaira(report?.totals.gross ?? 0)} icon={Receipt} />
              </div>

              {report && report.byDepartment.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-muted">
                        <th className="pb-2 pr-3 font-medium">Department</th>
                        <th className="pb-2 pr-3 text-right font-medium">Net</th>
                        <th className="pb-2 pr-3 text-right font-medium">Tax</th>
                        <th className="pb-2 pr-3 text-right font-medium">Gross</th>
                        <th className="pb-2 text-right font-medium">Charges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byDepartment.map((d) => (
                        <tr key={d.department} className="border-b border-line/60">
                          <td className="py-2.5 pr-3 capitalize text-fg">{d.department.toLowerCase()}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-fg-soft">{formatNaira(d.net)}</td>
                          <td className="py-2.5 pr-3 text-right font-medium tabular-nums text-fg">{formatNaira(d.tax)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-fg-soft">{formatNaira(d.gross)}</td>
                          <td className="py-2.5 text-right tabular-nums text-fg-muted">{d.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-fg-muted">No charges billed in this period.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(adding || editing) && (
        <TaxRateDialog
          rate={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["tax-rates"] }); setAdding(false); setEditing(null); }}
        />
      )}
    </PageShell>
  );
}

function TaxRateDialog({ rate, onClose, onSaved }: { rate: TaxRate | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = Boolean(rate);
  const [form, setForm] = useState({
    name: rate?.name ?? "",
    code: rate?.code ?? "",
    rate: rate ? String(Number(rate.rate)) : "",
    appliesTo: (rate?.appliesTo ?? ["ROOM", "RESTAURANT", "LOUNGE", "BOUTIQUE"]) as TaxDepartment[],
    isInclusive: rate?.isInclusive ?? false,
  });

  const save = useMutation({
    mutationFn: () => {
      const dto = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        rate: Number(form.rate),
        appliesTo: form.appliesTo,
        isInclusive: form.isInclusive,
      };
      return isEdit ? updateTaxRate(rate!.id, dto) : createTaxRate(dto);
    },
    onSuccess: () => { toast.success(isEdit ? "Tax rate updated." : "Tax rate added."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rateNum = Number(form.rate);
  const valid = form.name.trim() && form.code.trim() && form.rate !== "" && rateNum >= 0 && rateNum <= 100 && form.appliesTo.length > 0;

  const toggleDept = (d: TaxDepartment) =>
    setForm((f) => ({ ...f, appliesTo: f.appliesTo.includes(d) ? f.appliesTo.filter((x) => x !== d) : [...f.appliesTo, d] }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit tax rate" : "New tax rate"}</DialogTitle>
          <DialogDescription>
            Applies to every charge in the selected departments, from the moment you save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px_120px]">
            <div className="grid gap-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input id="t-name" placeholder="VAT" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-code">Code</Label>
              <Input id="t-code" placeholder="VAT" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-rate">Rate (%)</Label>
              <Input id="t-rate" type="number" step="0.001" min="0" max="100" placeholder="7.5" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Applies to</Label>
            <div className="flex flex-wrap gap-2">
              {TAX_DEPARTMENTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDept(d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                    form.appliesTo.includes(d)
                      ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark"
                      : "border-line-2 text-fg-soft hover:text-fg",
                  )}
                >
                  {d.toLowerCase()}
                </button>
              ))}
            </div>
            <p className="text-xs text-fg-muted">
              Leave deposits and discounts out — a deposit is a payment, not a taxable sale.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Pricing</Label>
            <div className="flex gap-2">
              {[
                { v: false, label: "Added on top", hint: "₦6,500 + tax" },
                { v: true, label: "Included in price", hint: "₦6,500 incl. tax" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isInclusive: o.v }))}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-left transition-colors",
                    form.isInclusive === o.v ? "border-brand-primary bg-brand-primary/10" : "border-line-2 hover:border-line",
                  )}
                >
                  <span className="block text-sm font-medium text-fg">{o.label}</span>
                  <span className="block text-xs text-fg-muted">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Percent size={14} />}
            {isEdit ? "Save changes" : "Add tax"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
