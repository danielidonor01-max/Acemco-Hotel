"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, BedDouble, Search } from "lucide-react";
import { roomTypes } from "@/lib/cms";
import { cn } from "@/lib/utils";
import { PubDatePicker, PubSelect } from "./fields";

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
  const [roomType, setRoomType] = useState(defaultRoomType ?? "any");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("adults", String(adults));
    params.set("children", String(children));
    if (roomType && roomType !== "any") params.set("roomType", roomType);
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
        <PubDatePicker bare showIcon={false} value={checkIn} onChange={setCheckIn} placeholder="Add date" />
      </WField>
      <WField icon={CalendarDays} label="Check-out">
        <PubDatePicker bare showIcon={false} value={checkOut} min={checkIn || undefined} onChange={setCheckOut} placeholder="Add date" />
      </WField>
      <WField icon={Users} label="Guests">
        <div className="flex gap-2">
          <PubSelect
            bare
            ariaLabel="Adults"
            value={String(adults)}
            onChange={(v) => setAdults(Number(v))}
            options={["1", "2", "3", "4"]}
            labels={{ "1": "1 adult", "2": "2 adults", "3": "3 adults", "4": "4 adults" }}
          />
          <PubSelect
            bare
            ariaLabel="Children"
            value={String(children)}
            onChange={(v) => setChildren(Number(v))}
            options={["0", "1", "2", "3"]}
            labels={{ "0": "0 children", "1": "1 child", "2": "2 children", "3": "3 children" }}
          />
        </div>
      </WField>
      <WField icon={BedDouble} label="Room type">
        <PubSelect
          bare
          ariaLabel="Room type"
          value={roomType}
          onChange={setRoomType}
          options={["any", ...roomTypes.map((r) => r.slug)]}
          labels={{ any: "Any room", ...Object.fromEntries(roomTypes.map((r) => [r.slug, r.name])) }}
        />
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
    <div className="flex flex-col rounded-xl border border-pub-line px-3.5 py-2.5">
      <span className="pub-overline mb-1 inline-flex items-center gap-1.5 text-pub-ink-muted">
        <Icon size={13} className="text-pub-gold-deep" />
        {label}
      </span>
      {children}
    </div>
  );
}
