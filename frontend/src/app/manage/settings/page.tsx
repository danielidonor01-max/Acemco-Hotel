"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/internal/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { site } from "@/lib/cms";
import { hasPermission } from "@/lib/permissions";

export default function SettingsPage() {
  const [form, setForm] = useState({
    hotelName: site.hotelName, tagline: site.tagline, phone: site.phone,
    whatsapp: site.whatsapp, email: site.email, address: site.address, city: site.city,
  });
  const canEdit = hasPermission("settings", "UPDATE");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Settings saved.", { description: "Hotel profile updated (mock — persists to the API later)." });
  }

  return (
    <PageShell title="Settings" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Settings" }]}>
      <form onSubmit={save} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Hotel Profile</CardTitle>
            <CardDescription>Public contact details and the WhatsApp number used for orders and reservations.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hotel name" value={form.hotelName} onChange={(v) => set("hotelName", v)} disabled={!canEdit} />
            <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} disabled={!canEdit} />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} disabled={!canEdit} />
            <Field label="WhatsApp (E.164, no +)" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} disabled={!canEdit} />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} disabled={!canEdit} />
            <Field label="Address" value={form.address} onChange={(v) => set("address", v)} disabled={!canEdit} />
            <div className="sm:col-span-2">
              <Field label="City / Region" value={form.city} onChange={(v) => set("city", v)} disabled={!canEdit} />
            </div>
          </CardContent>
        </Card>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={!canEdit}>Save Changes</Button>
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
