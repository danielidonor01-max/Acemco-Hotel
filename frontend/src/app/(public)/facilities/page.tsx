import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { EditorialSplit } from "@/components/public/editorial-split";
import { ExperienceCard } from "@/components/public/cards";
import { RevealGroup, RevealItem } from "@/components/public/reveal";
import { amenities } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Facilities",
  description: "Everything you need for a considered stay — pool, spa, dining, meetings, and more.",
};

export default function FacilitiesPage() {
  return (
    <>
      <Hero
        slot="facilities.hero"
        overline="The Hotel"
        title={<>Room to <em>do more</em></>}
        subtitle="A rooftop pool, a quiet spa, spaces to meet and to move — all a lift ride away."
      />

      <Section band="cream">
        <RevealGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {amenities.map((a) => (
            <RevealItem key={a.title}>
              <ExperienceCard amenity={a} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <EditorialSplit
        slot="facilities.rooftop"
        band="sand"
        direction="image-right"
        overline="The Rooftop Pool"
        heading={<>Above it all, <em>from dawn</em></>}
        body={<p>An infinity edge that looks out over the city — a place to swim at sunrise and to gather as the light fades. Towels, loungers, and a poolside menu are all seen to.</p>}
      />

      <EditorialSplit
        slot="facilities.spa"
        direction="image-left"
        overline="Wellness & Spa"
        heading={<>A quiet place to <em>reset</em></>}
        body={<p>Treatment rooms, a steam suite, and a calm you can feel the moment you step in. Book a treatment at reception or with your stay.</p>}
      />
    </>
  );
}
