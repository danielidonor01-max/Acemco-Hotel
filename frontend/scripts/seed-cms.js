const fs = require("fs");
const path = require("path");
const { createClient } = require("@sanity/client");

// Load local env vars if possible
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env.local") });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "nykyv901";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_WRITE_TOKEN;

if (!token) {
  console.error("Error: SANITY_WRITE_TOKEN is not set.");
  console.error("Please create a Write token at https://sanity.io/manage and run the script with it.");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

async function uploadImage(relativePath) {
  const filePath = path.resolve(__dirname, "..", relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: Local file not found at ${filePath}`);
    return null;
  }
  try {
    console.log(`Uploading ${relativePath}...`);
    const fileStream = fs.createReadStream(filePath);
    const asset = await client.assets.upload("image", fileStream, {
      filename: path.basename(filePath),
    });
    console.log(`Uploaded ${relativePath} -> ${asset._id}`);
    return asset;
  } catch (error) {
    console.error(`Failed to upload ${relativePath}:`, error.message);
    return null;
  }
}

async function seed() {
  console.log("Starting Sanity CMS seeding...");
  console.log(`Project: ${projectId} | Dataset: ${dataset}`);

  // 1. Upload all default images
  const facade = await uploadImage("public/images/facade.png");
  const lobby = await uploadImage("public/images/lobby.png");
  const deluxe = await uploadImage("public/images/rooms/deluxe.png");
  const twin = await uploadImage("public/images/rooms/twin.png");
  const executive = await uploadImage("public/images/rooms/executive.png");
  const family = await uploadImage("public/images/rooms/family.png");
  const restaurant = await uploadImage("public/images/dining/restaurant.png");
  const lounge = await uploadImage("public/images/dining/lounge.png");
  const pool = await uploadImage("public/images/amenities/pool.png");
  const gym = await uploadImage("public/images/amenities/gym.png");
  const map = await uploadImage("public/images/map.png");

  const imageRefs = {
    facade: facade?._id,
    lobby: lobby?._id,
    deluxe: deluxe?._id,
    twin: twin?._id,
    executive: executive?._id,
    family: family?._id,
    restaurant: restaurant?._id,
    lounge: lounge?._id,
    pool: pool?._id,
    gym: gym?._id,
    map: map?._id,
  };

  const toImageDoc = (ref) => ref ? { _type: "image", asset: { _type: "reference", _ref: ref } } : undefined;

  // 2. Create Site Settings Singleton
  const siteSettings = {
    _type: "siteSettings",
    _id: "siteSettings",
    hotelName: "Acemco Express",
    tagline: "Holiday Inn",
    phone: "+234 800 000 0000",
    whatsapp: "2348000000000",
    email: "reservations@acemcohotel.com",
    address: "12 Marina Crescent",
    city: "Warri, Delta State, Nigeria",
    hours: [
      { _key: "h1", label: "Reception", value: "24 hours" },
      { _key: "h2", label: "Restaurant", value: "07:00 – 23:00" },
      { _key: "h3", label: "Lounge", value: "16:00 – 02:00" },
    ],
    socials: [
      { _key: "s1", label: "Instagram", href: "https://instagram.com" },
      { _key: "s2", label: "Facebook", href: "https://facebook.com" },
      { _key: "s3", label: "X", href: "https://x.com" },
    ],
  };
  await client.createOrReplace(siteSettings);
  console.log("Created siteSettings document");

  // 3. Create Testimonials
  const testimonials = [
    { _type: "testimonial", _id: "testimonial-1", quote: "The kind of quiet luxury that lets you actually rest. We left already planning our return.", name: "Adaeze O.", origin: "Lagos", order: 1 },
    { _type: "testimonial", _id: "testimonial-2", quote: "Faultless service and a suite that felt like a private apartment. The best stay in the region, full stop.", name: "James M.", origin: "London", order: 2 },
    { _type: "testimonial", _id: "testimonial-3", quote: "From the rooftop pool to the lounge at midnight, every detail was considered. Remarkable.", name: "Tunde & Bola", origin: "Abuja", order: 3 },
  ];
  for (const t of testimonials) {
    await client.createOrReplace(t);
  }
  console.log("Created testimonial documents");

  // 4. Create Amenities
  const amenitiesList = [
    { _type: "amenity", _id: "amenity-pool", title: "Swimming Pool", overline: "Leisure", description: "An infinity edge above the city — open from sunrise to the last light.", image: toImageDoc(imageRefs.pool), order: 1 },
    { _type: "amenity", _id: "amenity-gym", title: "Gym", overline: "Wellness", description: "A fully equipped fitness studio with a view, open 24 hours.", image: toImageDoc(imageRefs.gym), order: 2 },
  ];
  for (const a of amenitiesList) {
    await client.createOrReplace(a);
  }
  console.log("Created amenity documents");

  // 5. Create Events/Offers
  const eventsList = [
    { _type: "event", _id: "event-jazz", title: "Live Jazz Nights", ribbon: "Every Friday", validity: "From 8:00 PM · The Lounge", terms: "An intimate evening of live jazz, signature cocktails, and small plates.", image: toImageDoc(imageRefs.lounge), order: 1 },
    { _type: "event", _id: "event-brunch", title: "Sunday Rooftop Brunch", ribbon: "Weekly", validity: "Sundays · 11:00 AM – 3:00 PM", terms: "A leisurely poolside brunch buffet with free-flowing mimosas.", image: toImageDoc(imageRefs.pool), order: 2 },
    { _type: "event", _id: "event-wine", title: "Wine & Dine Tasting", ribbon: "Monthly", validity: "Last Saturday of the month", terms: "A curated five-course dinner paired with fine wines by our sommelier.", image: toImageDoc(imageRefs.restaurant), order: 3 },
  ];
  for (const e of eventsList) {
    await client.createOrReplace(e);
  }
  console.log("Created event documents");

  // 6. Create Gallery Images
  const galleryList = [
    { _type: "galleryImage", _id: "gallery-1", title: "Deluxe King Room", ratio: "3/4", image: toImageDoc(imageRefs.deluxe), order: 1 },
    { _type: "galleryImage", _id: "gallery-2", title: "Twin Classic Room", ratio: "1/1", image: toImageDoc(imageRefs.twin), order: 2 },
    { _type: "galleryImage", _id: "gallery-3", title: "Executive Suite", ratio: "1/1", image: toImageDoc(imageRefs.executive), order: 3 },
    { _type: "galleryImage", _id: "gallery-4", title: "Garden Family Room", ratio: "3/4", image: toImageDoc(imageRefs.family), order: 4 },
    { _type: "galleryImage", _id: "gallery-5", title: "Rooftop Swimming Pool", ratio: "1/1", image: toImageDoc(imageRefs.pool), order: 5 },
    { _type: "galleryImage", _id: "gallery-6", title: "Hotel Fitness Center", ratio: "3/4", image: toImageDoc(imageRefs.gym), order: 6 },
    { _type: "galleryImage", _id: "gallery-7", title: "Acemco Hotel Lobby", ratio: "3/4", image: toImageDoc(imageRefs.lobby), order: 7 },
    { _type: "galleryImage", _id: "gallery-8", title: "Hotel Building Facade", ratio: "1/1", image: toImageDoc(imageRefs.facade), order: 8 },
  ];
  for (const g of galleryList) {
    await client.createOrReplace(g);
  }
  console.log("Created galleryImage documents");

  // 7. Create pageMedia Docs (Heros and editorial splits)
  const pageMediaSlots = [
    { slot: "home.hero", title: "Home — Hero", ref: imageRefs.lobby },
    { slot: "home.story", title: "Home — Property Story", ref: imageRefs.family },
    { slot: "home.dining", title: "Home — Dining & Lounge", ref: imageRefs.restaurant },
    { slot: "rooms.hero", title: "Rooms — Hero", ref: imageRefs.facade },
    { slot: "rooms.deluxe-king.hero", title: "Deluxe King — Hero", ref: imageRefs.deluxe },
    { slot: "rooms.twin-classic.hero", title: "Twin Classic — Hero", ref: imageRefs.twin },
    { slot: "rooms.executive-suite.hero", title: "Executive Suite — Hero", ref: imageRefs.executive },
    { slot: "rooms.garden-family.hero", title: "Garden Family — Hero", ref: imageRefs.family },
    { slot: "dining.hero", title: "Dining Hub — Hero", ref: imageRefs.restaurant },
    { slot: "dining.restaurant.hero", title: "Restaurant — Hero", ref: imageRefs.restaurant },
    { slot: "dining.lounge.hero", title: "Lounge — Hero", ref: imageRefs.lounge },
    { slot: "facilities.hero", title: "Facilities — Hero", ref: imageRefs.facade },
    { slot: "facilities.pool", title: "Facilities — Pool Editorial", ref: imageRefs.pool },
    { slot: "facilities.gym", title: "Facilities — Gym Editorial", ref: imageRefs.gym },
    { slot: "gallery.hero", title: "Gallery — Hero", ref: imageRefs.lobby },
    { slot: "events.hero", title: "Events — Hero", ref: imageRefs.lounge },
    { slot: "about.hero", title: "About — Hero", ref: imageRefs.facade },
    { slot: "about.origin", title: "About — Origin Editorial", ref: imageRefs.lobby },
    { slot: "about.team", title: "About — Team Editorial", ref: imageRefs.lobby },
    { slot: "contact.hero", title: "Contact — Hero", ref: imageRefs.facade },
    { slot: "contact.map", title: "Contact — Location Map", ref: imageRefs.map },
    { slot: "reservations.hero", title: "Reservations — Hero", ref: imageRefs.facade },
    { slot: "nav.featured", title: "Navbar — Featured Image", ref: imageRefs.lobby },
    { slot: "footer.image", title: "Footer — Brand Image", ref: imageRefs.facade },
  ];

  for (const pm of pageMediaSlots) {
    const docId = `pagemedia-${pm.slot.replace(/[.\-_]+/g, "-")}`;
    const doc = {
      _type: "pageMedia",
      _id: docId,
      title: pm.title,
      slot: pm.slot,
      image: toImageDoc(pm.ref),
    };
    await client.createOrReplace(doc);
  }
  console.log("Created all pageMedia documents for heroes/splits");

  console.log("Sanity CMS seeding complete!");
}

seed().catch((err) => {
  console.error("Seeding crashed:", err);
  process.exit(1);
});
