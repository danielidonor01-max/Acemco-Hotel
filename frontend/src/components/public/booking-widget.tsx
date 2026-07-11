"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Users, BedDouble, Search, Loader2 } from "lucide-react";
import { getPublicAvailability } from "@/lib/data/public-booking";
import { getRoomTypes } from "@/lib/data/rooms";
import { cn } from "@/lib/utils";
import { PubDatePicker, PubSelect } from "./fields";

/**
 * BookingWidget — the signature conversion element on the homepage and rooms page.
 * Carries the query to /reservations. When both dates are filled, also fetches
 * live availability counts and annotates the room type dropdown accordingly.
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

  const datesValid =
    checkIn && checkOut && new Date(checkOut) > new Date(checkIn);

  // The bookable catalogue, live from the API — never the static sample, or the
  // guest could pick a room the hotel doesn't offer (and the booking would fail).
  const { data: roomTypes = [] } = useQuery({
    queryKey: ["public-room-types"],
    queryFn: getRoomTypes,
    staleTime: 300_000,
  });

  // Fetch live availability once both dates are set — soft, non-blocking.
  const { data: availData, isFetching } = useQuery({
    queryKey: ["widget-availability", checkIn, checkOut],
    queryFn: () => getPublicAvailability(checkIn, checkOut),
    enabled: Boolean(datesValid),
    staleTime: 60_000,
  });

  /** Build room type option labels — annotate with live availability when known. */
  const roomTypeLabels = Object.fromEntries(
    roomTypes.map((rt) => {
      const avail = availData?.find((a) => a.slug === rt.slug);
      let tag = "";
      if (datesValid && avail !== undefined) {
        tag = avail.available === 0 ? " · Sold out" : ` · ${avail.available} left`;
      }
      return [rt.slug, rt.name + tag];
    }),
  );

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
      <WField
        icon={BedDouble}
        label={
          <span className="inline-flex items-center gap-1.5">
            Room type
            {isFetching && <Loader2 size={11} className="animate-spin text-pub-gold-deep" />}
          </span>
        }
      >
        <PubSelect
          bare
          ariaLabel="Room type"
          value={roomType}
          onChange={setRoomType}
          options={["any", ...roomTypes.map((r) => r.slug)]}
          labels={{ any: "Any room", ...roomTypeLabels }}
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
  label: React.ReactNode;
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
