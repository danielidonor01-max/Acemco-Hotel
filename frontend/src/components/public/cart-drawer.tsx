"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart, useCartUI } from "@/stores/cart.store";
import { useOrders } from "@/stores/orders.store";
import { orderTotal } from "@/lib/orders";
import { publicRequest } from "@/lib/api";
import { hasPublicApi } from "@/lib/config";
import { site } from "@/lib/cms";
import { formatNaira, cn } from "@/lib/utils";
import { Overline } from "./ui";

/**
 * Public ordering cart drawer (§15.9). Right-side sheet with line items,
 * a checkout form, and WhatsApp handoff. Per the Domain rule, the order is
 * saved first (wired in the reservation↔ordering interlock phase) — the
 * WhatsApp link is then built from the saved order. Here we build it client-side.
 */
export function CartDrawer() {
  const { isOpen, close } = useCartUI();
  const { lines, setQty, remove, subtotal, clear } = useCart();
  const addOrder = useOrders((s) => s.addOrder);
  const orderCount = useOrders((s) => s.orders.length);
  const [mounted, setMounted] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", room: "", location: "", instructions: "" });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!mounted) return null;

  const total = subtotal();

  async function placeOrder() {
    // Domain rule: the order is SAVED FIRST (source WEBSITE, status PENDING),
    // then the WhatsApp message is built from the saved order (Blueprint §17).
    const storefront = lines[0]?.storefront ?? "RESTAURANT";

    // Persist to the operational API when live (else the local store demo above still holds it).
    if (hasPublicApi()) {
      try {
        await publicRequest("/orders", {
          method: "POST",
          body: JSON.stringify({
            storefront,
            items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes })),
            customerName: form.name,
            customerPhone: form.phone,
            roomNumber: form.room || undefined,
            deliveryLocation: form.location || undefined,
            specialInstructions: form.instructions || undefined,
          }),
        });
      } catch {
        /* fall through to WhatsApp regardless */
      }
    }
    const prefix = storefront === "LOUNGE" ? "LNGE" : "REST";
    addOrder({
      id: `ord-${orderCount + 1}-${storefront}`,
      orderNumber: `${prefix}-2026-${String(300 + orderCount).padStart(5, "0")}`,
      storefront,
      source: "WEBSITE",
      status: "PENDING",
      customerName: form.name,
      customerPhone: form.phone,
      roomNumber: form.room || undefined,
      deliveryLocation: form.location || undefined,
      specialInstructions: form.instructions || undefined,
      lines: lines.map((l) => ({ menuItemId: l.menuItemId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, notes: l.notes })),
      totalAmount: orderTotal(lines.map((l) => ({ menuItemId: l.menuItemId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice }))),
      createdAt: new Date().toISOString(),
    });

    const itemLines = lines
      .map((l) => `• ${l.quantity}× ${l.name} — ${formatNaira(l.unitPrice * l.quantity)}`)
      .join("%0A");
    const msg =
      `*New order — ${site.hotelName}*%0A%0A${itemLines}%0A%0A` +
      `*Total:* ${formatNaira(total)}%0A%0A` +
      `Name: ${form.name}%0APhone: ${form.phone}` +
      (form.room ? `%0ARoom: ${form.room}` : "") +
      (form.location ? `%0ADeliver to: ${form.location}` : "") +
      (form.instructions ? `%0ANotes: ${form.instructions}` : "");
    window.open(`https://wa.me/${site.whatsapp}?text=${msg}`, "_blank");
    clear();
    setCheckout(false);
    close();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-pub-espresso/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={close}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Your order"
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-full max-w-[400px] flex-col bg-pub-bg shadow-2xl transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-pub-line px-6 py-5">
          <div>
            <Overline>Your Order</Overline>
            <p className="pub-display-3 mt-1">{checkout ? "Checkout" : "Cart"}</p>
          </div>
          <button onClick={close} aria-label="Close cart" className="rounded-full p-2 hover:bg-pub-sand">
            <X size={20} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={40} strokeWidth={1} className="text-pub-ink-muted" />
            <p className="pub-body text-pub-ink-soft">Your cart is empty.</p>
            <Link href="/dining" onClick={close} className="pub-underline pub-cta text-pub-ink">
              Browse the menu
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!checkout ? (
                <ul className="space-y-5">
                  {lines.map((l) => (
                    <li key={l.menuItemId} className="flex gap-3">
                      <div className="flex-1">
                        <p className="pub-body font-medium text-pub-ink">{l.name}</p>
                        <p className="pub-body-sm text-pub-ink-muted">{formatNaira(l.unitPrice)}</p>
                        <div className="mt-2 inline-flex items-center rounded-full border border-pub-line">
                          <button
                            onClick={() => setQty(l.menuItemId, l.quantity - 1)}
                            aria-label="Decrease"
                            className="p-1.5 hover:text-pub-gold-deep"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center pub-body-sm">{l.quantity}</span>
                          <button
                            onClick={() => setQty(l.menuItemId, l.quantity + 1)}
                            aria-label="Increase"
                            className="p-1.5 hover:text-pub-gold-deep"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <span className="pub-body font-medium">{formatNaira(l.unitPrice * l.quantity)}</span>
                        <button
                          onClick={() => remove(l.menuItemId)}
                          aria-label="Remove item"
                          className="text-pub-ink-muted hover:text-pub-gold-deep"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <Field label="Full name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                  <Field label="Phone" required type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <Field label="Room number (optional)" value={form.room} onChange={(v) => setForm({ ...form, room: v })} />
                  <Field label="Delivery location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                  <Field label="Special instructions" textarea value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} />
                </form>
              )}
            </div>

            <div className="border-t border-pub-line px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="pub-overline text-pub-ink-soft">Subtotal</span>
                <span className="pub-display-3">{formatNaira(total)}</span>
              </div>
              {!checkout ? (
                <button
                  onClick={() => setCheckout(true)}
                  className="w-full rounded-full bg-pub-gold py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark"
                >
                  Checkout
                </button>
              ) : (
                <button
                  onClick={placeOrder}
                  disabled={!form.name || !form.phone}
                  className="w-full rounded-full bg-pub-gold py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Place Order via WhatsApp
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const base =
    "mt-1.5 w-full rounded-md border border-pub-line bg-pub-surface px-3 py-2.5 pub-body-sm text-pub-ink focus:border-pub-gold focus:outline-none";
  return (
    <label className="block">
      <span className="pub-body-sm font-medium text-pub-ink-soft">
        {label}
        {required && <span className="text-pub-gold-deep"> *</span>}
      </span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
    </label>
  );
}
