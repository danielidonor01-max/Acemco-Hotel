"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, Trash2, Send, Check, Search } from "lucide-react";
import { Button, Badge } from "./ui";
import { useOrders } from "@/stores/orders.store";
import { orderTotal, type OrderLine, type OrderSource } from "@/lib/orders";
import { venues, boutiqueProducts, type Storefront } from "@/lib/cms";
import { formatNaira, cn } from "@/lib/utils";

interface Sellable {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  meta?: string; // e.g. stock or tags
}

const TAX_RATE = 0.075;

/** POS terminal (Domain §4.1). Menu/product grid + order pad → unified Orders pipeline. */
export function POSTerminal({ storefront }: { storefront: Storefront | "BOUTIQUE" }) {
  const addOrder = useOrders((s) => s.addOrder);
  const orderCount = useOrders((s) => s.orders.length);

  const { items, categories, kind } = useMemo(() => buildCatalogue(storefront), [storefront]);

  const [activeCat, setActiveCat] = useState(categories[0]);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [ref, setRef] = useState(""); // table (restaurant/lounge) or customer (boutique)
  const [sent, setSent] = useState<string | null>(null);

  const shown = items.filter(
    (i) => (query ? i.name.toLowerCase().includes(query.toLowerCase()) : i.category === activeCat),
  );

  function add(item: Sellable) {
    if (!item.available) return;
    setLines((prev) => {
      const ex = prev.find((l) => l.menuItemId === item.id);
      if (ex) return prev.map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1 }];
    });
  }
  function setQty(id: string, q: number) {
    setLines((prev) => (q <= 0 ? prev.filter((l) => l.menuItemId !== id) : prev.map((l) => (l.menuItemId === id ? { ...l, quantity: q } : l))));
  }

  const subtotal = orderTotal(lines);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  function send() {
    if (lines.length === 0) return;
    const prefix = storefront === "LOUNGE" ? "LNGE" : storefront === "BOUTIQUE" ? "BTQ" : "REST";
    const source: OrderSource = "INTERNAL_POS";
    const number = `${prefix}-2026-${String(400 + orderCount).padStart(5, "0")}`;
    addOrder({
      id: `pos-${orderCount}-${storefront}`,
      orderNumber: number,
      storefront: storefront === "BOUTIQUE" ? "RESTAURANT" : storefront, // Order.storefront is RESTAURANT|LOUNGE; boutique tracked via number prefix
      source,
      status: kind === "retail" ? "COMPLETED" : "CONFIRMED",
      tableNumber: kind !== "retail" && ref ? ref : undefined,
      customerName: kind === "retail" && ref ? ref : undefined,
      lines,
      totalAmount: total,
      createdAt: new Date().toISOString(),
    });
    setSent(number);
    setLines([]);
    setRef("");
    setTimeout(() => setSent(null), 2500);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Catalogue */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="h-9 w-full rounded-md border border-line bg-brand-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-line-2 focus:outline-none"
            />
          </div>
        </div>

        {!query && (
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  activeCat === c ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-line-2 text-fg-soft hover:text-fg",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((item) => (
            <button
              key={item.id}
              onClick={() => add(item)}
              disabled={!item.available}
              className={cn(
                "flex flex-col items-start rounded-lg border border-line bg-brand-surface p-3 text-left transition-colors",
                item.available ? "hover:border-brand-primary hover:bg-brand-surface-2" : "cursor-not-allowed opacity-50",
              )}
            >
              <span className="text-sm font-medium text-fg">{item.name}</span>
              {item.meta && <span className="mt-0.5 text-xs text-fg-muted">{item.meta}</span>}
              <span className="mt-2 text-sm font-semibold text-brand-primary">{formatNaira(item.price)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Order pad */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col rounded-lg border border-line bg-brand-surface">
          <div className="border-b border-line p-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-fg-muted">
              {kind === "retail" ? "Customer (optional)" : "Table / Area"}
            </label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder={kind === "retail" ? "Walk-in" : "e.g. T04"}
              className="mt-1 h-9 w-full rounded-md border border-line bg-brand-surface-2 px-3 text-sm text-fg focus:border-line-2 focus:outline-none"
            />
          </div>

          <div className="max-h-[42vh] flex-1 overflow-y-auto p-4">
            {lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">Tap items to build the order.</p>
            ) : (
              <ul className="space-y-3">
                {lines.map((l) => (
                  <li key={l.menuItemId} className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-fg">{l.name}</p>
                      <p className="text-xs text-fg-muted">{formatNaira(l.unitPrice)}</p>
                    </div>
                    <div className="inline-flex items-center rounded-md border border-line">
                      <button onClick={() => setQty(l.menuItemId, l.quantity - 1)} className="p-1 text-fg-soft hover:text-brand-primary" aria-label="Decrease"><Minus size={13} /></button>
                      <span className="w-6 text-center text-sm">{l.quantity}</span>
                      <button onClick={() => setQty(l.menuItemId, l.quantity + 1)} className="p-1 text-fg-soft hover:text-brand-primary" aria-label="Increase"><Plus size={13} /></button>
                    </div>
                    <span className="w-16 text-right text-sm text-fg">{formatNaira(l.unitPrice * l.quantity)}</span>
                    <button onClick={() => setQty(l.menuItemId, 0)} className="text-fg-muted hover:text-danger" aria-label="Remove"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line p-4">
            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatNaira(subtotal)} />
              <Row label={`Tax (${(TAX_RATE * 100).toFixed(1)}%)`} value={formatNaira(tax)} />
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-fg">
                <span>Total</span><span>{formatNaira(total)}</span>
              </div>
            </div>
            <Button onClick={send} disabled={lines.length === 0} className="mt-4 w-full" size="lg">
              {kind === "retail" ? <><Check size={16} /> Charge</> : <><Send size={16} /> Send to Kitchen</>}
            </Button>
            {sent && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-ok">
                <Check size={15} /> {sent} sent to Orders
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 px-1 text-xs text-fg-muted">
          Orders sent here appear live in <Badge tone="brand">Orders</Badge> alongside website orders.
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-fg-soft"><span>{label}</span><span className="text-fg">{value}</span></div>;
}

function buildCatalogue(storefront: Storefront | "BOUTIQUE"): {
  items: Sellable[]; categories: string[]; kind: "food" | "retail";
} {
  if (storefront === "BOUTIQUE") {
    const items: Sellable[] = boutiqueProducts.map((p) => ({
      id: p.id, name: p.name, price: p.price, category: p.category,
      available: p.stockQty > 0, // Domain rule: stockQty 0 cannot be sold
      meta: p.stockQty > 0 ? `${p.stockQty} in stock · ${p.sku}` : "Out of stock",
    }));
    return { items, categories: [...new Set(items.map((i) => i.category))], kind: "retail" };
  }
  const venue = venues.find((v) => v.storefront === storefront)!;
  const items: Sellable[] = venue.categories.flatMap((c) =>
    c.items
      .filter((i) => !i.isHidden)
      .map((i) => ({
        id: i.id, name: i.name, price: i.price, category: c.name,
        available: i.isAvailable, // Domain rule: unavailable items not addable
        meta: i.tags.join(" · ") || undefined,
      })),
  );
  return { items, categories: venue.categories.map((c) => c.name), kind: "food" };
}
