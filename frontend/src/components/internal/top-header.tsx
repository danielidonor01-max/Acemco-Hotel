"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, Bell, LogOut, User, Sun } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { currentUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function TopHeader() {
  const openMobile = useUIStore((s) => s.openMobile);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-brand-deep/95 px-4 backdrop-blur">
      <button onClick={openMobile} className="rounded p-1.5 text-fg-soft hover:bg-brand-surface-2 lg:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="relative hidden max-w-sm flex-1 sm:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          type="search"
          placeholder="Search reservations, guests, rooms…"
          className="h-9 w-full rounded-md border border-line bg-brand-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-line-2 focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button className="relative rounded-md p-2 text-fg-soft hover:bg-brand-surface-2" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.5} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-brand-surface-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-surface-3 text-xs font-semibold text-fg">
              {currentUser.initials}
            </span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-line-2 bg-brand-surface-2 py-1 shadow-xl">
                <div className="border-b border-line px-3 py-2">
                  <p className="text-sm font-medium text-fg">{currentUser.name}</p>
                  <p className="text-xs text-fg-muted">{currentUser.role.replace(/_/g, " ")}</p>
                </div>
                <MenuLink icon={User} label="Profile" href="#" />
                <MenuLink icon={Sun} label="Light mode" href="#" />
                <MenuLink icon={LogOut} label="Log out" href="/" />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ icon: Icon, label, href }: { icon: typeof User; label: string; href: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 px-3 py-2 text-sm text-fg-soft hover:bg-brand-surface-3 hover:text-fg")}>
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </Link>
  );
}
