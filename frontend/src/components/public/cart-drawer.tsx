"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowLeft, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useCart, useCartUI } from "@/stores/cart.store";
import { publicRequest } from "@/lib/api";
import { formatNaira, cn } from "@/lib/utils";
import { Overline } from "./ui";

type Verify = "idle" | "checking" | "ok" | "fail";

export function CartDrawer() {
  const { isOpen, close } = useCartUI();
  const { lines, setQty, remove, subtotal, clear } = useCart();
  const [mounted, setMounted] = useState(false);

  const [view, setView] = useState<"cart" | "checkout">("cart");
  const [form, setForm] = useState({ room: "", lastName: "", instructions: "" });
  const [verify, setVerify] = useState<Verify>("idle");
  const [guest, setGuest] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string; room: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Re-verification needed if room/name change.
  useEffect(() => { setVerify("idle"); setGuest(null); }, [form.room, form.lastName]);

  if (!mounted) return null;

  const total = subtotal();
  const storefront = lines[0]?.storefront ?? "RESTAURANT";

  function resetAndClose() {
    setView("cart"); setForm({ room: "", lastName: "", instructions: "" });
    setVerify("idle"); setGuest(null); setPlaced(null); setError(null);
    close();
  }

  async function runVerify() {
    if (!form.room || !form.lastName) return;
    setVerify("checking"); setError(null);
    try {
      const res = await publicRequest<{ verified: boolean; guestName?: string }>("/verify-guest", {
        method: "POST",
        body: JSON.stringify({ roomNumber: form.room, lastName: form.lastName }),
      });
      if (res.verified) { setGuest(res.guestName ?? null); setVerify("ok"); }
      else setVerify("fail");
    } catch { setVerify("fail"); }
  }

  // The order always goes to the API. It used to fall back to a client-side store
  // when the public API wasn't configured, which showed the guest a "confirmed"
  // order number for a meal the kitchen would never receive — a silent failure in
  // exactly the case (misconfigured deploy) where it does the most damage.
  async function placeOrder() {
    setPlacing(true); setError(null);
    try {
      const order = await publicRequest<{ orderNumber: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          storefront,
          items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes })),
          roomNumber: form.room,
          lastName: form.lastName,
          specialInstructions: form.instructions || undefined,
        }),
      });
      setPlaced({ orderNumber: order.orderNumber, room: form.room });
      clear();
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "Could not place the order. Please call reception.";
      setError(msg);
    } finally {
      setPlacing(false);
    }
  }

  const canPlace = lines.length > 0 && verify === "ok";

  return (
    <>
      <div
        className={cn("fixed inset-0 z-[60] bg-pub-espresso/50 transition-opacity duration-300", isOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label="Your order"
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-full max-w-[400px] flex-col bg-pub-bg shadow-2xl transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pub-line px-6 py-5">
          <div className="flex items-center gap-2">
            {view === "checkout" && !placed && (
              <button onClick={() => setView("cart")} aria-label="Back to cart" className="-ml-2 rounded-full p-2 hover:bg-pub-sand">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <Overline>Your Order</Overline>
              <p className="pub-display-3 mt-1">{placed ? "Confirmed" : view === "checkout" ? "Checkout" : "Cart"}</p>
            </div>
          </div>
          <button onClick={resetAndClose} aria-label="Close cart" className="rounded-full p-2 hover:bg-pub-sand"><X size={20} /></button>
        </div>

        {/* Success */}
        {placed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <CheckCircle2 size={44} className="text-pub-gold-deep" />
            <p className="pub-display-3">Order placed</p>
            <p className="pub-body text-pub-ink-soft">
              <span className="font-medium text-pub-ink">{placed.orderNumber}</span> — our team will bring it to Room {placed.room}.
            </p>
            <button onClick={resetAndClose} className="mt-2 rounded-full bg-pub-gold px-7 py-3 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark">
              Done
            </button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={40} strokeWidth={1} className="text-pub-ink-muted" />
            <p className="pub-body text-pub-ink-soft">Your cart is empty.</p>
            <Link href="/dining" onClick={close} className="pub-underline pub-cta text-pub-ink">Browse the menu</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {view === "cart" ? (
                <ul className="space-y-5">
                  {lines.map((l) => (
                    <li key={l.menuItemId} className="flex gap-3">
                      <div className="flex-1">
                        <p className="pub-body font-medium text-pub-ink">{l.name}</p>
                        <p className="pub-body-sm text-pub-ink-muted">{formatNaira(l.unitPrice)}</p>
                        <div className="mt-2 inline-flex items-center rounded-full border border-pub-line">
                          <button onClick={() => setQty(l.menuItemId, l.quantity - 1)} aria-label="Decrease" className="p-1.5 hover:text-pub-gold-deep"><Minus size={14} /></button>
                          <span className="w-6 text-center pub-body-sm">{l.quantity}</span>
                          <button onClick={() => setQty(l.menuItemId, l.quantity + 1)} aria-label="Increase" className="p-1.5 hover:text-pub-gold-deep"><Plus size={14} /></button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <span className="pub-body font-medium">{formatNaira(l.unitPrice * l.quantity)}</span>
                        <button onClick={() => remove(l.menuItemId)} aria-label="Remove item" className="text-pub-ink-muted hover:text-pub-gold-deep"><Trash2 size={16} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-pub-sand p-3 pub-body-sm text-pub-ink-soft">
                    <ShieldCheck size={15} className="mr-1 inline text-pub-gold-deep" />
                    Room service is for checked-in guests. Verify your room to order.
                  </div>
                  <Field label="Room number" required value={form.room} onChange={(v) => setForm({ ...form, room: v })} />
                  <Field label="Last name" required value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />

                  <div>
                    <button
                      onClick={runVerify}
                      disabled={!form.room || !form.lastName || verify === "checking"}
                      className="inline-flex items-center gap-2 rounded-full border border-pub-ink px-4 py-2 pub-cta text-pub-ink transition-colors hover:bg-pub-ink hover:text-pub-bg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {verify === "checking" ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                      Verify guest
                    </button>
                    {verify === "ok" && <p className="mt-2 pub-body-sm text-pub-gold-deep">✓ Verified — welcome, {guest}. Charging to Room {form.room}.</p>}
                    {verify === "fail" && <p className="mt-2 pub-body-sm text-pub-danger">We couldn&apos;t verify that room and name. Ordering is available to in-house guests.</p>}
                  </div>

                  <Field label="Special instructions" textarea value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} />
                  {error && <p className="pub-body-sm text-pub-danger">{error}</p>}
                </div>
              )}
            </div>

            <div className="border-t border-pub-line px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="pub-overline text-pub-ink-soft">Subtotal</span>
                <span className="pub-display-3">{formatNaira(total)}</span>
              </div>
              {view === "cart" ? (
                <div className="space-y-2">
                  <button onClick={() => setView("checkout")} className="w-full rounded-full bg-pub-gold py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark">
                    Checkout
                  </button>
                  <button onClick={() => clear()} className="w-full pub-body-sm text-pub-ink-muted transition-colors hover:text-pub-gold-deep">
                    Clear cart
                  </button>
                </div>
              ) : (
                <button
                  onClick={placeOrder}
                  disabled={!canPlace || placing}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-pub-gold py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {placing && <Loader2 size={16} className="animate-spin" />}
                  Place Room-Service Order
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
  label, value, onChange, required, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; textarea?: boolean;
}) {
  const base = "mt-1.5 w-full rounded-md border border-pub-line bg-pub-surface px-3 py-2.5 pub-body-sm text-pub-ink focus:border-pub-gold focus:outline-none";
  return (
    <label className="block">
      <span className="pub-body-sm font-medium text-pub-ink-soft">{label}{required && <span className="text-pub-gold-deep"> *</span>}</span>
      {textarea ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
    </label>
  );
}
