"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, BedDouble, Search } from "lucide-react";
import { roomTypes } from "@/lib/cms";
import { cn } from "@/lib/utils";

/**
 * BookingWidget (§15.7) — the signature conversion element and the first link
 * in the reservation↔ordering interlock. Carries the query to /reservations.
 */
export function BookingWidget({
  className,
  defaultRoomType,
}: {
  className?: string;
  defaultRoomType?: string;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomType, setRoomType] = useState(defaultRoomType ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("adults", String(adults));
    params.set("children", String(children));
    if (roomType) params.set("roomType", roomType);
    router.push(`/reservations?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "grid gap-4 rounded-2xl border border-pub-line bg-pub-surface p-5 shadow-[0_24px_60px_-24px_rgba(26,23,18,0.25)] md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end md:gap-3",
        className,
      )}
    >
      <WField icon={CalendarDays} label="Check-in">
        <input
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="w-full bg-transparent pub-body text-pub-ink focus:outline-none"
        />
      </WField>
      <WField icon={CalendarDays} label="Check-out">
        <input
          type="date"
          value={checkOut}
          min={checkIn || undefined}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-full bg-transparent pub-body text-pub-ink focus:outline-none"
        />
      </WField>
      <WField icon={Users} label="Guests">
        <div className="flex gap-2">
          <select
            aria-label="Adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full bg-transparent pub-body text-pub-ink focus:outline-none"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n} adult{n > 1 ? "s" : ""}</option>
            ))}
          </select>
          <select
            aria-label="Children"
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
            className="w-full bg-transparent pub-body text-pub-ink focus:outline-none"
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n} child{n !== 1 ? "ren" : ""}</option>
            ))}
          </select>
        </div>
      </WField>
      <WField icon={BedDouble} label="Room type">
        <select
          aria-label="Room type"
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
          className="w-full bg-transparent pub-body text-pub-ink focus:outline-none"
        >
          <option value="">Any room</option>
          {roomTypes.map((r) => (
            <option key={r.slug} value={r.slug}>{r.name}</option>
          ))}
        </select>
      </WField>

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-pub-gold px-6 py-3.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark md:h-[58px]"
      >
        <Search size={16} />
        Check Availability
      </button>
    </form>
  );
}

function WField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col rounded-xl border border-pub-line px-3.5 py-2.5">
      <span className="pub-overline mb-1 inline-flex items-center gap-1.5 text-pub-ink-muted">
        <Icon size={13} className="text-pub-gold-deep" />
        {label}
      </span>
      {children}
    </label>
  );
}
