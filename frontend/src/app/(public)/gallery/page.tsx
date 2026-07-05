import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { GallerySection } from "@/components/public/gallery";
import { gallerySlots } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A closer look at the rooms, the dining, and the moments in between.",
};

// A fuller set of placeholder tiles for the dedicated gallery page.
const tiles = [...gallerySlots, ...gallerySlots].map((t, i) => ({
  ...t,
  ratio: (i % 3 === 0 ? "3/4" : "1/1") as "1/1" | "3/4",
}));

export default function GalleryPage() {
  return (
    <>
      <Hero
        slot="gallery.hero"
        overline="Gallery"
        title={<>A closer <em>look</em></>}
        subtitle="The rooms, the table, the rooftop — and the quiet moments in between."
      />
      <Section band="cream">
        <GallerySection tiles={tiles} />
      </Section>
    </>
  );
}
