"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { config, hasApi } from "@/lib/config";
import { setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("super@acemcohotel.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Mock mode (no API configured) — no login required.
    if (!hasApi()) {
      router.push("/manage/dashboard");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? "Invalid email or password.");
      // Prime the in-memory access token; the refresh cookie bootstraps the provider on /manage.
      if (json.data?.accessToken) setAccessToken(json.data.accessToken);
      router.push("/manage/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="internal-theme flex min-h-screen items-center justify-center bg-pub-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary font-display text-2xl font-bold text-brand-deep">
            A
          </div>
          <h1 className="font-display text-2xl font-semibold text-fg">Acemco Express</h1>
          <p className="text-sm text-fg-muted">Operations Platform</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-brand-surface p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Sign in
          </Button>
          {!hasApi() && (
            <p className="text-center text-xs text-fg-muted">
              Demo mode — no backend configured. Sign in proceeds with the seeded manager.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
