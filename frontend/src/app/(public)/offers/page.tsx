import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { OfferCard } from "@/components/public/cards";
import { RevealGroup, RevealItem } from "@/components/public/reveal";
import { offers } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Offers",
  description: "Seasonal packages and reasons to stay a little longer.",
};

export default function OffersPage() {
  return (
    <>
      <Hero
        slot="offers.hero"
        overline="Offers & Packages"
        title={<>Reasons to <em>stay longer</em></>}
        subtitle="Thoughtful packages, seasonal rates, and a little extra when you plan ahead."
      />

      <Section band="cream">
        <RevealGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => (
            <RevealItem key={o.id}>
              <OfferCard offer={o} />
            </RevealItem>
          ))}
        </RevealGroup>
        <p className="mt-12 pub-body-sm text-pub-ink-muted">
          Offers are subject to availability and cannot be combined unless stated. Full terms provided at booking.
        </p>
      </Section>
    </>
  );
}
