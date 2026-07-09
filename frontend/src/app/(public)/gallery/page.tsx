import type { Metadata } from "next";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { GallerySection } from "@/components/public/gallery";
import { getGalleryTiles } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A closer look at the rooms, the dining, and the moments in between.",
};

export default async function GalleryPage() {
  // The full gallery — every image across all categories.
  const tiles = await getGalleryTiles();
  return (
    <>
      <Hero
        slot="gallery.hero"
        title={<>A closer <em>look</em></>}
      />
      <Section band="cream">
        <GallerySection tiles={tiles} />
      </Section>
    </>
  );
}
