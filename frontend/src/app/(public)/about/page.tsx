import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { EditorialSplit } from "@/components/public/editorial-split";
import { Overline } from "@/components/public/ui";
import { Reveal } from "@/components/public/reveal";
import { site } from "@/lib/cms";

export const metadata: Metadata = {
  title: "About",
  description: `The story and philosophy behind ${site.hotelName}.`,
};

export default function AboutPage() {
  return (
    <>
      <Hero
        slot="about.hero"
        overline="Our Story"
        title={<>A house with a <em>point of view</em></>}
        subtitle={`How ${site.hotelName} came to be, and the ideas that shape every stay.`}
      />

      <EditorialSplit
        slot="about.origin"
        direction="image-left"
        overline="The Beginning"
        heading={<>Built around <em>the guest</em></>}
        body={
          <>
            <p>
              We set out to make a hotel that felt less like a hotel and more like arriving somewhere
              that already knew you. Warm, unhurried, quietly excellent.
            </p>
            <p>
              Every decision — from the light in the rooms to the pace of service — is measured against
              a single question: does this make the stay better?
            </p>
          </>
        }
      />

      <Section band="espresso">
        <div className="mx-auto max-w-3xl text-center">
          <Overline onDark className="mb-6">Our Philosophy</Overline>
          <Reveal>
            <p className="pub-display-quote text-pub-on-dark">
              “Luxury is not excess. It is the absence of friction, and the presence of care.”
            </p>
          </Reveal>
        </div>
      </Section>

      <EditorialSplit
        slot="about.team"
        band="sand"
        direction="image-right"
        overline="The People"
        heading={<>Service that <em>anticipates</em></>}
        body={<p>Our team is small by design and trained to notice. Behind every seamless moment is a person who cared enough to get the detail right.</p>}
      />
    </>
  );
}
