import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { OfferCard } from "@/components/public/cards";
import { RevealGroup, RevealItem } from "@/components/public/reveal";
import { getOffers } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "Events",
  description: "Live music, brunches, tastings, and celebrations at Acemco.",
};

export default async function EventsPage() {
  const events = await getOffers();
  return (
    <>
      <Hero
        slot="events.hero"
        title={<>Moments worth <em>gathering for</em></>}
      />

      <Section band="cream">
        <RevealGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <RevealItem key={e.id}>
              <OfferCard offer={e} />
            </RevealItem>
          ))}
        </RevealGroup>
        <p className="mt-12 pub-body-sm text-pub-ink-muted">
          Event schedules are subject to change. Contact us to reserve a table or enquire about private events.
        </p>
      </Section>
    </>
  );
}
