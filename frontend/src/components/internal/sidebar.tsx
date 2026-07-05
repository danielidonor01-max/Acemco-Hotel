"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, Users, BedDouble, ConciergeBell, UtensilsCrossed,
  Wine, ShoppingBag, Package, Sparkles, Wrench, BarChart3, UserCog, Banknote,
  FileBarChart, Settings, Globe, Shield, ClipboardList, ChevronDown, ChevronLeft, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui.store";
import { hasPermission, currentUser, type Action } from "@/lib/permissions";

interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  perm?: [string, Action];
  enabled?: boolean;
  children?: { label: string; href: string; icon: LucideIcon; perm: [string, Action] }[];
}

const SECTIONS: { items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard", href: "/manage/dashboard", icon: LayoutDashboard, enabled: true },
      { label: "Reservations", href: "/manage/reservations", icon: Calendar, perm: ["reservations", "VIEW"], enabled: true },
      { label: "Guests", href: "/manage/guests", icon: Users, perm: ["guests", "VIEW"] },
      { label: "Rooms", href: "/manage/rooms", icon: BedDouble, perm: ["rooms", "VIEW"], enabled: true },
      { label: "Reception", href: "/manage/reception", icon: ConciergeBell, perm: ["reception", "VIEW"], enabled: true },
    ],
  },
  {
    items: [
      {
        label: "POS", icon: UtensilsCrossed,
        children: [
          { label: "Restaurant", href: "/manage/pos/restaurant", icon: UtensilsCrossed, perm: ["pos.restaurant", "VIEW"] },
          { label: "Lounge", href: "/manage/pos/lounge", icon: Wine, perm: ["pos.lounge", "VIEW"] },
          { label: "Boutique", href: "/manage/pos/boutique", icon: ShoppingBag, perm: ["pos.boutique", "VIEW"] },
        ],
      },
      { label: "Orders", href: "/manage/orders", icon: ClipboardList, perm: ["pos.restaurant", "VIEW"], enabled: true },
      { label: "Inventory", href: "/manage/inventory", icon: Package, perm: ["inventory", "VIEW"] },
      { label: "Housekeeping", href: "/manage/housekeeping", icon: Sparkles, perm: ["housekeeping", "VIEW"] },
      { label: "Maintenance", href: "/manage/maintenance", icon: Wrench, perm: ["maintenance", "VIEW"] },
    ],
  },
  {
    items: [
      { label: "Finance", href: "/manage/finance", icon: BarChart3, perm: ["finance", "VIEW"] },
      { label: "HR", href: "/manage/hr", icon: UserCog, perm: ["hr", "VIEW"] },
      { label: "Payroll", href: "/manage/payroll", icon: Banknote, perm: ["payroll", "VIEW"] },
      { label: "Reports", href: "/manage/reports", icon: FileBarChart, perm: ["reports", "VIEW"] },
    ],
  },
  {
    items: [
      { label: "Settings", href: "/manage/settings", icon: Settings, perm: ["settings", "VIEW"] },
      { label: "CMS", href: "/manage/cms", icon: Globe, perm: ["cms", "VIEW"] },
      { label: "Administration", href: "/manage/administration", icon: Shield, perm: ["administration", "VIEW"] },
    ],
  },
];

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useUIStore();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 lg:hidden",
          mobileOpen ? "block" : "hidden",
        )}
        onClick={closeMobile}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-brand-surface transition-[width,transform] duration-200",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-primary font-display text-lg font-bold text-brand-deep">
            A
          </div>
          {!collapsed && (
            <div className="flex-1 leading-none">
              <p className="font-display text-sm font-semibold text-fg">Acemco Express</p>
              <p className="text-[10px] uppercase tracking-widest text-brand-primary">Operations</p>
            </div>
          )}
          <button onClick={closeMobile} className="ml-auto rounded p-1 text-fg-soft hover:bg-brand-surface-2 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {SECTIONS.map((section, si) => (
            <div key={si} className={si > 0 ? "mt-2 border-t border-line pt-2" : ""}>
              {section.items.map((item) => (
                <NavRow key={item.label} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-surface-3 text-xs font-semibold text-fg">
              {currentUser.initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium text-fg">{currentUser.name}</p>
                <p className="truncate text-xs text-fg-muted">{currentUser.role.replace(/_/g, " ")}</p>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              aria-label="Toggle sidebar"
              className="hidden rounded p-1.5 text-fg-soft hover:bg-brand-surface-2 lg:block"
            >
              <ChevronLeft size={16} className={cn("transition-transform", collapsed && "rotate-180")} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  // Permission gate (§8.11): only show items the user can VIEW.
  const permitted = item.enabled || !item.perm || hasPermission(item.perm[0], item.perm[1]);
  if (item.children) {
    const visibleChildren = item.children.filter((c) => hasPermission(c.perm[0], c.perm[1]));
    if (visibleChildren.length === 0) return null;
    const active = pathname.startsWith("/manage/pos");
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
            active ? "text-fg" : "text-fg-soft hover:text-fg",
          )}
        >
          <item.icon size={20} strokeWidth={1.5} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown size={15} className={cn("transition-transform", !open && "-rotate-90")} />
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="ml-4 border-l border-line">
            {visibleChildren.map((c) => (
              <LeafLink key={c.href} href={c.href} label={c.label} icon={c.icon} active={pathname === c.href} nested />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!permitted || !item.href) return null;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return <LeafLink href={item.href} label={item.label} icon={item.icon} active={active} collapsed={collapsed} />;
}

function LeafLink({
  href, label, icon: Icon, active, collapsed, nested,
}: {
  href: string; label: string; icon: LucideIcon; active: boolean; collapsed?: boolean; nested?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 py-2.5 text-sm transition-colors",
        nested ? "pl-5 pr-4" : "px-4",
        active
          ? "border-l-2 border-brand-primary bg-brand-primary/10 font-medium text-brand-primary"
          : "border-l-2 border-transparent text-fg-soft hover:text-fg",
      )}
    >
      <Icon size={nested ? 16 : 20} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
