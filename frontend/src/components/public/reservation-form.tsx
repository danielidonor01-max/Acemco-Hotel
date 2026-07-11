"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import { site } from "@/lib/cms";
import { getPublicAvailability, submitPublicReservation } from "@/lib/data/public-booking";
import { getRoomTypes } from "@/lib/data/rooms";
import { Overline } from "./ui";
import { PubDatePicker, PubSelect } from "./fields";

/**
 * Reservation request form — public booking engine.
 * Availability is fetched live from GET /public/availability when dates are set.
 * On submit, POST /public/reservations creates a PENDING reservation.
 * WhatsApp is kept as a guaranteed fallback if the API is unreachable.
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
    roomType: initial.roomType ?? "",
    name: "",
    phone: "",
    email: "",
    requests: "",
  });

  const [confirmed, setConfirmed] = useState<{ reservationNumber: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The bookable catalogue, live from the API. Sourcing this from the static sample
  // let a guest submit a roomTypeSlug the backend doesn't have — the booking then
  // failed and they were bounced to WhatsApp without ever being told why.
  const { data: roomTypes = [] } = useQuery({
    queryKey: ["public-room-types"],
    queryFn: getRoomTypes,
    staleTime: 300_000,
  });

  // Default to the first live type once the catalogue arrives.
  const selectedSlug = form.roomType || roomTypes[0]?.slug || "";
  const room = roomTypes.find((r) => r.slug === selectedSlug);
  const nights =
    form.checkIn && form.checkOut
      ? Math.max(0, Math.round((+new Date(form.checkOut) - +new Date(form.checkIn)) / 86_400_000))
      : 0;
  const datesValid = nights > 0;

  // ── Live availability ──────────────────────────────────────────────────────
  const { data: availData, isFetching: checkingAvail } = useQuery({
    queryKey: ["public-availability", form.checkIn, form.checkOut],
    queryFn: () => getPublicAvailability(form.checkIn, form.checkOut),
    enabled: datesValid,
    staleTime: 60_000,
  });

  const availRow = availData?.find((a) => a.slug === selectedSlug);
  const available = availRow?.available ?? 0;
  const livePrice = availRow?.totalPrice;
  const estimate = livePrice ?? (room && nights > 0 ? room.basePrice * nights : 0);

  const fmtDate = (iso: string) =>
    iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Pre-filled WhatsApp handoff — offered as a visible link when booking fails. */
  const whatsappHref = () => {
    const msg =
      `*Reservation request — ${site.hotelName}*%0A%0A` +
      `Room: ${room?.name ?? "—"}%0ACheck-in: ${form.checkIn}%0ACheck-out: ${form.checkOut} (${nights} night${nights !== 1 ? "s" : ""})%0A` +
      `Guests: ${form.adults} adult(s), ${form.children} child(ren)%0A` +
      (estimate ? `Estimate: ${formatNaira(estimate)}%0A` : "") +
      `%0AName: ${form.name}%0APhone: ${form.phone}` +
      (form.email ? `%0AEmail: ${form.email}` : "") +
      (form.requests ? `%0ARequests: ${form.requests}` : "");
    return `https://wa.me/${site.whatsapp}?text=${msg}`;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const [firstName, ...rest] = form.name.trim().split(" ");
    const payload = {
      firstName: firstName || form.name,
      lastName: rest.join(" ") || firstName || "Guest",
      phone: form.phone,
      email: form.email || undefined,
      roomTypeSlug: selectedSlug,
      checkInDate: form.checkIn,
      checkOutDate: form.checkOut,
      adults: Number(form.adults),
      children: Number(form.children),
      specialRequests: form.requests || undefined,
    };

    try {
      const result = await submitPublicReservation(payload);
      setConfirmed({ reservationNumber: result.reservationNumber });
    } catch (e) {
      // Tell the guest what went wrong. This used to swallow every failure —
      // sold out, blacklisted, validation, network — into a silent window.open()
      // to WhatsApp; if the popup was blocked (common after an await) the guest was
      // left with nothing at all: no confirmation, no error, no explanation.
      const msg = (e as { message?: string }).message ?? "We couldn't complete your booking just now.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation state ─────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-pub-line bg-pub-surface px-8 py-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pub-gold/20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-pub-gold-deep">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <Overline className="mb-2">Booking Received</Overline>
        <h2 className="pub-display-3 mb-3 text-pub-ink">You&apos;re on the list</h2>
        <p className="pub-body text-pub-ink-muted mb-6">
          Your reservation request <strong className="text-pub-ink">{confirmed.reservationNumber}</strong> has been received.
          Our team will contact you shortly to confirm your stay.
        </p>
        <p className="pub-body-sm text-pub-ink-soft">No payment has been taken.</p>
        <button
          onClick={() => {
            setConfirmed(null);
            setForm({ checkIn: "", checkOut: "", adults: "2", children: "0", roomType: "", name: "", phone: "", email: "", requests: "" });
          }}
          className="mt-8 rounded-full border border-pub-line px-6 py-2.5 pub-body-sm text-pub-ink-muted transition-colors hover:border-pub-gold hover:text-pub-ink"
        >
          Make another reservation
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <div>
          <Overline className="mb-4">Stay Details</Overline>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Check-in" required>
              <PubDatePicker value={form.checkIn} onChange={(v) => set("checkIn", v)} placeholder="Add date" />
            </FieldShell>
            <FieldShell label="Check-out" required>
              <PubDatePicker value={form.checkOut} min={form.checkIn} onChange={(v) => set("checkOut", v)} placeholder="Add date" />
            </FieldShell>
            <FieldShell label="Adults">
              <PubSelect value={form.adults} onChange={(v) => set("adults", v)} options={["1", "2", "3", "4"]} ariaLabel="Adults" />
            </FieldShell>
            <FieldShell label="Children">
              <PubSelect value={form.children} onChange={(v) => set("children", v)} options={["0", "1", "2", "3"]} ariaLabel="Children" />
            </FieldShell>
            <div className="sm:col-span-2">
              <FieldShell label="Room type">
                <PubSelect
                  value={selectedSlug}
                  onChange={(v) => set("roomType", v)}
                  options={roomTypes.map((r) => r.slug)}
                  labels={Object.fromEntries(
                    roomTypes.map((rt) => {
                      const avail = availData?.find((a) => a.slug === rt.slug);
                      const tag =
                        !datesValid || avail === undefined
                          ? ""
                          : avail.available === 0
                            ? " · Sold out"
                            : ` · ${avail.available} avail.`;
                      return [rt.slug, rt.name + tag];
                    }),
                  )}
                  ariaLabel="Room type"
                />
              </FieldShell>
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

      {/* ── Summary panel ── */}
      <div className="lg:col-span-5">
        <div className="sticky top-24 rounded-2xl border border-pub-line bg-pub-surface p-6">
          <Overline className="mb-4">Summary</Overline>
          <dl className="space-y-3 pub-body">
            <Row label="Room" value={room?.name ?? "—"} />
            <Row label="Dates" value={datesValid ? `${fmtDate(form.checkIn)} → ${fmtDate(form.checkOut)}` : "Select dates"} />
            <Row label="Nights" value={datesValid ? String(nights) : "—"} />
            <Row label="Guests" value={`${form.adults} adult(s), ${form.children} child(ren)`} />
            <div className="flex justify-between gap-4">
              <dt className="text-pub-ink-muted">Availability</dt>
              <dd className="text-right font-medium text-pub-ink">
                {!datesValid ? "Select dates" : checkingAvail ? (
                  <span className="inline-flex items-center gap-1.5 text-pub-ink-muted">
                    <Loader2 size={13} className="animate-spin" /> Checking…
                  </span>
                ) : available > 0 ? (
                  <span className="text-ok font-semibold">{available} room{available > 1 ? "s" : ""} available</span>
                ) : (
                  <span className="text-pub-danger">None for this type</span>
                )}
              </dd>
            </div>
          </dl>

          {datesValid && !checkingAvail && available === 0 && (
            <p className="mt-3 rounded-md bg-pub-stone px-3 py-2 pub-body-sm text-pub-ink-soft">
              This room type is fully booked for those dates. Try another room type or contact us for options.
            </p>
          )}

          <div className="mt-5 flex items-end justify-between border-t border-pub-line pt-5">
            <span className="pub-body-sm text-pub-ink-muted">Estimated total</span>
            <span className="pub-display-3">{estimate ? formatNaira(estimate) : "—"}</span>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-pub-danger/30 bg-pub-danger/5 px-3 py-2.5">
              <p className="pub-body-sm text-pub-danger">{error}</p>
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noreferrer"
                className="pub-underline mt-1 inline-block pub-body-sm text-pub-ink"
              >
                Send this request on WhatsApp instead
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedSlug || !datesValid || !form.name || !form.phone || (datesValid && !checkingAvail && available === 0) || submitting}
            className="mt-6 w-full rounded-full bg-pub-gold py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Sending request…" : "Request to Book"}
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
  label, value, onChange, type = "text", required, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; textarea?: boolean;
}) {
  return (
    <label className="block">
      <FieldSpan label={label} required={required} />
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </label>
  );
}

function FieldShell({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="block">
      <FieldSpan label={label} required={required} />
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FieldSpan({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="pub-body-sm font-medium text-pub-ink-soft">
      {label}
      {required && <span className="text-pub-gold-deep"> *</span>}
    </span>
  );
}
