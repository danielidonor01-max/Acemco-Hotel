import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { site as staticSite, type SiteSettings } from "@/lib/cms";
import { MediaFrame } from "@/components/public/media-frame";
import { Overline } from "@/components/public/ui";
import { getHeroImage } from "@/lib/data/content";

const QUICK = [
  { label: "Rooms", href: "/rooms" },
  { label: "Dining", href: "/dining" },
  { label: "Facilities", href: "/facilities" },
  { label: "Events", href: "/events" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export async function PublicFooter({ siteSettings }: { siteSettings?: SiteSettings }) {
  const site = siteSettings || staticSite;
  const footerImgSrc = await getHeroImage("footer.image");
  return (
    <footer className="bg-pub-bg text-pub-ink">
      {/* Invitation band */}
      <div className="pub-container border-b border-pub-line py-14 md:py-20">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Overline className="text-pub-gold-deep">Stay with us</Overline>
            <p className="pub-display-2 mt-4 max-w-xl">
              A quiet address for warm arrivals in {site.city.split(",")[0]}.
            </p>
          </div>
          <Link
            href="/reservations"
            className="group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-pub-ink px-7 py-3.5 pub-cta uppercase tracking-[0.15em] text-pub-ink transition-colors hover:bg-pub-ink hover:text-pub-bg"
          >
            Reserve a stay
            <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      {/* Main columns */}
      <div className="pub-container border-b border-pub-line grid gap-12 md:grid-cols-12 md:gap-8">
        {/* Brand: tall portrait image + blurb */}
        <div className="flex gap-6 pt-16 pb-8 md:py-20 md:col-span-5 md:border-r md:border-pub-line md:pr-8 lg:pr-12">
          <MediaFrame slot="footer.image" src={footerImgSrc} ratio="3/5" className="w-36 shrink-0 rounded-xl sm:w-44 lg:w-52" sizes="(max-width: 768px) 38vw, 208px" />
          <div className="flex flex-col justify-end">
            <Overline className="mb-3 text-[8px] tracking-[0.20em]">{site.tagline}</Overline>
            <p className="text-[12px] leading-relaxed max-w-xs text-pub-ink-soft">
              Driven by a passion for hospitality, {site.hotelName} creates warm, considered stays —
              rooms that feel like arrivals, all-day dining, and a lounge that comes alive after dark.
            </p>
          </div>
        </div>

        {/* Explore */}
        <div className="pt-8 pb-8 md:py-20 md:col-span-3 md:col-start-7">
          <Overline className="text-[8px] tracking-[0.20em]">Explore</Overline>
          <ul className="mt-5 space-y-3">
            {QUICK.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="text-[12px] font-semibold uppercase tracking-[0.18em] text-pub-ink transition-colors hover:text-pub-gold-deep">
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Connect — concierge details */}
        <div className="pt-8 pb-16 md:py-20 md:col-span-3">
          <Overline className="text-[8px] tracking-[0.20em]">Connect</Overline>
          <address className="mt-5 space-y-1 not-italic text-[10px] leading-relaxed text-pub-ink-soft">
            <p>{site.address}</p>
            <p>{site.city}</p>
          </address>
          <div className="mt-4 space-y-1.5">
            <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-pub-ink transition-colors hover:text-pub-gold-deep">
              {site.phone}
            </a>
            <a href={`mailto:${site.email}`} className="block text-[10px] text-pub-ink-soft transition-colors hover:text-pub-gold-deep">
              {site.email}
            </a>
          </div>

          <dl className="mt-6 space-y-1.5">
            {site.hours.map((h) => (
              <div key={h.label} className="flex justify-between gap-4 border-b border-pub-line py-1.5 text-[10px]">
                <dt className="text-pub-ink-muted">{h.label}</dt>
                <dd className="text-pub-ink">{h.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex gap-5">
            {site.socials.map((s) => (
              <a key={s.label} href={s.href} className="text-[8px] font-semibold uppercase tracking-[0.15em] text-pub-ink-soft transition-colors hover:text-pub-gold-deep">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Large brand wordmark — fills the layout width, fully visible (ballena-style) */}
      <div className="pub-container pt-12 pb-8">
        <p className="w-full whitespace-nowrap text-center font-display font-medium uppercase leading-[0.8] tracking-[-0.03em] text-pub-ink [font-size:clamp(2rem,20vw,17rem)]">
          Acemco
        </p>
      </div>

      <div className="border-t border-pub-line">
        <div className="pub-container flex flex-col items-center justify-between gap-3 py-6 pub-overline text-[0.7rem] text-pub-ink-soft sm:flex-row">
          <p>Acemco © {2026} · All rights reserved</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-pub-ink">Privacy Notice</Link>
            <Link href="/terms" className="transition-colors hover:text-pub-ink">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
