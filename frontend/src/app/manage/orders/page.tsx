"use client";

import { useMemo, useState } from "react";
import { ClipboardList, ChevronRight, Globe, UtensilsCrossed, BedDouble } from "lucide-react";
import { PageShell, Card, Button, Badge, StatusBadge, EmptyState } from "@/components/internal/ui";
import { useOrders } from "@/stores/orders.store";
import { nextStatus, type OrderSource, type OrderStatus } from "@/lib/orders";
import { formatNaira, cn } from "@/lib/utils";

const SOURCE_META: Record<OrderSource, { label: string; icon: typeof Globe }> = {
  WEBSITE: { label: "Website", icon: Globe },
  INTERNAL_POS: { label: "POS", icon: UtensilsCrossed },
  ROOM_SERVICE: { label: "Room service", icon: BedDouble },
};

const FILTERS: (OrderStatus | "ALL" | "ACTIVE")[] = ["ACTIVE", "PENDING", "PREPARING", "READY", "COMPLETED", "ALL"];

export default function OrdersPage() {
  const { orders, advance, cancel } = useOrders();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ACTIVE");

  const filtered = useMemo(() => {
    if (filter === "ALL") return orders;
    if (filter === "ACTIVE") return orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status));
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <PageShell
      title="Orders"
      breadcrumb={[{ label: "Dashboard", href: "/manage/dashboard" }, { label: "Orders" }]}
    >
      <p className="mb-4 max-w-2xl text-sm text-fg-soft">
        Every order — placed on the website, at a POS terminal, or as room service — flows through one
        pipeline. Website orders arrive as <span className="text-fg">Pending</span> and are advanced here.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
              filter === f ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark" : "border-line-2 text-fg-soft hover:text-fg",
            )}
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders" description="Orders placed on the website or POS will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => {
            const Meta = SOURCE_META[o.source];
            const next = nextStatus(o.status);
            const closed = o.status === "COMPLETED" || o.status === "CANCELLED";
            return (
              <Card key={o.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-fg">{o.orderNumber}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-fg-muted">
                      <Meta.icon size={12} /> {Meta.label}
                      {o.tableNumber && ` · Table ${o.tableNumber}`}
                      {o.roomNumber && ` · Room ${o.roomNumber}`}
                      {o.deliveryLocation && ` · ${o.deliveryLocation}`}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                {o.customerName && <p className="mt-2 text-sm text-fg-soft">{o.customerName}</p>}

                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  {o.lines.map((l) => (
                    <li key={l.menuItemId} className="flex justify-between text-fg-soft">
                      <span>{l.quantity}× {l.name}</span>
                      <span className="text-fg">{formatNaira(l.unitPrice * l.quantity)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <Badge tone="brand">{formatNaira(o.totalAmount)}</Badge>
                  {!closed && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => cancel(o.id)}>Cancel</Button>
                      {next && (
                        <Button size="sm" onClick={() => advance(o.id)}>
                          {next.toLowerCase()} <ChevronRight size={14} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
