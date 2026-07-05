"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/utils";
import { site, roomTypes } from "@/lib/cms";
import { useRooms } from "@/stores/rooms.store";
import { publicRequest } from "@/lib/api";
import { hasPublicApi } from "@/lib/config";
import { Overline } from "./ui";

/**
 * Reservation request form (public side of the reservation↔ordering interlock).
 * For now it assembles a WhatsApp request; the interlock phase replaces the
 * submit with POST /public/reservations (status PENDING) + availability checks.
 */
export function ReservationForm({
  initial,
}: {
  initial: { checkIn?: string; checkOut?: string; adults?: string; children?: string; roomType?: string };
}) {
  const [form, setForm] = useState({
    checkIn: initial.checkIn ?? "",
    checkOut: initial.checkOut ?? "",
    adults: initial.adults ?? "2",
    children: initial.children ?? "0",
    roomType: initial.roomType ?? roomTypes[0].slug,
    name: "",
    phone: "",
    email: "",
    requests: "",
  });

  const room = roomTypes.find((r) => r.slug === form.roomType);
  const available = useRooms((s) => s.availableCountByType(form.roomType));
  const nights =
    form.checkIn && form.checkOut
      ? Math.max(0, Math.round((+new Date(form.checkOut) - +new Date(form.checkIn)) / 86_400_000))
      : 0;
  const estimate = room && nights > 0 ? room.basePrice * nights : 0;
  const datesValid = nights > 0;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Persist the reservation request first (Domain rule / Blueprint §17) when the API is live.
    if (hasPublicApi()) {
      const [firstName, ...rest] = form.name.trim().split(" ");
      try {
        await publicRequest("/reservations", {
          method: "POST",
          body: JSON.stringify({
            firstName: firstName || form.name,
            lastName: rest.join(" ") || firstName || "Guest",
            phone: form.phone,
            email: form.email || undefined,
            roomTypeSlug: form.roomType,
            checkInDate: form.checkIn,
            checkOutDate: form.checkOut,
            adults: Number(form.adults),
            children: Number(form.children),
            specialRequests: form.requests || undefined,
          }),
        });
      } catch {
        /* fall through to WhatsApp handoff regardless */
      }
    }
    const msg =
      `*Reservation request — ${site.hotelName}*%0A%0A` +
      `Room: ${room?.name}%0ACheck-in: ${form.checkIn}%0ACheck-out: ${form.checkOut} (${nights} night${nights !== 1 ? "s" : ""})%0A` +
      `Guests: ${form.adults} adult(s), ${form.children} child(ren)%0A` +
      (estimate ? `Estimate: ${formatNaira(estimate)}%0A` : "") +
      `%0AName: ${form.name}%0APhone: ${form.phone}` +
      (form.email ? `%0AEmail: ${form.email}` : "") +
      (form.requests ? `%0ARequests: ${form.requests}` : "");
    window.open(`https://wa.me/${site.whatsapp}?text=${msg}`, "_blank");
  }

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <div>
          <Overline className="mb-4">Stay Details</Overline>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check-in" type="date" required value={form.checkIn} onChange={(v) => set("checkIn", v)} />
            <Field label="Check-out" type="date" required value={form.checkOut} min={form.checkIn} onChange={(v) => set("checkOut", v)} />
            <SelectField label="Adults" value={form.adults} onChange={(v) => set("adults", v)} options={["1", "2", "3", "4"]} />
            <SelectField label="Children" value={form.children} onChange={(v) => set("children", v)} options={["0", "1", "2", "3"]} />
            <div className="sm:col-span-2">
              <SelectField
                label="Room type"
                value={form.roomType}
                onChange={(v) => set("roomType", v)}
                options={roomTypes.map((r) => r.slug)}
                labels={Object.fromEntries(roomTypes.map((r) => [r.slug, r.name]))}
              />
            </div>
          </div>
        </div>

        <div>
          <Overline className="mb-4">Your Details</Overline>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required value={form.name} onChange={(v) => set("name", v)} />
            <Field label="Phone" type="tel" required value={form.phone} onChange={(v) => set("phone", v)} />
            <div className="sm:col-span-2">
              <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => set("email", v)} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Special requests" textarea value={form.requests} onChange={(v) => set("requests", v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="lg:col-span-5">
        <div className="sticky top-24 rounded-2xl border border-pub-line bg-pub-surface p-6">
          <Overline className="mb-4">Summary</Overline>
          <dl className="space-y-3 pub-body">
            <Row label="Room" value={room?.name ?? "—"} />
            <Row label="Dates" value={datesValid ? `${form.checkIn} → ${form.checkOut}` : "Select dates"} />
            <Row label="Nights" value={datesValid ? String(nights) : "—"} />
            <Row label="Guests" value={`${form.adults} adult(s), ${form.children} child(ren)`} />
            <Row label="Availability" value={available > 0 ? `${available} room${available > 1 ? "s" : ""} available` : "None for this type"} />
          </dl>
          {available === 0 && (
            <p className="mt-3 rounded-md bg-pub-stone px-3 py-2 pub-body-sm text-pub-ink-soft">
              This room type is fully booked. Try another room or contact us for options.
            </p>
          )}
          <div className="mt-5 flex items-end justify-between border-t border-pub-line pt-5">
            <span className="pub-body-sm text-pub-ink-muted">Estimated total</span>
            <span className="pub-display-3">{estimate ? formatNaira(estimate) : "—"}</span>
          </div>
          <button
            type="submit"
            disabled={!datesValid || !form.name || !form.phone || available === 0}
            className="mt-6 w-full rounded-full bg-pub-gold py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Request to Book
          </button>
          <p className="mt-3 pub-body-sm text-pub-ink-muted">
            We&apos;ll confirm availability and hold your room. No payment is taken now.
          </p>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-pub-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-pub-ink">{value}</dd>
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-md border border-pub-line bg-pub-surface px-3 py-2.5 pub-body text-pub-ink focus:border-pub-gold focus:outline-none";

function Field({
  label, value, onChange, type = "text", required, textarea, min,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; textarea?: boolean; min?: string;
}) {
  return (
    <label className="block">
      <span className="pub-body-sm font-medium text-pub-ink-soft">
        {label}{required && <span className="text-pub-gold-deep"> *</span>}
      </span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input type={type} value={value} min={min} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </label>
  );
}

function SelectField({
  label, value, onChange, options, labels,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; labels?: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="pub-body-sm font-medium text-pub-ink-soft">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((o) => (
          <option key={o} value={o}>{labels ? labels[o] : o}</option>
        ))}
      </select>
    </label>
  );
}
