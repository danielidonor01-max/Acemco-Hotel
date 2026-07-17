"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Send, Check, Search, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge } from "./ui";
import { getPosCatalogue, createOrder, type Sellable } from "@/lib/data/orders-api";
import { getTaxRates, taxOn, type TaxDepartment } from "@/lib/data/tax";
import { orderTotal, type OrderLine } from "@/lib/orders";
import { type Storefront } from "@/lib/cms";
import { formatNaira, cn } from "@/lib/utils";

/** POS terminal (Domain §4.1). Menu/product grid + order pad → unified Orders pipeline. */
export function POSTerminal({ storefront }: { storefront: Storefront | "BOUTIQUE" }) {
  const qc = useQueryClient();

  // Tax comes from the hotel's configured rates — the same ones the backend bills
  // from. This used to be a hardcoded `TAX_RATE = 0.075` here while the ledger
  // recorded no tax at all, so the cashier collected 7.5% the books never saw.
  const { data: taxRates = [] } = useQuery({ queryKey: ["tax-rates"], queryFn: getTaxRates, staleTime: 300_000 });

  const { data: catalogue, isLoading } = useQuery({
    queryKey: ["pos-catalogue", storefront],
    queryFn: () => getPosCatalogue(storefront),
    staleTime: 60_000,
  });
  const items = useMemo(() => catalogue?.items ?? [], [catalogue]);
  const categories = catalogue?.categories ?? [];
  const kind = catalogue?.kind ?? "food";
  const live = catalogue?.live ?? false;

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [ref, setRef] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const currentCat = activeCat ?? categories[0];
  const shown = items.filter(
    (i) => (query ? i.name.toLowerCase().includes(query.toLowerCase()) : i.category === currentCat),
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

  const department: TaxDepartment = storefront === "BOUTIQUE" ? "BOUTIQUE" : storefront;
  const subtotal = orderTotal(lines);
  const { lines: taxLines, tax } = taxOn(taxRates, department, subtotal);
  const total = subtotal + tax;

  // Every sale posts to the API. There is no local fallback: a sale that isn't
  // persisted is money the hotel can't see, and the old fallback silently kept
  // boutique takings in browser memory until the page was refreshed.
  const send = useMutation({
    mutationFn: async () => {
      const order = await createOrder({
        storefront,
        items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes })),
        tableNumber: kind !== "retail" ? ref || undefined : undefined,
        customerName: kind === "retail" ? ref || undefined : undefined,
      });
      return order.orderNumber;
    },
    onSuccess: (number) => {
      setSent(number);
      setLines([]);
      setRef("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      setTimeout(() => setSent(null), 2500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

        {isLoading ? (
          <p className="py-12 text-center text-sm text-fg-muted">Loading menu…</p>
        ) : !live ? (
          // No live catalogue → the terminal cannot record a sale, so it must not
          // pretend to. Selling here would produce takings with no DB record.
          <div className="rounded-lg border border-warn/40 bg-warn/5 p-8 text-center">
            <AlertTriangle size={22} className="mx-auto text-warn" strokeWidth={1.6} />
            <p className="mt-3 font-medium text-fg">This till can&apos;t take orders yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-fg-soft">
              No items are set up for this storefront, so a sale couldn&apos;t be recorded against the
              hotel&apos;s books. Add items under <span className="font-medium text-fg">Menu</span> first.
            </p>
            <Link href="/manage/menu" className="mt-4 inline-block">
              <Button size="sm">Go to Menu</Button>
            </Link>
          </div>
        ) : (
          <>
            {!query && (
              <div className="mb-4 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setActiveCat(c)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      currentCat === c ? "border-brand-primary bg-brand-primary/10 text-brand-primary-dark" : "border-line-2 text-fg-soft hover:text-fg",
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
                  type="button"
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
                  <span className="mt-2 text-sm font-semibold text-brand-primary-dark">{formatNaira(item.price)}</span>
                </button>
              ))}
              {shown.length === 0 && <p className="col-span-full py-8 text-center text-sm text-fg-muted">No items in this category.</p>}
            </div>
          </>
        )}
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
                      <button type="button" onClick={() => setQty(l.menuItemId, l.quantity - 1)} className="p-1 text-fg-soft hover:text-brand-primary-dark" aria-label="Decrease"><Minus size={13} /></button>
                      <span className="w-6 text-center text-sm">{l.quantity}</span>
                      <button type="button" onClick={() => setQty(l.menuItemId, l.quantity + 1)} className="p-1 text-fg-soft hover:text-brand-primary-dark" aria-label="Increase"><Plus size={13} /></button>
                    </div>
                    <span className="w-16 text-right text-sm text-fg">{formatNaira(l.unitPrice * l.quantity)}</span>
                    <button type="button" onClick={() => setQty(l.menuItemId, 0)} className="text-fg-muted hover:text-danger" aria-label="Remove"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line p-4">
            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatNaira(subtotal)} />
              {taxLines.map((t) => (
                <Row key={t.code} label={`${t.name} (${t.rate}%)`} value={formatNaira(t.amount)} />
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-fg">
                <span>Total</span><span>{formatNaira(total)}</span>
              </div>
            </div>
            <Button onClick={() => send.mutate()} disabled={!live || lines.length === 0 || send.isPending} className="mt-4 w-full" size="lg">
              {send.isPending ? <Loader2 size={16} className="animate-spin" /> : kind === "retail" ? <><Check size={16} /> Charge</> : <><Send size={16} /> Send to Kitchen</>}
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
