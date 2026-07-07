"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Loader2, Download, ChevronRight, ChevronDown, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listCompanies, createCompany, getCompanyInvoice, settleCompanyInvoice,
  type Company, type CompanyTier,
} from "@/lib/data/companies";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";
import { exportCsv } from "@/lib/export";

const TIERS: CompanyTier[] = ["STANDARD", "PREFERRED", "VIP", "STRATEGIC"];
const tierTone = (t: CompanyTier): "brand" | "info" | "neutral" =>
  t === "STRATEGIC" || t === "VIP" ? "brand" : t === "PREFERRED" ? "info" : "neutral";

export default function CompaniesPage() {
  const { hasPermission } = useAuth();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const { data: companies = [], isLoading } = useQuery({ queryKey: ["companies"], queryFn: listCompanies });

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
  const { data, isLoading } = useQuery({ queryKey: ["company-invoice", company.id], queryFn: () => getCompanyInvoice(company.id) });

  const settle = useMutation({
    mutationFn: () => settleCompanyInvoice(company.id),
    onSuccess: (r) => { toast.success(`Settled ${r.settled} charge(s).`); qc.invalidateQueries({ queryKey: ["company-invoice", company.id] }); },
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
              <div className="mt-1 flex justify-between text-base font-semibold text-fg"><span>Total</span><span>{formatNaira(data.grandTotal)}</span></div>
              <div className="mt-1 flex justify-between text-sm"><span className="text-fg-soft">Outstanding</span><span className={cn("font-medium", data.outstanding > 0 ? "text-warn" : "text-ok")}>{formatNaira(data.outstanding)}</span></div>
            </div>

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
          <Button variant="outline" size="sm" disabled={!data || data.chargeCount === 0} onClick={onExport}><Download size={14} /> Export CSV</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {hasPermission("finance", "APPROVE") && data && data.outstanding > 0 && (
              <Button disabled={settle.isPending} onClick={() => settle.mutate()}>
                {settle.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Mark invoice paid
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
