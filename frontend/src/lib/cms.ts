/**
 * CMS content layer for the public website.
 *
 * Per the UI Constitution §15.5, the site is CMS-driven: **every image is a
 * placeholder**. Media fields below are intentionally left `undefined` — each
 * <MediaFrame> renders a dignified placeholder keyed by its `slot`. When the
 * CMS is wired up, these objects are replaced by API responses of the same shape.
 *
 * Types mirror the Domain Model (RoomType, MenuItem, SpecialOffer, etc.).
 */

export type MediaKey = string | undefined;

export interface SiteSettings {
  hotelName: string;
  tagline: string;
  phone: string;
  whatsapp: string; // E.164 without '+', for wa.me links
  email: string;
  address: string;
  city: string;
  hours: { label: string; value: string }[];
  socials: { label: string; href: string }[];
}

/**
 * Fallback used only when Sanity's `siteSettings` document is unpopulated.
 *
 * It carries NO invented contact details. It used to fall back to a placeholder
 * phone (+234 800 000 0000), a fake WhatsApp number, a mailbox on a domain the
 * hotel doesn't own, and social links pointing at "#". Those rendered as real,
 * clickable contact points — a guest could genuinely try to call a stranger, and
 * the reservation form's WhatsApp handoff sent bookings into the void. Blank
 * means the UI hides the link rather than lying about it.
 */
export const site: SiteSettings = {
  hotelName: "Acemco Express",
  tagline: "Holiday Inn",
  phone: "",
  whatsapp: "",
  email: "",
  address: "12 Marina Crescent",
  city: "Warri, Delta State, Nigeria",
  hours: [
    { label: "Reception", value: "24 hours" },
    { label: "Restaurant", value: "07:00 – 23:00" },
    { label: "Lounge", value: "16:00 – 02:00" },
  ],
  socials: [],
};

export interface RoomType {
  slug: string;
  name: string;
  tier: string; // overline
  summary: string;
  description: string;
  bedConfiguration: string;
  maxOccupancy: number;
  sizeSqm: number;
  basePrice: number;
  features: string[];
  heroSlot: MediaKey;
  gallerySlots: number; // count of placeholder gallery tiles
}

export const roomTypes: RoomType[] = [
  {
    slug: "deluxe-king",
    name: "Deluxe King",
    tier: "Signature Comfort",
    summary: "A serene king retreat with city views and a marble bath.",
    description:
      "Our most-requested room pairs a plush king bed with a quiet sitting nook and floor-to-ceiling windows. Wake to soft light, unwind to the city at dusk.",
    bedConfiguration: "1 King Bed",
    maxOccupancy: 2,
    sizeSqm: 32,
    basePrice: 65000,
    features: ["City view", "Marble bath", "Fast Wi-Fi", "Work desk", "Smart TV", "Rain shower"],
    heroSlot: "/images/rooms/deluxe.png",
    gallerySlots: 4,
  },
  {
    slug: "twin-classic",
    name: "Twin Classic",
    tier: "For Two Journeys",
    summary: "Two considered beds, warm textures, and everything close at hand.",
    description:
      "Designed for colleagues and companions, the Twin Classic offers two full beds without compromising on the calm, tactile finish that defines every Acemco room.",
    bedConfiguration: "2 Twin Beds",
    maxOccupancy: 2,
    sizeSqm: 30,
    basePrice: 58000,
    features: ["Garden view", "Fast Wi-Fi", "Work desk", "Smart TV", "Tea & coffee"],
    heroSlot: "/images/rooms/twin.png",
    gallerySlots: 4,
  },
  {
    slug: "executive-suite",
    name: "Executive Suite",
    tier: "Room to Arrive",
    summary: "A separate living room, a private bar, and the best light in the house.",
    description:
      "The Executive Suite is a home for longer stays and slower mornings — a distinct lounge, a generous bedroom, and a bath that invites you to linger.",
    bedConfiguration: "1 King Bed + Sofa",
    maxOccupancy: 3,
    sizeSqm: 58,
    basePrice: 120000,
    features: ["Separate lounge", "Private bar", "City view", "Rain shower", "Fast Wi-Fi", "Nespresso"],
    heroSlot: "/images/rooms/executive.png",
    gallerySlots: 6,
  },
  {
    slug: "garden-family",
    name: "Garden Family Room",
    tier: "Together, Unhurried",
    summary: "Space for the whole party, opening onto the courtyard garden.",
    description:
      "A flexible layout for families, with a king and two singles, opening directly onto the courtyard so mornings begin with birdsong and shade.",
    bedConfiguration: "1 King + 2 Single Beds",
    maxOccupancy: 4,
    sizeSqm: 48,
    basePrice: 95000,
    features: ["Courtyard access", "Family layout", "Fast Wi-Fi", "Two Smart TVs", "Tea & coffee"],
    heroSlot: "/images/rooms/family.png",
    gallerySlots: 4,
  },
];

export function getRoomType(slug: string): RoomType | undefined {
  return roomTypes.find((r) => r.slug === slug);
}

export interface Amenity {
  title: string;
  overline: string;
  description: string;
  slot: MediaKey;
  comingSoon?: boolean;
}

export const amenities: Amenity[] = [
  { title: "Swimming Pool", overline: "Leisure", description: "A serene swimming pool with loungers and a poolside menu — open from sunrise to the last light.", slot: "/images/amenities/pool.png" },
  { title: "Gym", overline: "Wellness", description: "A fully equipped fitness studio, arriving soon.", slot: "/images/amenities/gym.png", comingSoon: true },
  { title: "Hall", overline: "Events", description: "A versatile event hall for weddings, conferences, and celebrations — styled to your occasion.", slot: "/images/lobby.png" },
];

export type Storefront = "RESTAURANT" | "LOUNGE";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
  isAvailable: boolean;
  isHidden: boolean;
  slot: MediaKey;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Venue {
  slug: "restaurant" | "lounge";
  storefront: Storefront;
  name: string;
  overline: string;
  story: string;
  hours: string;
  heroSlot: MediaKey;
  categories: MenuCategory[];
}

export const venues: Venue[] = [
  {
    slug: "restaurant",
    storefront: "RESTAURANT",
    name: "The Restaurant",
    overline: "All-Day Dining",
    story:
      "A room built around the table. Our kitchen leans on the market — what is best today shapes what reaches your plate tonight.",
    hours: "07:00 – 23:00 daily",
    heroSlot: "/images/dining/restaurant.png",
    categories: [
      {
        id: "starters",
        name: "Starters",
        items: [
          { id: "r-1", name: "Pepper Soup, Catfish", description: "Aromatic broth, scent leaf, fresh catfish.", price: 6500, tags: ["Spicy"], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
          { id: "r-2", name: "Suya Beef Skewers", description: "Charred, dusted with yaji, red onion.", price: 7000, tags: ["Spicy"], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
          { id: "r-3", name: "Garden Salad", description: "Leaves, avocado, citrus dressing.", price: 5000, tags: ["Vegetarian"], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
        ],
      },
      {
        id: "mains",
        name: "Mains",
        items: [
          { id: "r-4", name: "Jollof Rice & Grilled Chicken", description: "Smoky party jollof, chicken, plantain.", price: 9500, tags: [], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
          { id: "r-5", name: "Seared Barramundi", description: "Coconut sauce, greens, jasmine rice.", price: 14000, tags: [], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
          { id: "r-6", name: "Egusi & Pounded Yam", description: "Melon seed stew, assorted, pounded yam.", price: 11000, tags: [], isAvailable: false, isHidden: false, slot: "/images/dining/restaurant.png" },
          { id: "r-7", name: "Ribeye, Pepper Glaze", description: "300g grass-fed, ata rodo glaze, fries.", price: 21000, tags: ["Spicy"], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
        ],
      },
      {
        id: "desserts",
        name: "Desserts",
        items: [
          { id: "r-8", name: "Coconut Panna Cotta", description: "Passionfruit, toasted coconut.", price: 5500, tags: ["Vegetarian"], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
          { id: "r-9", name: "Chocolate Fondant", description: "Warm centre, vanilla ice cream.", price: 6000, tags: ["Vegetarian"], isAvailable: true, isHidden: false, slot: "/images/dining/restaurant.png" },
        ],
      },
    ],
  },
  {
    slug: "lounge",
    storefront: "LOUNGE",
    name: "The Lounge",
    overline: "Cocktails & Small Plates",
    story:
      "When the light goes low, the Lounge comes alive — considered cocktails, a short vinyl list, and plates made for sharing.",
    hours: "16:00 – 02:00 daily",
    heroSlot: "/images/dining/lounge.png",
    categories: [
      {
        id: "signatures",
        name: "Signatures",
        items: [
          { id: "l-1", name: "Marina Sundown", description: "Aged rum, hibiscus, lime, bitters.", price: 8000, tags: [], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
          { id: "l-2", name: "Smoked Old Fashioned", description: "Bourbon, cane sugar, oak smoke.", price: 9000, tags: [], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
          { id: "l-3", name: "Zobo Spritz", description: "Hibiscus, sparkling, citrus. Zero proof.", price: 5500, tags: ["Zero-proof"], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
        ],
      },
      {
        id: "small-plates",
        name: "Small Plates",
        items: [
          { id: "l-4", name: "Peppered Snails", description: "Bell pepper, onion, scotch bonnet.", price: 8500, tags: ["Spicy"], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
          { id: "l-5", name: "Plantain & Dip", description: "Crisp plantain, smoked pepper dip.", price: 4500, tags: ["Vegetarian"], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
          { id: "l-6", name: "Chapman Wings", description: "Glazed, sesame, spring onion.", price: 7500, tags: [], isAvailable: true, isHidden: false, slot: "/images/dining/lounge.png" },
        ],
      },
    ],
  },
];

export function getVenue(slug: string): Venue | undefined {
  return venues.find((v) => v.slug === slug);
}

export interface Offer {
  id: string;
  title: string;
  ribbon: string;
  validity: string;
  terms: string;
  slot: MediaKey;
}

// Events (the public "Event" section). CMS-managed; sample content until populated.
export const offers: Offer[] = [
  { id: "o-1", title: "Live Jazz Nights", ribbon: "Every Friday", validity: "From 8:00 PM · The Lounge", terms: "An intimate evening of live jazz, signature cocktails, and small plates.", slot: "/images/dining/lounge.png" },
  { id: "o-2", title: "Sunday Poolside Brunch", ribbon: "Weekly", validity: "Sundays · 11:00 AM – 3:00 PM", terms: "A leisurely poolside brunch buffet with free-flowing mimosas.", slot: "/images/amenities/pool.png" },
  { id: "o-3", title: "Wine & Dine Tasting", ribbon: "Monthly", validity: "Last Saturday of the month", terms: "A curated five-course dinner paired with fine wines by our sommelier.", slot: "/images/dining/restaurant.png" },
];

export interface Testimonial {
  quote: string;
  name: string;
  origin: string;
}

/** Gallery tiles — mixed ratios per §15.5. All placeholders. */
export const gallerySlots: { ratio: "1/1" | "3/4"; slot: MediaKey }[] = [
  { ratio: "3/4", slot: "/images/rooms/deluxe.png" },
  { ratio: "1/1", slot: "/images/rooms/twin.png" },
  { ratio: "1/1", slot: "/images/rooms/executive.png" },
  { ratio: "3/4", slot: "/images/rooms/family.png" },
  { ratio: "1/1", slot: "/images/amenities/pool.png" },
  { ratio: "3/4", slot: "/images/amenities/gym.png" },
  { ratio: "3/4", slot: "/images/lobby.png" },
  { ratio: "1/1", slot: "/images/facade.png" },
];
