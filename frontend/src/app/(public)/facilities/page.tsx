import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { EditorialSplit } from "@/components/public/editorial-split";
import { ExperienceCard } from "@/components/public/cards";
import { RevealGroup, RevealItem } from "@/components/public/reveal";
import { amenities } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Facilities",
  description: "A rooftop swimming pool and a 24-hour gym for a considered stay.",
};

export default function FacilitiesPage() {
  return (
    <>
      <Hero
        slot="facilities.hero"
        overline="The Hotel"
        title={<>Room to <em>do more</em></>}
        subtitle="A rooftop swimming pool and a fully equipped gym — a lift ride away."
      />

      <Section band="cream">
        <RevealGroup className="grid gap-6 md:grid-cols-2">
          {amenities.map((a) => (
            <RevealItem key={a.title}>
              <ExperienceCard amenity={a} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <EditorialSplit
        slot="facilities.pool"
        band="sand"
        direction="image-right"
        overline="Swimming Pool"
        heading={<>Above it all, <em>from dawn</em></>}
        body={<p>An infinity edge that looks out over the city — a place to swim at sunrise and to gather as the light fades. Towels, loungers, and a poolside menu are all seen to.</p>}
      />

      <EditorialSplit
        slot="facilities.gym"
        direction="image-left"
        overline="The Gym"
        heading={<>Move, on <em>your schedule</em></>}
        body={<p>A fully equipped fitness studio with cardio, free weights, and a view — open 24 hours, so your routine fits around your day, not the other way round.</p>}
      />
    </>
  );
}
