"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, CalendarClock, CalendarRange, Users, Building2, BedDouble, Tags, ConciergeBell, UtensilsCrossed,
  Wine, ShoppingBag, Package, Sparkles, Wrench, BarChart3, UserCog, Banknote, UsersRound,
  FileBarChart, Settings, Shield, ClipboardList, BookOpen, Percent, TrendingUp, Wallet, ChevronLeft, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui.store";
import { type Action } from "@/lib/permissions";
import { useAuth } from "@/providers/auth-provider";

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: [string, Action];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Navigation grouped by what a person actually does, with a labelled header per
 * group. It used to be four unlabelled blocks — the first crammed 11 unrelated
 * items (reservations, guests, rooms, rates…) into one wall — which read as
 * clutter. Grouping + labels turns "scan 26 rows" into "find your area, then the
 * item". A group the user can't access is hidden whole, header and all.
 */
const SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/manage/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Front Desk",
    items: [
      { label: "Reservations", href: "/manage/reservations", icon: Calendar, perm: ["reservations", "VIEW"] },
      { label: "Group Bookings", href: "/manage/groups", icon: UsersRound, perm: ["reservations", "VIEW"] },
      { label: "Reception", href: "/manage/reception", icon: ConciergeBell, perm: ["reception", "VIEW"] },
      { label: "Availability", href: "/manage/availability", icon: CalendarRange, perm: ["reservations", "VIEW"] },
      { label: "Conferences", href: "/manage/conferences", icon: CalendarClock, perm: ["reservations", "VIEW"] },
    ],
  },
  {
    label: "Guests",
    items: [
      { label: "Guests", href: "/manage/guests", icon: Users, perm: ["guests", "VIEW"] },
      { label: "Companies", href: "/manage/companies", icon: Building2, perm: ["guests", "VIEW"] },
    ],
  },
  {
    label: "Rooms & Rates",
    items: [
      { label: "Rooms", href: "/manage/rooms", icon: BedDouble, perm: ["rooms", "VIEW"] },
      { label: "Room Types", href: "/manage/room-types", icon: Tags, perm: ["rooms", "VIEW"] },
      { label: "Rates", href: "/manage/rates", icon: TrendingUp, perm: ["rooms", "VIEW"] },
    ],
  },
  {
    label: "Point of Sale",
    items: [
      { label: "Restaurant", href: "/manage/pos/restaurant", icon: UtensilsCrossed, perm: ["pos.restaurant", "VIEW"] },
      { label: "Lounge", href: "/manage/pos/lounge", icon: Wine, perm: ["pos.lounge", "VIEW"] },
      { label: "Boutique", href: "/manage/pos/boutique", icon: ShoppingBag, perm: ["pos.boutique", "VIEW"] },
      { label: "Orders", href: "/manage/orders", icon: ClipboardList, perm: ["pos.restaurant", "VIEW"] },
      { label: "Menu", href: "/manage/menu", icon: BookOpen, perm: ["pos.restaurant", "VIEW"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Housekeeping", href: "/manage/housekeeping", icon: Sparkles, perm: ["housekeeping", "VIEW"] },
      { label: "Maintenance", href: "/manage/maintenance", icon: Wrench, perm: ["maintenance", "VIEW"] },
      { label: "Inventory", href: "/manage/inventory", icon: Package, perm: ["inventory", "VIEW"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Finance", href: "/manage/finance", icon: BarChart3, perm: ["finance", "VIEW"] },
      { label: "Cash Drawer", href: "/manage/cash", icon: Wallet, perm: ["cash", "VIEW"] },
      { label: "Reports", href: "/manage/reports", icon: FileBarChart, perm: ["reports", "VIEW"] },
      { label: "Tax & Compliance", href: "/manage/tax", icon: Percent, perm: ["settings", "VIEW"] },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "HR", href: "/manage/hr", icon: UserCog, perm: ["hr", "VIEW"] },
      { label: "Payroll", href: "/manage/payroll", icon: Banknote, perm: ["payroll", "VIEW"] },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/manage/settings", icon: Settings, perm: ["settings", "VIEW"] },
      { label: "Administration", href: "/manage/administration", icon: Shield, perm: ["administration", "VIEW"] },
    ],
  },
];

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useUIStore();
  const { user, hasPermission } = useAuth();
  const pathname = usePathname();
  const displayName = user?.name ?? "—";
  const displayRole = (user?.roles ?? [])[0]?.replace(/_/g, " ") ?? "";

  // Drop items the user can't view, then drop any group left empty — so a
  // reception-only account never sees a bare "Finance" header with nothing under it.
  const sections = SECTIONS.map((s) => ({
    label: s.label,
    items: s.items.filter((i) => !i.perm || hasPermission(i.perm[0], i.perm[1])),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn("fixed inset-0 z-40 bg-black/50 lg:hidden", mobileOpen ? "block" : "hidden")}
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
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-primary font-display text-lg font-bold text-brand-deep">
            A
          </div>
          {!collapsed && (
            <div className="flex-1 leading-none">
              <p className="font-display text-sm font-semibold text-fg">Acemco Express</p>
              <p className="text-[10px] uppercase tracking-widest text-brand-primary-dark">Operations</p>
            </div>
          )}
          <button onClick={closeMobile} className="ml-auto rounded p-1 text-fg-soft hover:bg-brand-surface-2 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section, si) => (
            <div key={section.label} className={collapsed && si > 0 ? "mt-1 border-t border-line/70 pt-1" : ""}>
              {!collapsed && (
                <p className={cn("px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted/70", si === 0 ? "pt-2" : "pt-4")}>
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return <LeafLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={active} collapsed={collapsed} />;
              })}
            </div>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-surface-3 text-xs font-semibold text-fg">
              {initials(displayName)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium text-fg">{displayName}</p>
                <p className="truncate text-xs capitalize text-fg-muted">{displayRole}</p>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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

function LeafLink({
  href, label, icon: Icon, active, collapsed,
}: {
  href: string; label: string; icon: LucideIcon; active: boolean; collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 border-l-2 py-2 text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-4",
        active
          ? "border-brand-primary bg-brand-primary/10 font-medium text-brand-primary-dark"
          : "border-transparent text-fg-soft hover:bg-brand-surface-2 hover:text-fg",
      )}
    >
      <Icon size={18} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
