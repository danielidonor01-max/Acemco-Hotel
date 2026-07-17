"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, TrendingUp, AlertTriangle, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/internal/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import { useRoomTypes } from "@/lib/data/room-types";
import {
  getRateRules, createRateRule, updateRateRule, deleteRateRule, getQuote,
  describeRule, describeEffect, DAY_LABELS,
  type RateRule, type RateAdjustment,
} from "@/lib/data/pricing";
import { formatNaira, cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function RatesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("rooms", "UPDATE");

  const [editing, setEditing] = useState<RateRule | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: rules = [], isLoading, isError, error } = useQuery({ queryKey: ["rate-rules"], queryFn: getRateRules });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateRateRule(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRateRule(id),
    onSuccess: () => { toast.success("Rule removed."); qc.invalidateQueries({ queryKey: ["rate-rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Rates"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Rates" }]}
      actions={canEdit ? <Button onClick={() => setAdding(true)}><Plus size={14} /> New rule</Button> : undefined}
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rate rules</CardTitle>
            <p className="text-sm text-fg-muted">
              The nightly rate starts at each room type&apos;s base price, then these rules bend it — by season,
              by weekday, or by how full the house is that night. Rules apply in order, top to bottom.
              Whatever they add up to, a rate can never fall below half or rise above three times the base price.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-fg-muted"><Loader2 size={15} className="mr-2 inline animate-spin" />Loading…</p>
            ) : isError ? (
              <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
                <AlertTriangle size={15} /> Couldn&apos;t load rate rules: {(error as Error).message}
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-md border border-line bg-brand-surface-2 px-3 py-8 text-center">
                <TrendingUp size={22} className="mx-auto text-fg-muted" strokeWidth={1.5} />
                <p className="mt-3 font-medium text-fg">No rate rules yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-fg-soft">
                  Every night currently sells at its base price — the same on a full Saturday as a quiet Tuesday.
                  Add a rule to charge more when the house fills up, or less to fill it.
                </p>
                {canEdit && <Button className="mt-4" size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add your first rule</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-muted">
                      <th className="pb-2 pr-3 font-medium">Order</th>
                      <th className="pb-2 pr-3 font-medium">Rule</th>
                      <th className="pb-2 pr-3 font-medium">Applies</th>
                      <th className="pb-2 pr-3 font-medium">When</th>
                      <th className="pb-2 pr-3 font-medium">Effect</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id} className={cn("border-b border-line/60", !r.isActive && "opacity-50")}>
                        <td className="py-2.5 pr-3 tabular-nums text-fg-muted">{r.priority}</td>
                        <td className="py-2.5 pr-3">
                          <span className="font-medium text-fg">{r.name}</span>
                          {!r.isActive && <Badge className="ml-2">Off</Badge>}
                        </td>
                        <td className="py-2.5 pr-3 text-fg-soft">{r.roomType?.name ?? "All room types"}</td>
                        <td className="py-2.5 pr-3 text-xs text-fg-soft">{describeRule(r)}</td>
                        <td className="py-2.5 pr-3">
                          <span className={cn("font-medium tabular-nums", Number(r.value) < 0 ? "text-info" : "text-fg")}>
                            {describeEffect(r)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          {canEdit && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: r.id, isActive: !r.isActive })}>
                                {r.isActive ? "Turn off" : "Turn on"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
                              <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
                                <Trash2 size={13} />
                              </Button>
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

        <QuotePreview />
      </div>

      {(adding || editing) && (
        <RuleDialog
          rule={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["rate-rules"] }); setAdding(false); setEditing(null); }}
        />
      )}
    </PageShell>
  );
}

/** Try a stay against the live rules before a guest ever sees the price. */
function QuotePreview() {
  const { roomTypes } = useRoomTypes();
  const [q, setQ] = useState({ roomTypeId: "", checkIn: today(), checkOut: plusDays(3) });
  const roomTypeId = q.roomTypeId || roomTypes[0]?.id || "";

  const { data: quote, isFetching } = useQuery({
    queryKey: ["rate-quote", roomTypeId, q.checkIn, q.checkOut],
    queryFn: () => getQuote(roomTypeId, q.checkIn, q.checkOut),
    enabled: Boolean(roomTypeId && q.checkIn && q.checkOut && new Date(q.checkOut) > new Date(q.checkIn)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>What would a stay cost?</CardTitle>
        <p className="text-sm text-fg-muted">
          Check a stay against the rules as they stand — this is the exact price a booking would be charged.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Room type</Label>
            <Select value={roomTypeId} onValueChange={(v) => setQ((p) => ({ ...p, roomTypeId: v }))}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Room type" /></SelectTrigger>
              <SelectContent>
                {roomTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="q-in">Check-in</Label>
            <Input id="q-in" type="date" value={q.checkIn} onChange={(e) => setQ((p) => ({ ...p, checkIn: e.target.value }))} className="w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="q-out">Check-out</Label>
            <Input id="q-out" type="date" value={q.checkOut} min={q.checkIn} onChange={(e) => setQ((p) => ({ ...p, checkOut: e.target.value }))} className="w-40" />
          </div>
          {isFetching && <Loader2 size={15} className="mb-2.5 animate-spin text-fg-muted" />}
        </div>

        {quote && quote.nights > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-muted">
                    <th className="pb-2 pr-3 font-medium">Night</th>
                    <th className="pb-2 pr-3 font-medium">Base</th>
                    <th className="pb-2 pr-3 font-medium">How full</th>
                    <th className="pb-2 pr-3 font-medium">Rules applied</th>
                    <th className="pb-2 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.breakdown.map((n) => (
                    <tr key={n.date} className="border-b border-line/60">
                      <td className="py-2 pr-3 whitespace-nowrap text-fg">
                        {new Date(n.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-fg-muted">{formatNaira(n.base)}</td>
                      <td className="py-2 pr-3 tabular-nums text-fg-soft">{n.occupancy}%</td>
                      <td className="py-2 pr-3 text-xs text-fg-soft">
                        {n.applied.length === 0 ? "—" : n.applied.map((a) => `${a.name} (${a.adjustment === "PERCENT" ? `${a.value}%` : formatNaira(a.value)})`).join(" → ")}
                        {n.clamped && (
                          <Badge tone="warning" className="ml-2">
                            Capped at {n.clamped === "CEILING" ? "3×" : "½"} base
                          </Badge>
                        )}
                      </td>
                      <td className={cn("py-2 text-right font-medium tabular-nums", n.rate !== n.base ? "text-brand-primary-dark" : "text-fg")}>
                        {formatNaira(n.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm text-fg-muted">{quote.nights} night{quote.nights === 1 ? "" : "s"} · average {formatNaira(quote.averageRate)}</span>
              <span className="text-lg font-semibold text-fg">{formatNaira(quote.total)}</span>
            </div>
            <p className="text-xs text-fg-muted">Rates shown exclude VAT, which is added at billing.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const ADJUSTMENTS: { v: RateAdjustment; label: string; hint: string }[] = [
  { v: "PERCENT", label: "Percentage", hint: "e.g. 15 = +15%, −10 = 10% off" },
  { v: "AMOUNT", label: "Fixed amount", hint: "e.g. 5000 = +₦5,000 a night" },
  { v: "FIXED", label: "Set the rate", hint: "This night costs exactly this" },
];

function RuleDialog({ rule, onClose, onSaved }: { rule: RateRule | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = Boolean(rule);
  const { roomTypes } = useRoomTypes();
  const [f, setF] = useState({
    name: rule?.name ?? "",
    roomTypeId: rule?.roomTypeId ?? "",
    startDate: rule?.startDate?.slice(0, 10) ?? "",
    endDate: rule?.endDate?.slice(0, 10) ?? "",
    daysOfWeek: rule?.daysOfWeek ?? [],
    minOccupancy: rule?.minOccupancy?.toString() ?? "",
    maxOccupancy: rule?.maxOccupancy?.toString() ?? "",
    adjustment: (rule?.adjustment ?? "PERCENT") as RateAdjustment,
    value: rule ? String(Number(rule.value)) : "",
    priority: rule?.priority?.toString() ?? "0",
  });

  const save = useMutation({
    mutationFn: () => {
      const dto = {
        name: f.name.trim(),
        roomTypeId: f.roomTypeId || null,
        startDate: f.startDate || null,
        endDate: f.endDate || null,
        daysOfWeek: f.daysOfWeek,
        minOccupancy: f.minOccupancy === "" ? null : Number(f.minOccupancy),
        maxOccupancy: f.maxOccupancy === "" ? null : Number(f.maxOccupancy),
        adjustment: f.adjustment,
        value: Number(f.value),
        priority: Number(f.priority) || 0,
      };
      return isEdit ? updateRateRule(rule!.id, dto) : createRateRule(dto);
    },
    onSuccess: () => { toast.success(isEdit ? "Rule updated." : "Rule added."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDay = (d: number) =>
    setF((p) => ({ ...p, daysOfWeek: p.daysOfWeek.includes(d) ? p.daysOfWeek.filter((x) => x !== d) : [...p.daysOfWeek, d].sort() }));

  const valid = f.name.trim() && f.value !== "" && !Number.isNaN(Number(f.value)) && (f.adjustment !== "FIXED" || Number(f.value) > 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit rate rule" : "New rate rule"}</DialogTitle>
          <DialogDescription>Leave a condition blank to ignore it. A rule with no conditions applies every night.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_110px]">
            <div className="grid gap-1.5">
              <Label htmlFor="r-name">Name</Label>
              <Input id="r-name" placeholder="Weekend uplift" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Room type</Label>
              <Select value={f.roomTypeId || "all"} onValueChange={(v) => setF((p) => ({ ...p, roomTypeId: v === "all" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All room types</SelectItem>
                  {roomTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-pri">Order</Label>
              <Input id="r-pri" type="number" value={f.priority} onChange={(e) => setF((p) => ({ ...p, priority: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-md border border-line p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-muted">When does it apply?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="r-from">Season starts</Label>
                <Input id="r-from" type="date" value={f.startDate} onChange={(e) => setF((p) => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="r-to">Season ends</Label>
                <Input id="r-to" type="date" value={f.endDate} min={f.startDate || undefined} onChange={(e) => setF((p) => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 grid gap-1.5">
              <Label>Days of the week</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      f.daysOfWeek.includes(i) ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark" : "border-line-2 text-fg-soft hover:text-fg",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs text-fg-muted">None selected = every day.</p>
            </div>
          </div>

          <div className="rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-primary-dark">Follow demand</p>
            <p className="mb-3 text-xs text-fg-soft">
              Only apply when the house is this full for that night — this is what makes the rate move with traffic.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="r-min">Only when at least (%)</Label>
                <Input id="r-min" type="number" min="0" max="100" placeholder="e.g. 70" value={f.minOccupancy} onChange={(e) => setF((p) => ({ ...p, minOccupancy: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="r-max">Only when at most (%)</Label>
                <Input id="r-max" type="number" min="0" max="100" placeholder="e.g. 30" value={f.maxOccupancy} onChange={(e) => setF((p) => ({ ...p, maxOccupancy: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div className="grid gap-1.5">
              <Label>What does it do?</Label>
              <div className="flex gap-2">
                {ADJUSTMENTS.map((a) => (
                  <button
                    key={a.v}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, adjustment: a.v }))}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-2 text-left transition-colors",
                      f.adjustment === a.v ? "border-brand-primary bg-brand-primary/10" : "border-line-2 hover:border-line",
                    )}
                  >
                    <span className="block text-sm font-medium text-fg">{a.label}</span>
                    <span className="block text-[11px] leading-tight text-fg-muted">{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-val">Value</Label>
              <Input id="r-val" type="number" step="0.01" placeholder="15" value={f.value} onChange={(e) => setF((p) => ({ ...p, value: e.target.value }))} />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-fg-muted">
            <Calculator size={13} className="mt-0.5 shrink-0" />
            Whatever the rules add up to, a night can never be sold below half or above three times its base price.
          </p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            {isEdit ? "Save changes" : "Add rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
