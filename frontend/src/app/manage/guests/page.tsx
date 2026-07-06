"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Star, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, EmptyState } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { listGuests, createGuest, type Guest } from "@/lib/data/guests";
import { useAuth } from "@/providers/auth-provider";

export default function GuestsPage() {
  const { hasPermission } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data: guests = [], isLoading } = useQuery({ queryKey: ["guests"], queryFn: listGuests });

  const columns: Column<Guest>[] = [
    {
      key: "name", header: "Guest", sortValue: (g) => g.name,
      render: (g) => (
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {g.name}
          {g.isVip && <Star size={14} className="text-primary" fill="currentColor" />}
          {g.isBlacklisted && <Ban size={14} className="text-danger" />}
        </span>
      ),
    },
    { key: "phone", header: "Phone", render: (g) => <span className="text-muted-foreground">{g.phone}</span> },
    { key: "email", header: "Email", render: (g) => <span className="text-muted-foreground">{g.email ?? "—"}</span> },
    { key: "nationality", header: "Nationality", align: "center" },
    { key: "stays", header: "Stays", align: "center", sortValue: (g) => g.stays },
    {
      key: "status", header: "Status",
      render: (g) =>
        g.isBlacklisted ? <Badge tone="danger">Blacklisted</Badge> : g.isVip ? <Badge tone="brand">VIP</Badge> : <Badge tone="neutral">Standard</Badge>,
    },
  ];

  return (
    <PageShell
      title="Guests"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Guests" }]}
      actions={hasPermission("guests", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Guest</Button>}
    >
      <DataTable
        columns={columns}
        data={guests}
        isLoading={isLoading}
        emptyState={<EmptyState icon={Users} title="No guests yet" />}
      />
      {creating && <GuestDialog onClose={() => setCreating(false)} />}
    </PageShell>
  );
}

function GuestDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", nationality: "", isVip: false });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => createGuest({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      nationality: form.nationality.trim() || undefined,
      isVip: form.isVip,
    }),
    onSuccess: () => { toast.success("Guest added."); qc.invalidateQueries({ queryKey: ["guests"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.firstName.trim() && form.lastName.trim() && form.phone.trim().length >= 3 && !save.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Guest</DialogTitle>
          <DialogDescription>Add a guest profile to the directory.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="g-first">First name</Label>
              <Input id="g-first" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-last">Last name</Label>
              <Input id="g-last" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-phone">Phone</Label>
            <Input id="g-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-nat">Nationality</Label>
              <Input id="g-nat" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. NG" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox checked={form.isVip} onCheckedChange={(v) => set("isVip", !!v)} /> Mark as VIP
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Add guest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
