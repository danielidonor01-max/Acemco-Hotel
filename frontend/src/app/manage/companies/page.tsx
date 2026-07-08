"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Loader2, Download, ChevronRight, ChevronDown, CheckCircle, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, Card, CardHeader, CardTitle, CardContent, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listCompanies, createCompany, getCompanyInvoice, settleCompanyInvoice, recordCompanyPayment, getCompaniesAging,
  type Company, type CompanyTier, type CompanyInvoice, type PaymentMethod,
} from "@/lib/data/companies";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { exportCsv } from "@/lib/export";
import { printCompanyInvoice } from "@/lib/print-invoice";
import { printPaymentReceipt } from "@/lib/print-receipt";

const TIERS: CompanyTier[] = ["STANDARD", "PREFERRED", "VIP", "STRATEGIC"];
const tierTone = (t: CompanyTier): "brand" | "info" | "neutral" =>
  t === "STRATEGIC" || t === "VIP" ? "brand" : t === "PREFERRED" ? "info" : "neutral";

export default function CompaniesPage() {
  const { hasPermission } = useAuth();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const { data: companies = [], isLoading } = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const { data: aging } = useQuery({ queryKey: ["companies-aging"], queryFn: getCompaniesAging, enabled: hasPermission("finance", "VIEW") });

  const columns: Column<Company>[] = [
    { key: "name", header: "Company", sortValue: (c) => c.name, render: (c) => <span className="font-medium text-foreground">{c.name}</span> },
    { key: "tier", header: "Tier", render: (c) => <Badge tone={tierTone(c.tier)}>{c.tier.toLowerCase()}</Badge> },
    { key: "status", header: "Status", render: (c) => <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status.toLowerCase()}</Badge> },
    { key: "reservationCount", header: "Reservations", align: "center", sortValue: (c) => c.reservationCount ?? 0, render: (c) => <span className="text-muted-foreground">{c.reservationCount ?? 0}</span> },
    { key: "phone", header: "Phone", render: (c) => <span className="text-muted-foreground">{c.phone ?? "—"}</span> },
  ];

  return (
    <PageShell
      title="Corporate Accounts"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Companies" }]}
      actions={hasPermission("guests", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Company</Button>}
    >
      {aging && aging.totals.outstanding > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Accounts receivable — aged</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <AgeCell label="Current (0–30d)" value={aging.totals.current} />
              <AgeCell label="31–60 days" value={aging.totals.days31_60} tone="warn" />
              <AgeCell label="61–90 days" value={aging.totals.days61_90} tone="warn" />
              <AgeCell label="90+ days" value={aging.totals.days90plus} tone="danger" />
              <AgeCell label="Total outstanding" value={aging.totals.outstanding} strong />
            </div>
            <div className="mt-4 divide-y divide-line rounded-lg border border-line">
              {aging.companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(companies.find((x) => x.id === c.id) ?? { id: c.id, name: c.name, tier: c.tier, status: c.status })}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-brand-surface-2"
                >
                  <span className="flex items-center gap-2 font-medium text-fg">{c.name} <Badge tone={tierTone(c.tier)}>{c.tier.toLowerCase()}</Badge></span>
                  <span className="flex items-center gap-4">
                    {c.days90plus > 0 && <span className="text-xs text-danger">90+: {formatNaira(c.days90plus)}</span>}
                    <span className="font-semibold text-fg">{formatNaira(c.outstanding)}</span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable columns={columns} data={companies} isLoading={isLoading} onRowClick={(c) => setSelected(c)} emptyState={<EmptyState icon={Building2} title="No companies" description="Add a corporate account to bill stays and events." />} />
      {creating && <CompanyDialog onClose={() => setCreating(false)} />}
      {selected && <InvoiceModal company={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

function CompanyDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", contactName: "", email: "", phone: "", billingEmail: "", tier: "STANDARD" as CompanyTier });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => createCompany({
      name: form.name.trim(), contactName: form.contactName.trim() || undefined, email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined, billingEmail: form.billingEmail.trim() || undefined, tier: form.tier,
    }),
    onSuccess: () => { toast.success("Company added."); qc.invalidateQueries({ queryKey: ["companies"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New Corporate Account</DialogTitle><DialogDescription>The company that books and is invoiced.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="c-name">Company name</Label><Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="c-contact">Contact person</Label><Input id="c-contact" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-bill">Billing email</Label><Input id="c-bill" type="email" value={form.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5">
            <Label>Tier</Label>
            <Select value={form.tier} onValueChange={(v) => set("tier", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Add company</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [openGuest, setOpenGuest] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["company-invoice", company.id], queryFn: () => getCompanyInvoice(company.id) });

  const applyInvoice = (inv: CompanyInvoice) => {
    qc.setQueryData(["company-invoice", company.id], inv);
    qc.invalidateQueries({ queryKey: ["companies-aging"] });
  };
  const settle = useMutation({
    mutationFn: () => settleCompanyInvoice(company.id),
    onSuccess: (inv) => { toast.success("Invoice settled in full."); applyInvoice(inv); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onExport() {
    if (!data) return;
    const rows = data.byGuest.flatMap((g) => g.charges.map((c) => [g.guestName, c.date?.slice(0, 10), c.department, c.description, c.room ?? "", c.reference ?? "", c.amount, c.tax, c.status]));
    exportCsv(`invoice-${company.name.replace(/\s+/g, "-").toLowerCase()}`, ["Guest", "Date", "Department", "Description", "Room", "Reference", "Amount", "Tax", "Status"], rows);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{company.name} <Badge tone={tierTone(company.tier)}>{company.tier.toLowerCase()}</Badge></DialogTitle>
          <DialogDescription>Invoice built from the charge ledger — room, F&B, and services across all stays.</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="py-8 text-center text-sm text-fg-muted">Loading invoice…</p>
        ) : data.chargeCount === 0 ? (
          <EmptyState icon={Building2} title="No charges yet" description="Charges appear here as this company's guests stay and spend." />
        ) : (
          <div className="space-y-5">
            {/* Department summary */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">By department</p>
              <ul className="rounded-lg border border-line divide-y divide-line">
                {data.byDepartment.map((d) => (
                  <li key={d.department} className="flex justify-between px-4 py-2 text-sm">
                    <span className="capitalize text-fg-soft">{d.department.toLowerCase()}</span>
                    <span className="font-medium text-fg">{formatNaira(d.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Totals */}
            <div className="rounded-lg bg-brand-surface-2 p-4">
              <div className="flex justify-between text-sm text-fg-soft"><span>Tax included</span><span>{formatNaira(data.taxTotal)}</span></div>
              <div className="mt-1 flex justify-between text-base font-semibold text-fg"><span>Total charges</span><span>{formatNaira(data.grandTotal)}</span></div>
              <div className="mt-1 flex justify-between text-sm"><span className="text-fg-soft">Paid to date</span><span className="font-medium text-ok">{formatNaira(data.paidToDate)}</span></div>
              <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm"><span className="text-fg-soft">Outstanding</span><span className={cn("font-semibold", data.outstanding > 0 ? "text-warn" : "text-ok")}>{formatNaira(data.outstanding)}</span></div>
            </div>

            {/* Aging */}
            {data.outstanding > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Aged outstanding</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <AgeCell label="0–30d" value={data.aging.current} />
                  <AgeCell label="31–60d" value={data.aging.days31_60} tone="warn" />
                  <AgeCell label="61–90d" value={data.aging.days61_90} tone="warn" />
                  <AgeCell label="90+d" value={data.aging.days90plus} tone="danger" />
                </div>
              </div>
            )}

            {/* Payment history */}
            {data.payments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Payments</p>
                <ul className="rounded-lg border border-line divide-y divide-line">
                  {data.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate text-fg-soft">
                        {p.paidAt?.slice(0, 10)} · <span className="capitalize">{p.method.toLowerCase()}</span>
                        {p.reference ? ` · ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-medium text-ok">{formatNaira(p.amount)}</span>
                        <button type="button" onClick={() => printPaymentReceipt(data, p)} className="rounded p-1 text-fg-muted hover:text-fg" title="Print receipt">
                          <Printer size={14} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Per-guest drill-down */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">By guest</p>
              <div className="space-y-2">
                {data.byGuest.map((g) => (
                  <div key={g.guestId} className="rounded-lg border border-line">
                    <button type="button" onClick={() => setOpenGuest(openGuest === g.guestId ? null : g.guestId)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                        {openGuest === g.guestId ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {g.guestName}
                      </span>
                      <span className="text-sm font-medium text-fg">{formatNaira(g.total)}</span>
                    </button>
                    {openGuest === g.guestId && (
                      <ul className="border-t border-line divide-y divide-line">
                        {g.charges.map((c) => (
                          <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate text-fg-soft">{c.description}</p>
                              <p className="text-xs text-fg-muted capitalize">{c.date?.slice(0, 10)} · {c.department.toLowerCase()}{c.room ? ` · Room ${c.room}` : ""} · {c.status.toLowerCase()}</p>
                            </div>
                            <span className="whitespace-nowrap text-fg">{formatNaira(c.amount + c.tax)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data || data.chargeCount === 0} onClick={onExport}><Download size={14} /> CSV</Button>
            <Button variant="outline" size="sm" disabled={!data || data.chargeCount === 0} onClick={() => data && printCompanyInvoice(data)}><Printer size={14} /> Print / PDF</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {hasPermission("finance", "APPROVE") && data && data.outstanding > 0 && (
              <>
                <Button variant="outline" onClick={() => setPaying(true)}><Wallet size={14} /> Record payment</Button>
                <Button disabled={settle.isPending} onClick={() => settle.mutate()}>
                  {settle.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Settle in full
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
      {paying && data && (
        <PaymentDialog companyId={company.id} outstanding={data.outstanding} onClose={() => setPaying(false)} onDone={applyInvoice} />
      )}
    </Dialog>
  );
}

function AgeCell({ label, value, tone, strong }: { label: string; value: number; tone?: "warn" | "danger"; strong?: boolean }) {
  const color = value <= 0 ? "text-fg-muted" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-fg";
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-fg-muted">{label}</p>
      <p className={cn("mt-0.5 font-semibold tabular-nums", strong ? "text-fg text-lg" : color)}>{formatNaira(value)}</p>
    </div>
  );
}

const PAYMENT_METHODS: PaymentMethod[] = ["TRANSFER", "CASH", "CARD", "CREDIT"];

function PaymentDialog({ companyId, outstanding, onClose, onDone }: { companyId: string; outstanding: number; onClose: () => void; onDone: (inv: CompanyInvoice) => void }) {
  const [amount, setAmount] = useState(String(Math.round(outstanding)));
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () => recordCompanyPayment(companyId, { amount: Number(amount), method, reference: reference.trim() || undefined, note: note.trim() || undefined }),
    onSuccess: (inv) => { toast.success("Payment recorded."); onDone(inv); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const amt = Number(amount);
  const invalid = !(amt > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Outstanding balance {formatNaira(outstanding)}. Record a full or partial payment.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amt">Amount (₦)</Label>
            <Input id="pay-amt" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="pay-ref">Reference</Label><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. bank transfer ref" /></div>
          <div className="grid gap-1.5"><Label htmlFor="pay-note">Note</Label><Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={invalid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Record {amt > 0 ? formatNaira(amt) : "payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
