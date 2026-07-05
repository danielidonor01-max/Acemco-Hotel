import { sanityFetch, urlForImage, type SanityImageSource } from "../sanity";
import {
  offers as sampleOffers, testimonials as sampleTestimonials, amenities as sampleAmenities,
  gallerySlots as sampleGallery, site as sampleSite,
  type Offer, type Testimonial, type Amenity, type SiteSettings,
} from "../cms";

type WithImage<T> = T & { image?: SanityImageSource };

export async function getOffers(): Promise<Offer[]> {
  const rows = await sanityFetch<WithImage<Offer>[]>(
    `*[_type=="offer"]|order(order asc){ "id":_id, title, ribbon, validity, terms, image }`,
  );
  if (rows?.length) return rows.map((o) => ({ ...o, slot: urlForImage(o.image, 1280) }));
  return sampleOffers;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const rows = await sanityFetch<Testimonial[]>(`*[_type=="testimonial"]{ quote, name, origin }`);
  return rows?.length ? rows : sampleTestimonials;
}

export async function getAmenities(): Promise<Amenity[]> {
  const rows = await sanityFetch<WithImage<Amenity>[]>(
    `*[_type=="amenity"]|order(order asc){ title, overline, description, image }`,
  );
  if (rows?.length) return rows.map((a) => ({ ...a, slot: urlForImage(a.image) }));
  return sampleAmenities;
}

export async function getGalleryTiles(): Promise<{ ratio: "1/1" | "3/4"; slot: string | undefined }[]> {
  const rows = await sanityFetch<{ ratio: "1/1" | "3/4"; image?: SanityImageSource }[]>(
    `*[_type=="galleryImage"]|order(order asc){ ratio, image }`,
  );
  if (rows?.length) return rows.map((t) => ({ ratio: t.ratio ?? "1/1", slot: urlForImage(t.image, 1000) }));
  return sampleGallery;
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
  return urlForImage(row?.image, 2000);
}
