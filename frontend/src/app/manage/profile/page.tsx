"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, User, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/internal/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";

export default function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const setPwField = (k: keyof typeof pw, v: string) => setPw((p) => ({ ...p, [k]: v }));

  const saveName = useMutation({
    mutationFn: () => updateProfile(name.trim()),
    onSuccess: () => toast.success("Profile updated."),
    onError: (e: Error) => toast.error(e.message),
  });

  const savePassword = useMutation({
    mutationFn: () => changePassword(pw.current, pw.next),
    onSuccess: () => { toast.success("Password changed."); setPw({ current: "", next: "", confirm: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameDirty = name.trim().length > 0 && name.trim() !== (user?.name ?? "");
  const pwValid = pw.current.length > 0 && pw.next.length >= 8 && pw.next === pw.confirm;

  return (
    <PageShell title="My Profile" breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Profile" }]}>
      <div className="grid max-w-2xl gap-6">
        {/* Account */}
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-surface-3 text-lg font-semibold text-fg">
                {(user?.name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{user?.email ?? "—"}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(user?.roles ?? []).map((r) => (
                    <Badge key={r} tone="brand"><ShieldCheck size={11} /> {r.replace(/_/g, " ").toLowerCase()}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-name">Display name</Label>
              <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button disabled={!nameDirty || saveName.isPending} onClick={() => saveName.mutate()}>
                {saveName.isPending ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />} Save name
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-cur">Current password</Label>
              <Input id="pf-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPwField("current", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pf-new">New password</Label>
                <Input id="pf-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPwField("next", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pf-conf">Confirm new password</Label>
                <Input id="pf-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPwField("confirm", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-fg-muted">
              {pw.next.length > 0 && pw.next.length < 8
                ? "New password must be at least 8 characters."
                : pw.confirm.length > 0 && pw.next !== pw.confirm
                ? "Passwords don't match."
                : "At least 8 characters."}
            </p>
            <div className="flex justify-end">
              <Button disabled={!pwValid || savePassword.isPending} onClick={() => savePassword.mutate()}>
                {savePassword.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Change password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
