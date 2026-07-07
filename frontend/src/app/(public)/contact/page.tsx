import type { Metadata } from "next";
import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { MediaFrame } from "@/components/public/media-frame";
import { Reveal } from "@/components/public/reveal";
import { ContactForm } from "@/components/public/contact-form";
import { getHeroImage, getSiteSettings } from "@/lib/data/content";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return {
    title: "Contact",
    description: `Get in touch with ${siteSettings.hotelName} — reservations, events, and enquiries.`,
  };
}

export default async function ContactPage() {
  const [mapSrc, siteSettings] = await Promise.all([
    getHeroImage("contact.map"),
    getSiteSettings(),
  ]);
  const site = siteSettings;
  return (
    <>
      <Hero
        slot="contact.hero"
        overline="Contact"
        title={<>We&apos;d love to <em>hear from you</em></>}
        subtitle="Reservations, events, or a simple question — reach us however suits you best."
      />

      <Section band="cream">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Form */}
          <Reveal>
            <ContactForm />
          </Reveal>

          {/* Info */}
          <Reveal delay={0.1}>
            <MediaFrame slot="contact.map" src={mapSrc} ratio="16/9" className="rounded-2xl" sizes="(max-width: 1024px) 100vw, 50vw" />
            <ul className="mt-8 space-y-5">
              <InfoRow icon={MapPin} title="Address">
                {site.address}, {site.city}
              </InfoRow>
              <InfoRow icon={Phone} title="Phone">
                <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="pub-underline">{site.phone}</a>
              </InfoRow>
              <InfoRow icon={Mail} title="Email">
                <a href={`mailto:${site.email}`} className="pub-underline">{site.email}</a>
              </InfoRow>
              <InfoRow icon={MessageCircle} title="WhatsApp">
                <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="pub-underline text-pub-gold-deep">
                  Chat with us
                </a>
              </InfoRow>
            </ul>
          </Reveal>
        </div>
      </Section>
    </>
  );
}

function InfoRow({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string; children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 text-pub-gold-deep"><Icon size={20} /></span>
      <div>
        <p className="pub-overline text-pub-ink-muted">{title}</p>
        <p className="pub-body mt-1 text-pub-ink">{children}</p>
      </div>
    </li>
  );
}
