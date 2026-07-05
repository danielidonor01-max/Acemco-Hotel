import type { Metadata } from "next";
import { Wifi, Coffee, ConciergeBell, ShieldCheck } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { RoomCard } from "@/components/public/cards";
import { Overline, PubButton } from "@/components/public/ui";
import { Reveal, RevealGroup, RevealItem } from "@/components/public/reveal";
import { getRoomTypes } from "@/lib/data/rooms";

export const metadata: Metadata = {
  title: "Rooms & Suites",
  description: "Four distinct room types, each finished with the same warm, tactile calm.",
};

const REASSURANCE = [
  { icon: Wifi, label: "Fast Wi-Fi" },
  { icon: Coffee, label: "Breakfast available" },
  { icon: ConciergeBell, label: "24-hour reception" },
  { icon: ShieldCheck, label: "Free cancellation" },
];

export default async function RoomsPage() {
  const roomTypes = await getRoomTypes();
  return (
    <>
      <Hero
        slot="rooms.hero"
        overline="Accommodations"
        title={<>Rooms &amp; <em>Suites</em></>}
        subtitle="From a serene king to a suite with room to breathe — find the stay that fits your journey."
      />

      <Section band="cream">
        <RevealGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((room) => (
            <RevealItem key={room.slug}>
              <RoomCard room={room} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* Reassurance strip */}
      <Section band="sand">
        <Reveal className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {REASSURANCE.map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-3 text-center">
              <r.icon size={28} strokeWidth={1.25} className="text-pub-gold-deep" />
              <span className="pub-body-sm font-medium text-pub-ink">{r.label}</span>
            </div>
          ))}
        </Reveal>
      </Section>

      <Section band="espresso">
        <div className="mx-auto max-w-2xl text-center">
          <Overline onDark className="mb-3">Ready when you are</Overline>
          <h2 className="pub-display-2 text-pub-on-dark">Check availability for your dates</h2>
          <div className="mt-8 flex justify-center">
            <PubButton href="/reservations" variant="pub-on-dark">Reserve a Room</PubButton>
          </div>
        </div>
      </Section>
    </>
  );
}
