import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { EditorialSplit } from "@/components/public/editorial-split";
import { ExperienceCard } from "@/components/public/cards";
import { RevealGroup, RevealItem } from "@/components/public/reveal";
import { amenities } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Facilities",
  description: "A serene swimming pool and a versatile event hall for a considered stay.",
};

export default function FacilitiesPage() {
  return (
    <>
      <Hero
        slot="facilities.hero"
        title={<>Room to <em>do more</em></>}
      />

      <Section band="cream">
        <RevealGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        heading={<>A quiet swim, <em>from dawn</em></>}
        body={<p>A serene pool to start the morning or unwind as the light fades. Towels, loungers, and a poolside menu are all seen to.</p>}
      />

      <EditorialSplit
        slot="facilities.gym"
        direction="image-left"
        overline="The Gym · Coming soon"
        heading={<>A studio, <em>on the way</em></>}
        body={<p>A fully equipped fitness studio — cardio, free weights, and more — is coming soon to Acemco. We&apos;ll share the opening date shortly.</p>}
      />

      <EditorialSplit
        slot="facilities.hall"
        band="sand"
        direction="image-right"
        overline="The Hall"
        heading={<>A room for <em>every occasion</em></>}
        body={<p>A versatile event hall for weddings, conferences, and celebrations — flexible seating, full AV, and a dedicated team to style the space around your day. Talk to us about your event.</p>}
      />
    </>
  );
}
