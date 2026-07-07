"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Star, Ban, Loader2, Award, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Button, Badge, EmptyState, Card } from "@/components/internal/ui";
import { DataTable, type Column } from "@/components/internal/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listGuests, createGuest, getGuestProfile, setGuestTier, setGuestBlacklist,
  type Guest, type GuestTier,
} from "@/lib/data/guests";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira, cn } from "@/lib/utils";

const TIERS: GuestTier[] = ["STANDARD", "PREFERRED", "VIP"];
const tierTone = (t: GuestTier): "brand" | "info" | "neutral" => (t === "VIP" ? "brand" : t === "PREFERRED" ? "info" : "neutral");

type Filter = "ALL" | "IN_HOUSE" | "PAST" | "CORPORATE" | "VIP" | "FREQUENT" | "BLACKLIST";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "IN_HOUSE", label: "In-house" },
  { key: "PAST", label: "Past" },
  { key: "CORPORATE", label: "Corporate" },
  { key: "VIP", label: "VIP" },
  { key: "FREQUENT", label: "Frequent" },
  { key: "BLACKLIST", label: "Blacklist" },
];

export default function GuestsPage() {
  const { hasPermission } = useAuth();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Guest | null>(null);
  const { data: guests = [], isLoading } = useQuery({ queryKey: ["guests"], queryFn: listGuests });

  const filtered = useMemo(() => guests.filter((g) => {
    switch (filter) {
      case "IN_HOUSE": return g.inHouse;
      case "PAST": return g.past && !g.inHouse;
      case "CORPORATE": return g.isCorporate;
      case "VIP": return g.tier === "VIP";
      case "FREQUENT": return g.frequent;
      case "BLACKLIST": return g.isBlacklisted;
      default: return true;
    }
  }), [guests, filter]);

  const count = (f: Filter) => guests.filter((g) =>
    f === "IN_HOUSE" ? g.inHouse : f === "PAST" ? g.past && !g.inHouse : f === "CORPORATE" ? g.isCorporate :
    f === "VIP" ? g.tier === "VIP" : f === "FREQUENT" ? g.frequent : f === "BLACKLIST" ? g.isBlacklisted : true).length;

  const columns: Column<Guest>[] = [
    {
      key: "name", header: "Guest", sortValue: (g) => g.name,
      render: (g) => (
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {g.name}
          {g.tier === "VIP" && <Star size={14} className="text-primary" fill="currentColor" />}
          {g.isBlacklisted && <Ban size={14} className="text-danger" />}
        </span>
      ),
    },
    { key: "tier", header: "Tier", render: (g) => <Badge tone={tierTone(g.tier)}>{g.tier.toLowerCase()}</Badge> },
    { key: "phone", header: "Phone", render: (g) => <span className="text-muted-foreground">{g.phone}</span> },
    { key: "nationality", header: "Nat.", align: "center" },
    { key: "stays", header: "Stays", align: "center", sortValue: (g) => g.stays },
    {
      key: "status", header: "Status",
      render: (g) => g.inHouse ? <Badge tone="success">In-house</Badge> : g.past ? <Badge tone="neutral">Past</Badge> : g.isCorporate ? <Badge tone="info">Corporate</Badge> : <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <PageShell
      title="Guests"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Guests" }]}
      actions={hasPermission("guests", "CREATE") && <Button onClick={() => setCreating(true)}><Plus size={16} /> New Guest</Button>}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              filter === f.key ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark" : "border-line-2 text-fg-soft hover:text-fg",
            )}
          >
            {f.label} <span className="text-fg-muted">{f.key === "ALL" ? guests.length : count(f.key)}</span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        onRowClick={(g) => setSelected(g)}
        emptyState={<EmptyState icon={Users} title="No guests" />}
      />
      {creating && <GuestDialog onClose={() => setCreating(false)} />}
      {selected && <ProfileModal guest={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

function ProfileModal({ guest, onClose }: { guest: Guest; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasPermission("guests", "UPDATE");
  const { data, isLoading } = useQuery({ queryKey: ["guest-profile", guest.id], queryFn: () => getGuestProfile(guest.id) });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["guest-profile", guest.id] }); qc.invalidateQueries({ queryKey: ["guests"] }); };
  const tier = useMutation({ mutationFn: (t: GuestTier) => setGuestTier(guest.id, t), onSuccess: () => { toast.success("Tier updated."); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const black = useMutation({ mutationFn: (b: boolean) => setGuestBlacklist(guest.id, b), onSuccess: () => { toast.success("Guest updated."); invalidate(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {guest.name}
            {data && <Badge tone={tierTone(data.guest.tier)}>{data.guest.tier.toLowerCase()}</Badge>}
          </DialogTitle>
          <DialogDescription>{guest.phone}{data?.guest.email ? ` · ${data.guest.email}` : ""}</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="py-8 text-center text-sm text-fg-muted">Loading profile…</p>
        ) : (
          <div className="space-y-5">
            {data.vipRecommended && (
              <div className="flex items-center gap-2 rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-sm text-brand-primary-dark">
                <Award size={16} /> Qualifies for VIP consideration (loyalty score {data.loyaltyScore}). Management decides.
              </div>
            )}

            {/* Intelligence stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Loyalty score" value={`${data.loyaltyScore}/100`} icon={TrendingUp} />
              <Stat label="Total stays" value={String(data.stats.totalStays)} />
              <Stat label="Nights" value={String(data.stats.totalNights)} />
              <Stat label="Lifetime spend" value={formatNaira(data.stats.lifetimeSpend)} />
              <Stat label="Favourite room" value={data.stats.favouriteRoomType ?? "—"} />
              <Stat label="Avg lead time" value={`${data.stats.avgLeadTime}d`} />
            </div>

            {data.companies.length > 0 && (
              <p className="text-sm text-fg-soft">Corporate: {data.companies.map((c) => <Badge key={c} tone="info" className="ml-1">{c}</Badge>)}</p>
            )}

            {data.spendByDepartment.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Spend by area</p>
                <div className="flex flex-wrap gap-2">
                  {data.spendByDepartment.map((d) => (
                    <span key={d.department} className="rounded-full border border-line px-3 py-1 text-xs text-fg-soft capitalize">{d.department.toLowerCase()} · {formatNaira(d.amount)}</span>
                  ))}
                </div>
              </div>
            )}

            {data.favouriteItems.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Favourite meals &amp; drinks</p>
                <div className="flex flex-wrap gap-2">
                  {data.favouriteItems.map((it) => (
                    <span key={it.name} className="rounded-full border border-line px-3 py-1 text-xs text-fg-soft">{it.name} <span className="text-fg-muted">×{it.count}</span></span>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Stay history</p>
              {data.history.length === 0 ? <p className="text-sm text-fg-muted">No stays yet.</p> : (
                <ul className="rounded-lg border border-line divide-y divide-line">
                  {data.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-fg">{h.reservationNumber} · {h.roomType ?? "—"}{h.room ? ` (Rm ${h.room})` : ""}</p>
                        <p className="text-xs text-fg-muted">{h.checkInDate.slice(0, 10)} → {h.checkOutDate.slice(0, 10)}{h.company ? ` · ${h.company}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-fg">{formatNaira(h.totalAmount)}</p>
                        <Badge tone="neutral">{h.status.replace(/_/g, " ").toLowerCase()}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tier / blacklist controls */}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-4 border-t border-line pt-4">
                <div className="grid gap-1.5">
                  <Label>Tier (relationship)</Label>
                  <Select value={data.guest.tier} onValueChange={(v) => tier.mutate(v as GuestTier)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.toLowerCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-fg">
                  <Checkbox checked={data.guest.isBlacklisted} onCheckedChange={(v) => black.mutate(!!v)} /> Blacklisted
                </label>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Award }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1 text-xs text-fg-muted">{Icon && <Icon size={12} />} {label}</p>
      <p className="mt-0.5 text-sm font-semibold text-fg">{value}</p>
    </Card>
  );
}

function GuestDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", nationality: "", isVip: false });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => createGuest({
      firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(),
      email: form.email.trim() || undefined, nationality: form.nationality.trim() || undefined, isVip: form.isVip,
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
            <div className="grid gap-1.5"><Label htmlFor="g-first">First name</Label><Input id="g-first" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="g-last">Last name</Label><Input id="g-last" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="g-phone">Phone</Label><Input id="g-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="g-email">Email</Label><Input id="g-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="g-nat">Nationality</Label><Input id="g-nat" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. NG" /></div>
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
