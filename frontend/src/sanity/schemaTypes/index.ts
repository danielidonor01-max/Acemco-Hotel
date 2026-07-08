/**
 * AEHOP — Sanity content model.
 * Drop these into a Sanity Studio (`schema.types`). The field names/types match
 * the GROQ queries in `frontend/src/lib/data/content.ts` exactly, so content
 * flows into the site with no further wiring. Marketing content + imagery only
 * (no operational data — that lives in Postgres/Supabase).
 */
import { defineType, defineField, defineArrayMember } from "sanity";

/** Singleton: contact details + hours shown in the footer/site. */
const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({ name: "hotelName", type: "string" }),
    defineField({ name: "tagline", type: "string" }),
    defineField({ name: "phone", type: "string" }),
    defineField({ name: "whatsapp", type: "string", description: "E.164 without '+', e.g. 2348000000000" }),
    defineField({ name: "email", type: "string" }),
    defineField({ name: "address", type: "string" }),
    defineField({ name: "city", type: "string" }),
    defineField({
      name: "hours",
      type: "array",
      of: [defineArrayMember({ type: "object", fields: [
        defineField({ name: "label", type: "string" }),
        defineField({ name: "value", type: "string" }),
      ] })],
    }),
    defineField({
      name: "socials",
      type: "array",
      of: [defineArrayMember({ type: "object", fields: [
        defineField({ name: "label", type: "string" }),
        defineField({ name: "href", type: "url" }),
      ] })],
    }),
  ],
});

/** The public "Event" section (live music, brunches, tastings…). */
const event = defineType({
  name: "event",
  title: "Event",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string" }),
    defineField({ name: "ribbon", type: "string", description: "Cadence tag, e.g. 'Every Friday'" }),
    defineField({ name: "validity", type: "string", description: "When/where, e.g. 'Sundays · 11am'" }),
    defineField({ name: "terms", type: "text" }),
    defineField({ name: "image", type: "image", options: { hotspot: true }, description: "Recommended: Landscape image, e.g., 1200 x 800 px (3:2 aspect ratio) or 1200 x 675 px (16:9)." }),
    defineField({ name: "order", type: "number" }),
  ],
});

const testimonial = defineType({
  name: "testimonial",
  title: "Testimonial",
  type: "document",
  fields: [
    defineField({ name: "quote", type: "text" }),
    defineField({ name: "name", type: "string" }),
    defineField({ name: "origin", type: "string" }),
    defineField({ name: "order", type: "number" }),
  ],
});

/** Facilities cards (Swimming Pool, Gym). */
const amenity = defineType({
  name: "amenity",
  title: "Facility",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string" }),
    defineField({ name: "overline", type: "string" }),
    defineField({ name: "description", type: "text" }),
    defineField({ name: "image", type: "image", options: { hotspot: true }, description: "Recommended: Landscape image, e.g., 1200 x 800 px (3:2 aspect ratio)." }),
    defineField({ name: "order", type: "number" }),
  ],
});

const galleryImage = defineType({
  name: "galleryImage",
  title: "Gallery Image",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string" }),
    defineField({
      name: "category",
      type: "string",
      description: "Which gallery this image belongs to. 'Dining' images show on the Dining page; leave as General for the home gallery.",
      options: { list: [
        { title: "General (home)", value: "general" },
        { title: "Dining", value: "dining" },
        { title: "Rooms", value: "rooms" },
        { title: "Facilities", value: "facilities" },
      ] },
      initialValue: "general",
    }),
    defineField({ name: "ratio", type: "string", options: { list: ["1/1", "3/4"] }, initialValue: "1/1" }),
    defineField({ name: "image", type: "image", options: { hotspot: true }, description: "Recommended: Match the selected aspect ratio. 1000 x 1000 px for Square (1:1) or 900 x 1200 px for Portrait (3:4)." }),
    defineField({ name: "order", type: "number" }),
  ],
});

/**
 * Named media slots for heroes and editorial sections. `slot` must match the
 * MediaFrame slot string in the site. Known slots:
 *   home.hero · home.story · home.dining · rooms.hero · rooms.<slug>.hero
 *   dining.hero · dining.restaurant.hero · dining.lounge.hero
 *   facilities.hero · facilities.pool · facilities.gym
 *   gallery.hero · events.hero · about.hero · about.origin · about.team
 *   contact.hero · contact.map · reservations.hero
 */
const pageMedia = defineType({
  name: "pageMedia",
  title: "Page Media (hero / section image)",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", description: "Human label, e.g. 'Home hero'" }),
    defineField({ name: "slot", type: "string", description: "e.g. home.hero (see list in schema comments)" }),
    defineField({ name: "image", type: "image", options: { hotspot: true }, description: "Recommended: 1920 x 1080 px (16:9) for Heros; 1200 x 1200 px (1:1) for story splits; 600 x 1000 px (3:5) for Footer." }),
  ],
  preview: { select: { title: "title", subtitle: "slot", media: "image" } },
});

export const schemaTypes = [siteSettings, event, testimonial, amenity, galleryImage, pageMedia];
