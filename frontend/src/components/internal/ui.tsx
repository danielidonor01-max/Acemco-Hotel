import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button as ShButton } from "@/components/ui/button";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction,
} from "@/components/ui/card";

/**
 * Internal UI kit — a thin domain layer over shadcn/ui primitives.
 * Pages import from here; the primitives underneath are formal shadcn components
 * (themed to the AEHOP brand via the `.dark` token map in globals.css).
 */

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction };

/* ---------------- Button (§8.1) — adapts our API to shadcn ---------------- */
type BtnVariant = "default" | "outline" | "ghost" | "destructive" | "secondary";
type BtnSize = "sm" | "md" | "lg";

export function Button({
  variant = "default",
  size = "md",
  href,
  className,
  children,
  ...rest
}: {
  variant?: BtnVariant;
  size?: BtnSize;
  href?: string;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const shSize = size === "md" ? "default" : size;
  if (href) {
    return (
      <ShButton asChild variant={variant} size={shSize} className={className}>
        <Link href={href}>{children}</Link>
      </ShButton>
    );
  }
  return (
    <ShButton variant={variant} size={shSize} className={className} {...rest}>
      {children}
    </ShButton>
  );
}

/* ---------------- StatCard (§8.5) ---------------- */
export function StatCard({
  title, value, delta, deltaType = "neutral", icon: Icon,
}: {
  title: string; value: string; delta?: string;
  deltaType?: "positive" | "negative" | "neutral"; icon: LucideIcon;
}) {
  return (
    <Card className="gap-0 p-5 transition-shadow hover:shadow-[0_2px_4px_#14100a0f,0_12px_28px_-10px_#14100a1f]">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-surface-2 text-brand-primary-dark">
          <Icon size={18} strokeWidth={1.75} />
        </span>
      </div>
      <div className="mt-4 text-[28px] font-semibold leading-none tracking-tight text-foreground">{value}</div>
      {delta && (
        <div
          className={cn(
            "mt-2 text-[13px]",
            deltaType === "positive" && "text-ok",
            deltaType === "negative" && "text-danger",
            deltaType === "neutral" && "text-muted-foreground",
          )}
        >
          {delta}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Badge / StatusBadge (§8.6 / §2.5) ----------------
   Semantic tones beyond shadcn's set (success/warning/info/brand). */
export function Badge({
  className, children, tone = "neutral",
}: {
  className?: string; children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
}) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground border-border",
    success: "bg-ok-bg text-ok border-ok/30",
    warning: "bg-warn-bg text-warn border-warn/30",
    danger: "bg-danger-bg text-danger border-danger/30",
    info: "bg-info-bg text-info border-info/30",
    brand: "bg-brand-primary/15 text-brand-primary-dark border-brand-primary/40",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "brand" | "neutral"> = {
  AVAILABLE: "success", OPERATIONAL: "success", ACTIVE: "success", COMPLETED: "success", CONFIRMED: "success", APPROVED: "success", PAID: "success", SETTLED: "success", RECEIVED: "success", PRESENT: "success", ISSUED: "success",
  PENDING: "info", RESERVED: "info", DRAFT: "info", PROCESSING: "info", SUBMITTED: "info", IN_PROGRESS: "info", PREPARING: "info", READY: "info",
  CLEANING: "warning", INSPECTION: "warning", INSPECTION_DUE: "warning", MAINTENANCE: "warning", NEEDS_REPAIR: "warning", UNDER_REPAIR: "warning", SUSPENDED: "warning", LATE: "warning", LOW: "warning", ON_HOLD: "warning", PARTIAL: "warning", DELIVERED: "info",
  OUT_OF_ORDER: "danger", BLOCKED: "danger", ERROR: "danger", DISPOSED: "danger", BLACKLISTED: "danger", DISPUTED: "danger", REJECTED: "danger", ABSENT: "danger", TERMINATED: "danger", CRITICAL: "danger",
  OCCUPIED: "brand", CHECKED_IN: "brand", OPEN: "brand",
  CANCELLED: "neutral", NO_SHOW: "neutral", CHECKED_OUT: "neutral", DECOMMISSIONED: "neutral", CLOSED: "neutral", RESIGNED: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = status.replace(/_/g, " ");
  const strike = status === "CANCELLED" || status === "NO_SHOW";
  return (
    <Badge tone={tone} className={strike ? "line-through" : undefined}>
      <span className="capitalize" aria-label={label}>{label.toLowerCase()}</span>
    </Badge>
  );
}

/* ---------------- PageShell (§8.13) ---------------- */
export function PageShell({
  title, breadcrumb, actions, children,
}: {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-6">
      {breadcrumb && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.href ? <Link href={b.href} className="hover:text-foreground">{b.label}</Link> : <span className="text-foreground/80">{b.label}</span>}
              {i < breadcrumb.length - 1 && <span>/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/* ---------------- EmptyState (§14) ---------------- */
export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: LucideIcon; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <Icon size={48} strokeWidth={1} className="text-muted-foreground" />
      <p className="text-lg font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
