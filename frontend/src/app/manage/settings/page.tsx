"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/internal/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSettings, updateSettings, type HotelSettings } from "@/lib/data/settings";
import { useAuth } from "@/providers/auth-provider";

const BLANK: HotelSettings = { hotelName: "", tagline: "", phone: "", whatsapp: "", email: "", address: "", city: "" };

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasPermission("settings", "UPDATE");
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState<HotelSettings>(BLANK);

  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = <K extends keyof HotelSettings>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => updateSettings(form),
    onSuccess: () => { toast.success("Settings saved."); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell title="Settings" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Settings" }]}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Hotel Profile</CardTitle>
            <CardDescription>Public contact details and the WhatsApp number used for orders and reservations.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hotel name" value={form.hotelName} onChange={(v) => set("hotelName", v)} disabled={!canEdit || isLoading} />
            <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} disabled={!canEdit || isLoading} />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} disabled={!canEdit || isLoading} />
            <Field label="WhatsApp (E.164, no +)" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} disabled={!canEdit || isLoading} />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} disabled={!canEdit || isLoading} />
            <Field label="Address" value={form.address} onChange={(v) => set("address", v)} disabled={!canEdit || isLoading} />
            <div className="sm:col-span-2">
              <Field label="City / Region" value={form.city} onChange={(v) => set("city", v)} disabled={!canEdit || isLoading} />
            </div>
          </CardContent>
        </Card>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={!canEdit || save.isPending || isLoading}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Save Changes
          </Button>
        </div>
        {!canEdit && <p className="mt-2 text-right text-sm text-muted-foreground">You have view-only access to settings.</p>}
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
