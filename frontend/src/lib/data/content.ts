import { sanityFetch, urlForImage, type SanityImageSource } from "../sanity";
import {
  offers as sampleOffers, testimonials as sampleTestimonials, amenities as sampleAmenities,
  gallerySlots as sampleGallery, site as sampleSite,
  type Offer, type Testimonial, type Amenity, type SiteSettings,
} from "../cms";

type WithImage<T> = T & { image?: SanityImageSource };

/** Default fallback images for named slots when CMS is unpopulated. */
export function getDefaultImageForSlot(slot: string): string | undefined {
  const defaults: Record<string, string> = {
    "home.hero": "/images/lobby.png",
    "home.story": "/images/rooms/family.png",
    "home.dining": "/images/dining/restaurant.png",
    "rooms.hero": "/images/facade.png",
    "rooms.deluxe-king.hero": "/images/rooms/deluxe.png",
    "rooms.twin-classic.hero": "/images/rooms/twin.png",
    "rooms.executive-suite.hero": "/images/rooms/executive.png",
    "rooms.garden-family.hero": "/images/rooms/family.png",
    "dining.hero": "/images/dining/restaurant.png",
    "dining.restaurant.hero": "/images/dining/restaurant.png",
    "dining.lounge.hero": "/images/dining/lounge.png",
    "facilities.hero": "/images/facade.png",
    "facilities.pool": "/images/amenities/pool.png",
    "facilities.gym": "/images/amenities/gym.png",
    "facilities.hall": "/images/lobby.png",
    "gallery.hero": "/images/lobby.png",
    "events.hero": "/images/dining/lounge.png",
    "about.hero": "/images/facade.png",
    "about.origin": "/images/lobby.png",
    "about.team": "/images/lobby.png",
    "contact.hero": "/images/facade.png",
    "contact.map": "/images/map.png",
    "reservations.hero": "/images/facade.png",
    "nav.featured": "/images/lobby.png",
    "footer.image": "/images/facade.png",
    "amenity.Swimming Pool": "/images/amenities/pool.png",
    "amenity.Gym": "/images/amenities/gym.png",
    "amenity.Hall": "/images/lobby.png",
    "offer.o-1": "/images/dining/lounge.png",
    "offer.o-2": "/images/amenities/pool.png",
    "offer.o-3": "/images/dining/restaurant.png",
  };

  if (defaults[slot]) return defaults[slot];

  // Dynamic matching for room gallery slots, e.g., room.deluxe-king.gallery.1
  if (slot.startsWith("room.")) {
    const parts = slot.split(".");
    const slug = parts[1];
    const isGallery = parts[2] === "gallery";
    if (isGallery) {
      const type = slug.split("-")[0];
      if (type === "deluxe") return "/images/rooms/deluxe.png";
      if (type === "twin") return "/images/rooms/twin.png";
      if (type === "executive") return "/images/rooms/executive.png";
      return "/images/rooms/family.png";
    }
  }

  // Dynamic matching for gallery slots, e.g., gallery.1
  if (slot.startsWith("gallery.")) {
    const parts = slot.split(".");
    const idx = parseInt(parts[1], 10);
    if (!isNaN(idx)) {
      const galleryDefaults = [
        "/images/rooms/deluxe.png",
        "/images/rooms/twin.png",
        "/images/rooms/executive.png",
        "/images/rooms/family.png",
        "/images/amenities/pool.png",
        "/images/amenities/gym.png",
        "/images/lobby.png",
        "/images/facade.png",
      ];
      return galleryDefaults[(idx - 1) % galleryDefaults.length];
    }
  }

  return undefined;
}

/** Events (the public "Event" section). Sanity type: `event`. */
export async function getOffers(): Promise<Offer[]> {
  const rows = await sanityFetch<WithImage<Offer>[]>(
    `*[_type=="event"]|order(order asc){ "id":_id, title, ribbon, validity, terms, image }`,
  );
  if (rows?.length) return rows.map((o) => ({ ...o, slot: urlForImage(o.image, 1280) ?? getDefaultImageForSlot(`offer.${o.id}`) }));
  return sampleOffers;
}

/**
 * Guest reviews — real ones or none at all.
 *
 * This used to fall back to three invented quotes attributed to invented people
 * ("Adaeze O. — Lagos", …), which rendered on the homepage as genuine "Guest
 * Voices". Fabricated reviews are indistinguishable from real ones to a visitor,
 * so an empty CMS now yields an empty list and the section hides itself.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  const rows = await sanityFetch<Testimonial[]>(`*[_type=="testimonial"]{ quote, name, origin }`);
  return rows?.length ? rows : [];
}

export async function getAmenities(): Promise<Amenity[]> {
  const rows = await sanityFetch<WithImage<Amenity>[]>(
    `*[_type=="amenity"]|order(order asc){ title, overline, description, image }`,
  );
  if (rows?.length) return rows.map((a) => ({ ...a, slot: urlForImage(a.image) ?? getDefaultImageForSlot(`amenity.${a.title}`) }));
  return sampleAmenities;
}

export async function getGalleryTiles(category?: string): Promise<{ ratio: "1/1" | "3/4"; slot: string | undefined }[]> {
  // "general" is the home ("A closer look") bucket — it also picks up any images
  // that haven't been categorised yet, so nothing disappears before classification.
  // Other categories (dining/rooms/facilities) match strictly. No category = all.
  const params: Record<string, unknown> = {};
  let filter = "";
  if (category === "general") {
    filter = ` && (!defined(category) || category=="general")`;
  } else if (category) {
    filter = " && category==$category";
    params.category = category;
  }
  const rows = await sanityFetch<{ ratio: "1/1" | "3/4"; image?: SanityImageSource }[]>(
    `*[_type=="galleryImage"${filter}]|order(order asc){ ratio, image }`,
    params,
  );
  if (rows?.length) return rows.map((t, idx) => ({ ratio: t.ratio ?? "1/1", slot: urlForImage(t.image, 1000) ?? getDefaultImageForSlot(`gallery.${idx + 1}`) }));
  // A specific (empty) category returns [] so the caller can fall back; the full
  // gallery (no category) falls back to sample tiles.
  return category ? [] : sampleGallery;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await sanityFetch<SiteSettings>(
    `*[_type=="siteSettings"][0]{ hotelName, tagline, phone, whatsapp, email, address, city, hours, socials }`,
  );
  return row ?? sampleSite;
}

/** Resolve a named hero/section image slot from Sanity (undefined → placeholder). */
export async function getHeroImage(slot: string): Promise<string | undefined> {
  const row = await sanityFetch<{ image?: SanityImageSource }>(
    `*[_type=="pageMedia" && slot==$slot][0]{ image }`,
    { slot },
  );
  return urlForImage(row?.image, 2000) ?? getDefaultImageForSlot(slot);
}
