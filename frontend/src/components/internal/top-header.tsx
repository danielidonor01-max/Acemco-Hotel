"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Menu, Search, Bell, LogOut, User, Calendar, BedDouble, ClipboardList, Loader2 } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { useAuth } from "@/providers/auth-provider";
import { globalSearch, type SearchResult } from "@/lib/data/search";
import { cn } from "@/lib/utils";

const initialsOf = (name?: string) =>
  (name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const TYPE_ICON = { reservation: Calendar, guest: User, room: BedDouble, order: ClipboardList } as const;

export function TopHeader() {
  const openMobile = useUIStore((s) => s.openMobile);
  const { user, logout, live } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Global search ──
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 10_000,
  });

  function go(r: SearchResult) {
    setOpen(false); setQ("");
    router.push(r.href);
  }

  async function onLogout() {
    setMenuOpen(false);
    await logout();
    if (live) router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-pub-bg/90 px-4 backdrop-blur">
      <button type="button" onClick={openMobile} className="rounded p-1.5 text-fg-soft hover:bg-brand-surface-2 lg:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Search */}
      <div ref={boxRef} className="relative hidden max-w-sm flex-1 sm:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search reservations, guests, rooms, orders…"
          className="h-9 w-full rounded-md border border-line bg-brand-surface pl-9 pr-8 text-sm text-fg placeholder:text-fg-muted focus:border-line-2 focus:outline-none"
        />
        {isFetching && debounced.length >= 2 && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-muted" />}

        {open && debounced.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-line-2 bg-brand-surface py-1 shadow-xl">
            {results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-fg-muted">{isFetching ? "Searching…" : "No matches"}</p>
            ) : (
              results.map((r, i) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <button
                    type="button"
                    key={`${r.type}-${i}`}
                    onClick={() => go(r)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-surface-2"
                  >
                    <span className="text-fg-muted"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{r.title}</span>
                      <span className="block truncate text-xs capitalize text-fg-muted">{r.type} · {r.subtitle}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" className="relative rounded-md p-2 text-fg-soft hover:bg-brand-surface-2" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.5} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-brand-surface-2"
            aria-label="Account menu"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-surface-3 text-xs font-semibold text-fg">
              {initialsOf(user?.name)}
            </span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-line-2 bg-brand-surface-2 py-1 shadow-xl">
                <div className="border-b border-line px-3 py-2">
                  <p className="text-sm font-medium text-fg">{user?.name ?? "—"}</p>
                  <p className="text-xs capitalize text-fg-muted">{(user?.roles ?? []).map((r) => r.replace(/_/g, " ").toLowerCase()).join(", ") || "No role"}</p>
                </div>
                <MenuLink icon={User} label="Profile" href="/manage/administration" onClick={() => setMenuOpen(false)} />
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-fg-soft hover:bg-brand-surface-3 hover:text-fg"
                >
                  <LogOut size={16} strokeWidth={1.5} /> Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ icon: Icon, label, href, onClick }: { icon: typeof User; label: string; href: string; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={cn("flex items-center gap-2.5 px-3 py-2 text-sm text-fg-soft hover:bg-brand-surface-3 hover:text-fg")}>
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </Link>
  );
}
