"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";
import { useUIStore } from "@/stores/ui.store";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export function InternalShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUIStore((s) => s.collapsed);
  const { live, ready, user } = useAuth();
  const router = useRouter();

  // Live mode: require a session. Mock mode: always ready with the seeded manager.
  useEffect(() => {
    if (live && ready && !user) router.replace("/login");
  }, [live, ready, user, router]);

  if (live && (!ready || !user)) {
    return (
      <div className="internal-theme dark flex min-h-screen items-center justify-center bg-brand-deep text-fg-soft">
        <Loader2 className="size-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="dark internal-theme min-h-screen">
      <Sidebar />
      <div className={cn("transition-[margin] duration-200", collapsed ? "lg:ml-16" : "lg:ml-60")}>
        <TopHeader />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
