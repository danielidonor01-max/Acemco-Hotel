import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section, SectionHeading } from "@/components/public/section";
import { ExperienceCard } from "@/components/public/cards";
import { GallerySection } from "@/components/public/gallery";
import { Reveal, RevealGroup, RevealItem } from "@/components/public/reveal";
import { venues, gallerySlots, site } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Dining & Lounge",
  description: "All-day dining and a lounge that comes alive after dark.",
};

export default function DiningPage() {
  return (
    <>
      <Hero
        slot="dining.hero"
        overline="Dining & Lounge"
        title={<>Where the day <em>slows down</em></>}
        subtitle="Two rooms, one philosophy: let the market lead, keep it warm, make it worth lingering over."
      />

      <Section band="cream">
        <SectionHeading
          overline="Two Venues"
          heading={<>Eat well, <em>drink better</em></>}
          intro={`From the market-led kitchen to a lounge built for the evening — every table at ${site.hotelName} is a considered one.`}
          align="center"
        />
        <RevealGroup className="mt-12 grid gap-6 md:grid-cols-2">
          {venues.map((v) => (
            <RevealItem key={v.slug}>
              <ExperienceCard
                amenity={{ title: v.name, overline: v.overline, description: v.story, slot: v.heroSlot }}
                href={`/dining/${v.slug}`}
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section band="sand">
        <SectionHeading overline="Gallery" heading={<>A taste of <em>the table</em></>} align="center" />
        <Reveal className="mt-12">
          <GallerySection tiles={gallerySlots.slice(0, 6)} />
        </Reveal>
      </Section>
    </>
  );
}
