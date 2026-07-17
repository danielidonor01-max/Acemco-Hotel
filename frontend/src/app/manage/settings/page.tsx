"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/internal/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSettings, updateSettings, type HotelSettings, type SettingsInput } from "@/lib/data/settings";
import { useAuth } from "@/providers/auth-provider";
import { formatNaira } from "@/lib/utils";

const BLANK: HotelSettings = {
  hotelName: "", tagline: "", phone: "", whatsapp: "", email: "", address: "", city: "",
  rateFloorMultiplier: 0.5, rateCeilingMultiplier: 3,
  cancellationFreeUntilHours: 48, cancellationLateFeePercent: 50, noShowFeePercent: 100, depositRefundable: true,
};

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
      };
      return updateSettings(dto);
    },
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["settings"] });
      // Rates and quotes read these — refresh anything showing a price.
      qc.invalidateQueries({ queryKey: ["rate-quote"] });
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

        <div className="flex justify-end">
          <Button type="submit" disabled={!canEdit || save.isPending || isLoading}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Save Changes
          </Button>
        </div>
        {!canEdit && <p className="text-right text-sm text-muted-foreground">You have view-only access to settings.</p>}
      </form>
    </PageShell>
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
