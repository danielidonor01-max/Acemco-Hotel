"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { config, hasApi } from "@/lib/config";
import { setAccessToken, setRefreshHandler, api } from "@/lib/api";

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  /** True when running against a live API (login required). */
  live: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function post(path: string, body?: unknown) {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? "Request failed");
  }
  return json.data;
}

// Offline-demo fallback used only when no API is configured (hasApi() === false).
// With a live API the real user comes from /auth/me. Kept broad so the demo UI is usable.
const DEMO_MODULES = [
  "rooms", "reservations", "reception", "guests", "pos.restaurant", "pos.lounge", "pos.boutique",
  "inventory", "housekeeping", "maintenance", "hr", "payroll", "finance", "reports", "cms", "settings", "administration",
];
const DEMO_ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT"];
const mockAuthUser: AuthUser = {
  name: "Demo Manager",
  roles: ["HOTEL_MANAGER"],
  permissions: DEMO_MODULES.flatMap((m) => DEMO_ACTIONS.map((a) => `${m}:${a}`)),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const live = hasApi();
  // In mock mode the internal platform uses the seeded manager (no login).
  const [user, setUser] = useState<AuthUser | null>(live ? null : mockAuthUser);
  const [ready, setReady] = useState(!live);

  const refresh = useCallback(async (): Promise<string | null> => {
    try {
      const data = (await post("/auth/refresh")) as { accessToken: string };
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    }
  }, []);

  // Restore session on load (live mode).
  useEffect(() => {
    if (!live) return;
    setRefreshHandler(refresh);
    (async () => {
      const token = await refresh();
      if (token) {
        try {
          const me = (await fetch(`${config.apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }).then((r) => r.json())) as { data: AuthUser };
          setUser(me.data);
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
    return () => setRefreshHandler(null);
  }, [live, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = (await post("/auth/login", { email, password })) as { accessToken: string; user: AuthUser };
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try { await post("/auth/logout"); } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  // Token-aware (via api.*): these endpoints require the access token.
  const updateProfile = useCallback(async (name: string) => {
    const updated = await api.patch<AuthUser>("/auth/me", { name });
    setUser(updated);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  }, []);

  const hasPermission = useCallback(
    (module: string, action: string) => (user?.permissions ?? []).includes(`${module}:${action}`),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, ready, live, login, logout, updateProfile, changePassword, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
