"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/internal/date-picker";
import { listConferences, createConference, type Conference } from "@/lib/data/conferences";
import { listCompanies } from "@/lib/data/companies";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

export default function ConferencesPage() {
  const { hasPermission } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data: conferences = [], isLoading } = useQuery({ queryKey: ["conferences"], queryFn: listConferences });

  const columns: Column<Conference>[] = [
    {
      key: "name", header: "Event", sortValue: (c) => c.name,
      render: (c) => <div><p className="font-medium text-foreground">{c.name}</p><p className="text-xs text-muted-foreground">{c.reference}</p></div>,
    },
    { key: "company", header: "Company", render: (c) => <span className="text-muted-foreground">{c.company ?? "—"}</span> },
    { key: "date", header: "Date", sortValue: (c) => c.date, render: (c) => <span className="text-muted-foreground">{c.date?.slice(0, 10)}</span> },
    { key: "total", header: "Total", align: "right", sortValue: (c) => c.total, render: (c) => <span className="font-medium text-foreground">{formatNaira(c.total)}</span> },
    { key: "status", header: "Status", render: (c) => <Badge tone={c.status === "PAID" ? "success" : "warning"}>{c.status.toLowerCase()}</Badge> },
  ];

  return (
    <PageShell
      title="Conferences & Events"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Conferences" }]}
      actions={hasPermission("reservations", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Booking</Button>}
    >
      <p className="mb-4 max-w-2xl text-sm text-fg-soft">
        A lightweight event workflow — book the hall with meals, coffee, and a room allotment.
        Charges post to the company&apos;s account and appear on its invoice.
      </p>
      <DataTable columns={columns} data={conferences} isLoading={isLoading} emptyState={<EmptyState icon={CalendarClock} title="No conference bookings" description="Book an event to bill a company for the hall, meals, and rooms." />} />
      {creating && <ConferenceDialog onClose={() => setCreating(false)} />}
    </PageShell>
  );
}

function ConferenceDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const [form, setForm] = useState({ companyId: "", name: "", date: "", attendees: "", hallFee: "", mealsAmount: "", coffeeAmount: "", roomsAmount: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => Number(v) || 0;
  const total = num(form.hallFee) + num(form.mealsAmount) + num(form.coffeeAmount) + num(form.roomsAmount);

  const save = useMutation({
    mutationFn: () => createConference({
      companyId: form.companyId, name: form.name.trim(), date: form.date,
      attendees: num(form.attendees) || undefined,
      hallFee: num(form.hallFee), mealsAmount: num(form.mealsAmount), coffeeAmount: num(form.coffeeAmount), roomsAmount: num(form.roomsAmount),
    }),
    onSuccess: (r) => { toast.success(`Booking ${r.reference} created.`); qc.invalidateQueries({ queryKey: ["conferences"] }); qc.invalidateQueries({ queryKey: ["company-invoice"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSave = form.companyId && form.name.trim() && form.date && num(form.hallFee) > 0 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Conference / Event</DialogTitle>
          <DialogDescription>Book the hall for a company. Charges bill to their account.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Company</Label>
            <Select value={form.companyId} onValueChange={(v) => set("companyId", v)}>
              <SelectTrigger><SelectValue placeholder="Select a corporate account" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="cf-name">Event name</Label><Input id="cf-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Annual Strategy Offsite" /></div>
            <div className="grid gap-1.5"><Label>Date</Label><DatePicker value={form.date} onChange={(v) => set("date", v)} placeholder="Select date" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="cf-att">Attendees</Label><Input id="cf-att" type="number" value={form.attendees} onChange={(e) => set("attendees", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="cf-hall">Hall fee (₦)</Label><Input id="cf-hall" type="number" value={form.hallFee} onChange={(e) => set("hallFee", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="cf-meals">Meals (₦)</Label><Input id="cf-meals" type="number" value={form.mealsAmount} onChange={(e) => set("mealsAmount", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="cf-coffee">Coffee break (₦)</Label><Input id="cf-coffee" type="number" value={form.coffeeAmount} onChange={(e) => set("coffeeAmount", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="cf-rooms">Room allotment (₦)</Label><Input id="cf-rooms" type="number" value={form.roomsAmount} onChange={(e) => set("roomsAmount", e.target.value)} /></div>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-sm font-semibold text-fg"><span>Total</span><span>{formatNaira(total)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Book event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
