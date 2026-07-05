import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { DiningMenu } from "@/components/public/dining-menu";
import { Overline } from "@/components/public/ui";
import { Reveal } from "@/components/public/reveal";
import { venues, getVenue } from "@/lib/cms";
import { getVenue as getVenueData } from "@/lib/data/menus";

export function generateStaticParams() {
  return venues.map((v) => ({ venue: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ venue: string }>;
}): Promise<Metadata> {
  const { venue } = await params;
  const v = getVenue(venue);
  return { title: v ? v.name : "Dining", description: v?.story };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ venue: string }>;
}) {
  const { venue } = await params;
  const v = (await getVenueData(venue)) ?? getVenue(venue);
  if (!v) notFound();

  return (
    <>
      <Hero
        slot={`dining.${v.slug}.hero`}
        overline={v.overline}
        title={v.name}
        subtitle={v.story}
      />

      <Section band="cream">
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <Reveal>
            <Overline className="mb-2">The Menu</Overline>
            <h2 className="pub-display-2">On the {v.slug === "lounge" ? "list" : "table"} today</h2>
          </Reveal>
          <Reveal className="inline-flex items-center gap-2 pub-body text-pub-ink-soft">
            <Clock size={16} className="text-pub-gold-deep" />
            {v.hours}
          </Reveal>
        </div>

        <Reveal>
          <DiningMenu venue={v} />
        </Reveal>

        <p className="mt-12 pub-body-sm text-pub-ink-muted">
          Add items to your order and check out via WhatsApp — for room service, dial reception or note
          your room number at checkout. Prices are captured at order time.
        </p>
      </Section>
    </>
  );
}
