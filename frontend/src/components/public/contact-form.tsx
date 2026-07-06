"use client";

import { useState } from "react";
import { toast } from "sonner";
import { site } from "@/lib/cms";
import { Overline } from "./ui";

const inputCls =
  "mt-1.5 w-full rounded-md border border-pub-line bg-pub-surface px-3 py-2.5 pub-body text-pub-ink focus:border-pub-gold focus:outline-none";

/** Contact form — composes a WhatsApp message to the hotel (same handoff as the reservation form). */
export function ContactForm() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) return;
    const msg =
      `*Enquiry — ${site.hotelName}*%0A%0A` +
      `Name: ${form.name}%0APhone: ${form.phone}` +
      (form.email ? `%0AEmail: ${form.email}` : "") +
      `%0A%0A${form.message}`;
    window.open(`https://wa.me/${site.whatsapp}?text=${msg}`, "_blank");
    toast.success("Opening WhatsApp — we'll reply shortly.");
  }

  return (
    <>
      <Overline className="mb-4">Send a Message</Overline>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldLabel label="Name" required>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </FieldLabel>
          <FieldLabel label="Phone" required>
            <input type="tel" required value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
          </FieldLabel>
        </div>
        <FieldLabel label="Email">
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
        </FieldLabel>
        <FieldLabel label="Message" required>
          <textarea rows={5} required value={form.message} onChange={(e) => set("message", e.target.value)} className={inputCls} />
        </FieldLabel>
        <button
          type="submit"
          className="rounded-full bg-pub-gold px-7 py-3 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark"
        >
          Send Message
        </button>
      </form>
    </>
  );
}

function FieldLabel({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="pub-body-sm font-medium text-pub-ink-soft">
        {label}
        {required && <span className="text-pub-gold-deep"> *</span>}
      </span>
      {children}
    </label>
  );
}
