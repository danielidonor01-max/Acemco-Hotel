# AEHOP — Sanity CMS

Marketing content + imagery for the public website. Project **`nykyv901`**, dataset
**`production`**. Operational data (rooms, availability, menus, reservations, orders)
lives in Postgres/Supabase, **never** here.

## Set up a Studio

```bash
npm create sanity@latest -- --project nykyv901 --dataset production --template clean
# then in the studio's sanity.config.ts, use these schema types:
```

```ts
import { schemaTypes } from "../sanity/schemaTypes"; // this folder
export default defineConfig({
  projectId: "nykyv901",
  dataset: "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
```

Run `sanity deploy` (or `npm run dev`) and start adding content.

## Content model → where it appears

| Type | Appears on | Notes |
|---|---|---|
| `siteSettings` (one doc) | Footer, contact | hotelName, phone, whatsapp, hours, socials |
| `event` | `/events` + Home "What's On" | title, ribbon, validity, terms, image, order |
| `testimonial` | Home testimonials | quote, name, origin, order |
| `amenity` | `/facilities` + Home | Swimming Pool, Gym — title, overline, description, image |
| `galleryImage` | `/gallery` | ratio `1/1` or `3/4`, image, order |
| `pageMedia` | **every hero + editorial image** | `slot` matches the site's MediaFrame slots |

### `pageMedia` slots
Create one `pageMedia` doc per image, setting `slot` to one of:

```
home.hero · home.story · home.dining
rooms.hero · rooms.deluxe-king.hero · rooms.twin-classic.hero
rooms.executive-suite.hero · rooms.garden-family.hero
dining.hero · dining.restaurant.hero · dining.lounge.hero
facilities.hero · facilities.pool · facilities.gym
gallery.hero · events.hero · about.hero · about.origin · about.team
contact.hero · contact.map · reservations.hero
```

## How it reaches the site
`frontend/src/lib/data/content.ts` queries these types with GROQ and resolves images
via `@sanity/image-url`. Until a document exists for a given slot/type, the site shows a
dignified placeholder (never a broken image). No redeploy needed — content is fetched live.

The frontend env already points at this project:
```
NEXT_PUBLIC_SANITY_PROJECT_ID=nykyv901
NEXT_PUBLIC_SANITY_DATASET=production
```
