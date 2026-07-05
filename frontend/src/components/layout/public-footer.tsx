import Link from "next/link";
import { site } from "@/lib/cms";
import { Overline } from "@/components/public/ui";

const QUICK = [
  { label: "Rooms & Suites", href: "/rooms" },
  { label: "Dining", href: "/dining" },
  { label: "Facilities", href: "/facilities" },
  { label: "Offers", href: "/offers" },
  { label: "Gallery", href: "/gallery" },
  { label: "Reserve", href: "/reservations" },
];

export function PublicFooter() {
  return (
    <footer className="bg-pub-espresso text-pub-on-dark-soft">
      <div className="pub-container grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="lg:pr-8">
          <p className="font-display text-2xl font-medium text-pub-on-dark">{site.hotelName}</p>
          <p className="pub-overline mt-1 text-pub-gold">{site.tagline}</p>
          <p className="pub-body-sm mt-5 max-w-xs leading-relaxed">
            A warm, considered stay in {site.city.split(",")[0]} — rooms that feel like arrivals,
            all-day dining, and a lounge that comes alive after dark.
          </p>
        </div>

        {/* Explore */}
        <div>
          <Overline onDark>Explore</Overline>
          <ul className="mt-4 space-y-2.5">
            {QUICK.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="pub-body-sm transition-colors hover:text-pub-on-dark">
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <Overline onDark>Contact</Overline>
          <ul className="mt-4 space-y-2.5 pub-body-sm">
            <li>{site.address}</li>
            <li>{site.city}</li>
            <li>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-pub-on-dark">
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-pub-on-dark">
                {site.email}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${site.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pub-gold hover:text-pub-on-dark"
              >
                WhatsApp us
              </a>
            </li>
          </ul>
        </div>

        {/* Hours + social */}
        <div>
          <Overline onDark>Hours</Overline>
          <ul className="mt-4 space-y-2.5 pub-body-sm">
            {site.hours.map((h) => (
              <li key={h.label} className="flex justify-between gap-4">
                <span>{h.label}</span>
                <span className="text-pub-on-dark">{h.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-4">
            {site.socials.map((s) => (
              <a key={s.label} href={s.href} className="pub-body-sm transition-colors hover:text-pub-on-dark">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="pub-container flex flex-col items-center justify-between gap-3 py-6 pub-body-sm sm:flex-row">
          <p>© {2026} {site.hotelName} {site.tagline}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-pub-on-dark">Privacy</Link>
            <Link href="#" className="hover:text-pub-on-dark">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
