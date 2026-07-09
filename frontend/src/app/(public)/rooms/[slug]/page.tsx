import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, BedDouble, Users, Maximize } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { Section, SectionHeading } from "@/components/public/section";
import { MediaFrame } from "@/components/public/media-frame";
import { RoomCard } from "@/components/public/cards";
import { BookingWidget } from "@/components/public/booking-widget";
import { Overline } from "@/components/public/ui";
import { Reveal, RevealGroup, RevealItem } from "@/components/public/reveal";
import { formatNaira } from "@/lib/utils";
import { roomTypes, getRoomType } from "@/lib/cms";
import { getRoomType as getRoomTypeData, getRoomTypes as getRoomTypesData } from "@/lib/data/rooms";
import { getHeroImage } from "@/lib/data/content";

export function generateStaticParams() {
  return roomTypes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = getRoomType(slug);
  return {
    title: room ? room.name : "Room",
    description: room?.summary,
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getRoomTypeData(slug);
  if (!room) notFound();

  const others = (await getRoomTypesData()).filter((r) => r.slug !== room.slug).slice(0, 3);
  const galleryCount = Math.max(0, room.gallerySlots - 1);
  const galleryImages = await Promise.all(
    Array.from({ length: galleryCount }).map((_, i) =>
      getHeroImage(`room.${room.slug}.gallery.${i + 1}`)
    )
  );

  return (
    <>
      <Hero
        slot={`room.${room.slug}.hero`}
        size="page"
        align="left"
        title={room.name}
      />

      {/* Overview + booking */}
      <Section band="cream">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <Overline className="mb-3">The Room</Overline>
            <p className="pub-body-lg pub-prose text-pub-ink-soft">{room.description}</p>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 pub-body text-pub-ink">
              <span className="inline-flex items-center gap-2"><BedDouble size={18} className="text-pub-gold-deep" /> {room.bedConfiguration}</span>
              <span className="inline-flex items-center gap-2"><Users size={18} className="text-pub-gold-deep" /> Up to {room.maxOccupancy} guests</span>
              <span className="inline-flex items-center gap-2"><Maximize size={18} className="text-pub-gold-deep" /> {room.sizeSqm} m²</span>
            </div>

            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {room.features.map((f) => (
                <li key={f} className="inline-flex items-center gap-2 pub-body text-pub-ink-soft">
                  <Check size={16} className="text-pub-gold-deep" /> {f}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="rounded-2xl border border-pub-line bg-pub-surface p-6">
              <p className="pub-body-sm text-pub-ink-muted">From</p>
              <p className="pub-display-2">
                {formatNaira(room.basePrice)}
                <span className="pub-body font-normal text-pub-ink-muted"> / night</span>
              </p>
              <div className="mt-6">
                <BookingWidget defaultRoomType={room.slug} className="border-0 p-0 shadow-none md:grid-cols-1 md:[&>button]:h-auto" />
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Gallery */}
      {galleryCount > 0 && (
        <Section band="sand">
          <SectionHeading overline="Gallery" heading={<>Inside the <em>{room.name}</em></>} />
          <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: galleryCount }).map((_, i) => (
              <RevealItem key={i}>
                <MediaFrame slot={`room.${room.slug}.gallery.${i + 1}`} src={galleryImages[i]} ratio="4/3" className="rounded-2xl" sizes="(max-width: 768px) 100vw, 33vw" />
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>
      )}

      {/* Other rooms */}
      <Section band="cream">
        <SectionHeading overline="Also Consider" heading={<>Other <em>rooms</em></>} />
        <RevealGroup className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {others.map((r) => (
            <RevealItem key={r.slug}>
              <RoomCard room={r} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>
    </>
  );
}
