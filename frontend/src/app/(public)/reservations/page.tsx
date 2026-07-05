import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { ReservationForm } from "@/components/public/reservation-form";

export const metadata: Metadata = {
  title: "Reserve a Room",
  description: "Check availability and request your stay in a few steps.",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return (
    <>
      <Hero
        slot="reservations.hero"
        size="page"
        overline="Reservations"
        title={<>Begin your <em>stay</em></>}
        subtitle="Tell us your dates and we'll confirm availability and hold your room."
      />

      <Section band="cream">
        <ReservationForm
          initial={{
            checkIn: first(sp.checkIn),
            checkOut: first(sp.checkOut),
            adults: first(sp.adults),
            children: first(sp.children),
            roomType: first(sp.roomType),
          }}
        />
      </Section>
    </>
  );
}
