import Link from "next/link";
import { BedDouble, Users, Maximize, ArrowUpRight } from "lucide-react";
import { MediaFrame } from "./media-frame";
import { Overline, GhostLink } from "./ui";
import { formatNaira } from "@/lib/utils";
import type { RoomType, Amenity, Offer } from "@/lib/cms";

/** RoomCard (§15.7). */
export function RoomCard({ room }: { room: RoomType }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-pub-line bg-pub-surface">
      <Link href={`/rooms/${room.slug}`} className="block">
        <MediaFrame
          slot={`room.${room.slug}.card`}
          ratio="4/5"
          src={room.heroSlot}
          alt={`${room.name} — ${room.tier}`}
          zoom
          overlay="scrim-bottom"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <Overline className="mb-2">{room.tier}</Overline>
        <h3 className="pub-display-3">
          <Link href={`/rooms/${room.slug}`}>{room.name}</Link>
        </h3>
        <p className="pub-body-sm mt-2 text-pub-ink-soft">{room.summary}</p>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 pub-body-sm text-pub-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble size={15} /> {room.bedConfiguration}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} /> Up to {room.maxOccupancy}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Maximize size={15} /> {room.sizeSqm} m²
          </span>
        </div>

        <div className="mt-6 flex items-end justify-between border-t border-pub-line pt-5">
          <div>
            <p className="pub-body-sm text-pub-ink-muted">From</p>
            <p className="pub-display-3">
              {formatNaira(room.basePrice)}
              <span className="pub-body-sm font-normal text-pub-ink-muted"> / night</span>
            </p>
          </div>
          <GhostLink href={`/rooms/${room.slug}`}>View details</GhostLink>
        </div>
      </div>
    </article>
  );
}

/** ExperienceCard / AmenityCard (§15.7). */
export function ExperienceCard({ amenity, href }: { amenity: Amenity; href?: string }) {
  const inner = (
    <>
      <MediaFrame
        slot={`amenity.${amenity.title}`}
        ratio="4/5"
        src={amenity.slot}
        alt={amenity.title}
        zoom
        overlay="scrim-bottom"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="p-6">
        <Overline className="mb-2">{amenity.overline}</Overline>
        <h3 className="pub-display-3 inline-flex items-center gap-2">
          {amenity.title}
          {href && <ArrowUpRight size={20} className="text-pub-gold-deep transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
        </h3>
        <p className="pub-body-sm mt-2 text-pub-ink-soft">{amenity.description}</p>
      </div>
    </>
  );

  const cls = "group flex flex-col overflow-hidden rounded-2xl border border-pub-line bg-pub-surface";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <article className={cls}>{inner}</article>
  );
}

/** OfferCard (§15.7). */
export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-pub-line bg-pub-surface">
      <div className="relative">
        <MediaFrame slot={`offer.${offer.id}`} ratio="4/5" src={offer.slot} alt={offer.title} zoom overlay="scrim-bottom" sizes="(max-width: 768px) 100vw, 33vw" />
        <span className="absolute left-4 top-4 z-20 rounded-full bg-pub-gold px-3 py-1 pub-overline text-pub-ink">
          {offer.ribbon}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="pub-display-3">{offer.title}</h3>
        <p className="pub-body-sm mt-1 text-pub-gold-deep">{offer.validity}</p>
        <p className="pub-body-sm mt-3 flex-1 text-pub-ink-soft">{offer.terms}</p>
        <div className="mt-5">
          <GhostLink href="/events">View event</GhostLink>
        </div>
      </div>
    </article>
  );
}
