import Link from "next/link";
import { Hero } from "@/components/public/hero";
import { Section, SectionHeading } from "@/components/public/section";
import { EditorialSplit } from "@/components/public/editorial-split";
import { RoomCard, ExperienceCard, OfferCard } from "@/components/public/cards";
import { BookingWidget } from "@/components/public/booking-widget";
import { TestimonialSection } from "@/components/public/testimonials";
import { GallerySection } from "@/components/public/gallery";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { PubButton, GhostLink, Overline } from "@/components/public/ui";
import { Reveal, RevealGroup, RevealItem } from "@/components/public/reveal";
import { getRoomTypes } from "@/lib/data/rooms";
import { getOffers, getTestimonials, getGalleryTiles, getAmenities, getSiteSettings } from "@/lib/data/content";

export default async function HomePage() {
  const [rooms, amenities, offers, testimonials, gallerySlots, siteSettings] = await Promise.all([
    getRoomTypes(),
    getAmenities(),
    getOffers(),
    getTestimonials(),
    getGalleryTiles(),
    getSiteSettings(),
  ]);
  const site = siteSettings;
  return (
    <>
      <Hero
        slot="home.hero"
        size="full"
        align="center"
        overline={`${site.city.split(",")[0]} · ${site.tagline}`}
        title={<>Rooms that feel <br className="hidden sm:block" />like <em>arrivals</em></>}
        subtitle="A warm, considered stay where every detail is quietly in your favour — from the light in your room to the last cocktail of the night."
        actions={
          <>
            <PubButton href="/reservations">Reserve a Room</PubButton>
            <PubButton href="/rooms" variant="pub-on-dark">Explore Rooms</PubButton>
          </>
        }
      />

      {/* Booking widget overlapping the hero */}
      <div className="relative z-30 bg-pub-bg">
        <div className="pub-container -mt-16 md:-mt-14">
          <BookingWidget />
        </div>
      </div>

      {/* Brand statement */}
      <Section band="cream">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Overline className="mb-4">Welcome to {site.hotelName}</Overline>
            <p className="pub-display-1">
              An unhurried kind of luxury, <em>close to everything</em> that matters in {site.city.split(",")[0]}.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Featured rooms */}
      <Section band="sand">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            overline="Our Accommodations"
            heading={<>Stay in a room that <em>knows you</em></>}
            intro="Four distinct room types, each finished with the same warm, tactile calm."
          />
          <Reveal>
            <GhostLink href="/rooms">View all rooms</GhostLink>
          </Reveal>
        </div>
        <RevealGroup className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rooms.slice(0, 3).map((room) => (
            <RevealItem key={room.slug}>
              <RoomCard room={room} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* Property story */}
      <EditorialSplit
        slot="home.story"
        direction="image-left"
        overline="The Property"
        heading={<>A house built <em>around the guest</em></>}
        body={
          <>
            <p>
              We designed {site.hotelName} the way we would design a home — around light, quiet, and
              the people who fill it. Nothing is louder than it needs to be.
            </p>
            <p>
              The result is a stay that feels effortless: intuitive service, spaces that invite you to
              linger, and a location that puts the best of the city within easy reach.
            </p>
          </>
        }
        cta={{ label: "Our story", href: "/about" }}
      />

      {/* Facilities */}
      <Section band="cream">
        <SectionHeading
          overline="Facilities"
          heading={<>Everything you need, <em>nothing you don&apos;t</em></>}
          align="center"
        />
        {/* Facilities fill the row (3 across on desktop). */}
        <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.slice(0, 3).map((a) => (
            <RevealItem key={a.title}>
              <ExperienceCard amenity={a} href="/facilities" />
            </RevealItem>
          ))}
        </RevealGroup>
        <div className="mt-10 text-center">
          <GhostLink href="/facilities">All facilities</GhostLink>
        </div>
      </Section>

      {/* Dining */}
      <EditorialSplit
        slot="home.dining"
        direction="image-right"
        band="sand"
        overline="Dining & Lounge"
        heading={<>The table is <em>where it begins</em></>}
        body={
          <>
            <p>
              Our kitchen leans on the market — what is best today shapes tonight&apos;s plate. When the
              light goes low, the Lounge takes over with considered cocktails and small plates.
            </p>
          </>
        }
        cta={{ label: "Explore dining", href: "/dining" }}
      />

      {/* Featured experience — espresso "dark chapter" */}
      <section className="relative flex min-h-[60vh] items-center overflow-hidden bg-pub-espresso text-pub-on-dark">
        <div className="pub-container relative z-20 py-20 text-center">
          <Reveal>
            <Overline onDark className="mb-4">The Rooftop</Overline>
            <p className="pub-display-1 mx-auto max-w-3xl text-pub-on-dark">
              An infinity edge above the city, <em>from sunrise to the last light</em>.
            </p>
            <div className="mt-8 flex justify-center">
              <PubButton href="/facilities" variant="pub-on-dark">Discover the rooftop</PubButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Events */}
      <Section band="cream">
        <SectionHeading overline="What's On" heading={<>Moments worth <em>gathering for</em></>} />
        <RevealGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {offers.map((o) => (
            <RevealItem key={o.id}>
              <OfferCard offer={o} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* Testimonials */}
      <TestimonialSection items={testimonials} />

      {/* Gallery teaser */}
      <Section band="cream">
        <SectionHeading overline="Gallery" heading={<>A closer <em>look</em></>} align="center" />
        <div className="mt-12">
          <GallerySection tiles={gallerySlots.slice(0, 8)} />
        </div>
        <div className="mt-10 text-center">
          <GhostLink href="/gallery">See the full gallery</GhostLink>
        </div>
      </Section>

      <NewsletterBand />
    </>
  );
}

function NewsletterBand() {
  return (
    <Section band="sand">
      <div className="mx-auto max-w-xl text-center">
        <Overline className="mb-3">Stay in Touch</Overline>
        <h2 className="pub-display-2">Quiet news, <em>worth reading</em></h2>
        <p className="pub-body mt-4 text-pub-ink-soft">
          Seasonal offers and the occasional note from the house. No noise.
        </p>
        <NewsletterForm />
        <p className="pub-body-sm mt-3 text-pub-ink-muted">
          We respect your inbox. <Link href="/privacy" className="pub-underline">Privacy</Link>.
        </p>
      </div>
    </Section>
  );
}
