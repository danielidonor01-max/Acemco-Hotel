"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/internal/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSettings, updateSettings, getNightAuditStatus, getDailyCloses, closeDay, type HotelSettings, type SettingsInput } from "@/lib/data/settings";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

const BLANK: HotelSettings = {
  hotelName: "", tagline: "", phone: "", whatsapp: "", email: "", address: "", city: "",
  rateFloorMultiplier: 0.5, rateCeilingMultiplier: 3,
  cancellationFreeUntilHours: 48, cancellationLateFeePercent: 50, noShowFeePercent: 100, depositRefundable: true,
  nightAuditHour: 3, nightAuditEnabled: true, autoMarkNoShows: true, timezone: "Africa/Lagos",
};

// The audit day is measured in one of these zones. Nigeria is Africa/Lagos.
const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Johannesburg", "Europe/London", "UTC"];

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasPermission("settings", "UPDATE");
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState<HotelSettings>(BLANK);

  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = <K extends keyof HotelSettings>(k: K, v: HotelSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      // Send numbers as numbers — the API validates ranges and rejects a ceiling
      // below the floor, so a typo can't leave pricing unguarded.
      const dto: SettingsInput = {
        hotelName: form.hotelName, tagline: form.tagline, phone: form.phone, whatsapp: form.whatsapp,
        email: form.email, address: form.address, city: form.city,
        rateFloorMultiplier: Number(form.rateFloorMultiplier),
        rateCeilingMultiplier: Number(form.rateCeilingMultiplier),
        cancellationFreeUntilHours: Number(form.cancellationFreeUntilHours),
        cancellationLateFeePercent: Number(form.cancellationLateFeePercent),
        noShowFeePercent: Number(form.noShowFeePercent),
        depositRefundable: form.depositRefundable,
        nightAuditHour: Number(form.nightAuditHour),
        nightAuditEnabled: form.nightAuditEnabled,
        autoMarkNoShows: form.autoMarkNoShows,
        timezone: form.timezone,
      };
      return updateSettings(dto);
    },
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["settings"] });
      // Rates, quotes and the night-audit status read these — refresh them.
      qc.invalidateQueries({ queryKey: ["rate-quote"] });
      qc.invalidateQueries({ queryKey: ["night-audit-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = !canEdit || isLoading;
  const base = 65000; // illustrative only — shows what the bounds mean in naira
  const floorEx = Math.round(base * Number(form.rateFloorMultiplier || 0));
  const ceilEx = Math.round(base * Number(form.rateCeilingMultiplier || 0));

  return (
    <PageShell title="Settings" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Settings" }]}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="max-w-2xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Hotel Profile</CardTitle>
            <CardDescription>
              The single source of truth for your contact details — the website reads these, and bookings route to this WhatsApp number.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hotel name" value={form.hotelName} onChange={(v) => set("hotelName", v)} disabled={disabled} />
            <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} disabled={disabled} />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} disabled={disabled} />
            <Field label="WhatsApp (no +, e.g. 2348077125775)" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} disabled={disabled} />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} disabled={disabled} />
            <Field label="Address" value={form.address} onChange={(v) => set("address", v)} disabled={disabled} />
            <div className="sm:col-span-2">
              <Field label="City / Region" value={form.city} onChange={(v) => set("city", v)} disabled={disabled} />
            </div>
            <p className="sm:col-span-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info size={13} className="mt-0.5 shrink-0" />
              Leave a field blank and the website hides that link rather than showing a dead one.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancellation policy</CardTitle>
            <CardDescription>
              What a guest is charged when they cancel or don&apos;t arrive. These terms are applied automatically and are
              published on your Terms page, so the site always states what the system actually charges.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Free cancellation until (hours before check-in)"
              value={form.cancellationFreeUntilHours}
              onChange={(v) => set("cancellationFreeUntilHours", Number(v))}
              disabled={disabled}
              hint="Cancel earlier than this and there's no fee."
            />
            <NumField
              label="Late cancellation fee (% of booking)"
              value={form.cancellationLateFeePercent}
              onChange={(v) => set("cancellationLateFeePercent", v)}
              disabled={disabled}
              hint="Charged when cancelling inside the window."
            />
            <NumField
              label="No-show fee (% of booking)"
              value={form.noShowFeePercent}
              onChange={(v) => set("noShowFeePercent", v)}
              disabled={disabled}
              hint="A no-show is never free — the room was held all night."
            />
            <div className="space-y-1.5">
              <Label>Deposits</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3">
                <input
                  type="checkbox"
                  checked={form.depositRefundable}
                  disabled={disabled}
                  onChange={(e) => set("depositRefundable", e.target.checked)}
                  className="h-4 w-4 accent-brand-primary"
                />
                <span className="text-sm text-fg">Refundable on a free cancellation</span>
              </label>
              <p className="text-xs text-muted-foreground">
                {form.depositRefundable
                  ? "A deposit comes back if the guest cancels in time."
                  : "Deposits are kept whatever the timing — say so plainly in your Terms."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate limits</CardTitle>
            <CardDescription>
              Hard bounds on what your rate rules may do, as a multiple of each room&apos;s base price. Whatever the rules
              stack up to, a night can never be sold outside these — so a mis-keyed rule can&apos;t quote an absurd price.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Never below (× base price)"
              value={form.rateFloorMultiplier}
              onChange={(v) => set("rateFloorMultiplier", v)}
              disabled={disabled}
              step="0.05"
              hint={`e.g. ${formatNaira(base)} room → never under ${formatNaira(floorEx)}`}
            />
            <NumField
              label="Never above (× base price)"
              value={form.rateCeilingMultiplier}
              onChange={(v) => set("rateCeilingMultiplier", v)}
              disabled={disabled}
              step="0.05"
              hint={`e.g. ${formatNaira(base)} room → never over ${formatNaira(ceilEx)}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Night audit (end-of-day close)</CardTitle>
            <CardDescription>
              Each night the system closes the day just gone: it freezes that day&apos;s occupancy, ADR and revenue
              so the numbers can&apos;t drift afterwards, and marks any guest who never arrived as a no-show.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Close at (hour, 0–23)"
              value={form.nightAuditHour}
              onChange={(v) => set("nightAuditHour", Math.max(0, Math.min(23, Math.round(v))))}
              disabled={disabled}
              hint="A quiet hour — most hotels use 3am."
            />
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <select
                value={form.timezone}
                disabled={disabled}
                onChange={(e) => set("timezone", e.target.value)}
                className="h-9 w-full rounded-md border border-line bg-brand-surface px-3 text-sm text-fg disabled:opacity-60"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">The day is measured in this zone, not the server&apos;s.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.nightAuditEnabled} disabled={disabled} onChange={(e) => set("nightAuditEnabled", e.target.checked)} className="h-4 w-4 accent-brand-primary" />
              <span className="text-sm text-fg">Close the day automatically</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.autoMarkNoShows} disabled={disabled} onChange={(e) => set("autoMarkNoShows", e.target.checked)} className="h-4 w-4 accent-brand-primary" />
              <span className="text-sm text-fg">Mark un-arrived bookings as no-shows</span>
            </label>
            <p className="sm:col-span-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info size={13} className="mt-0.5 shrink-0" />
              Marking a no-show applies your cancellation policy&apos;s no-show fee. Turn that off above if you&apos;d rather review arrivals by hand.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canEdit || save.isPending || isLoading}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Save Changes
          </Button>
        </div>
        {!canEdit && <p className="text-right text-sm text-muted-foreground">You have view-only access to settings.</p>}
      </form>

      <div className="mt-6 max-w-2xl">
        <NightAuditStatusCard canClose={hasPermission("reports", "EXPORT")} />
      </div>
    </PageShell>
  );
}

/** Live audit status + manual close + the frozen daily history. */
function NightAuditStatusCard({ canClose }: { canClose: boolean }) {
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["night-audit-status"], queryFn: getNightAuditStatus });
  const { data: history = [] } = useQuery({ queryKey: ["daily-closes"], queryFn: () => getDailyCloses(30) });
  const [manualDate, setManualDate] = useState("");

  const runClose = useMutation({
    mutationFn: (date: string) => closeDay(date),
    onSuccess: (c) => {
      toast.success(`Closed ${c.businessDate}.`);
      qc.invalidateQueries({ queryKey: ["daily-closes"] });
      qc.invalidateQueries({ queryKey: ["night-audit-status"] });
      setManualDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const num = (v: string | number) => Number(v);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily close history</CardTitle>
        <CardDescription>
          {status
            ? `Hotel time ${status.localTime} · closing at ${String(status.hour).padStart(2, "0")}:00 ${status.timezone}` +
              (status.enabled ? "" : " · automatic close is OFF") +
              (status.closedToday ? " · today already closed" : "")
            : "Loading…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canClose && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-brand-surface-2 p-3">
            <div className="space-y-1.5">
              <Label>Close a day manually</Label>
              <Input type="date" value={manualDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setManualDate(e.target.value)} className="w-44" />
            </div>
            <Button variant="secondary" size="sm" disabled={!manualDate || runClose.isPending} onClick={() => runClose.mutate(manualDate)}>
              {runClose.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Close day
            </Button>
            <p className="text-xs text-muted-foreground">For a missed night. A day can only be closed once.</p>
          </div>
        )}

        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No days closed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 text-right font-medium">Occ.</th>
                  <th className="pb-2 pr-3 text-right font-medium">ADR</th>
                  <th className="pb-2 pr-3 text-right font-medium">RevPAR</th>
                  <th className="pb-2 pr-3 text-right font-medium">Revenue</th>
                  <th className="pb-2 pr-3 text-right font-medium">Tax</th>
                  <th className="pb-2 text-right font-medium">No-shows</th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 whitespace-nowrap text-fg">
                      {new Date(c.businessDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{num(c.occupancyRate)}%</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{formatNaira(num(c.adr))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{formatNaira(num(c.revpar))}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-fg">{formatNaira(num(c.totalRevenue))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-soft">{formatNaira(num(c.taxCollected))}</td>
                    <td className="py-2 text-right tabular-nums text-fg-muted">{c.noShowsMarked || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumField({
  label, value, onChange, disabled, hint, step,
}: {
  label: string; value: string | number; onChange: (v: number) => void;
  disabled?: boolean; hint?: string; step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step={step ?? "1"}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
