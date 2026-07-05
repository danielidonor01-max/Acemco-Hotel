import type { Metadata } from "next";
import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { Section } from "@/components/public/section";
import { MediaFrame } from "@/components/public/media-frame";
import { Overline } from "@/components/public/ui";
import { Reveal } from "@/components/public/reveal";
import { site } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${site.hotelName} — reservations, events, and enquiries.`,
};

export default function ContactPage() {
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
            <Overline className="mb-4">Send a Message</Overline>
            <form className="space-y-4" action="#">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Name" required>
                  <input required className={inputCls} />
                </FieldLabel>
                <FieldLabel label="Phone" required>
                  <input type="tel" required className={inputCls} />
                </FieldLabel>
              </div>
              <FieldLabel label="Email">
                <input type="email" className={inputCls} />
              </FieldLabel>
              <FieldLabel label="Message" required>
                <textarea rows={5} required className={inputCls} />
              </FieldLabel>
              <button
                type="submit"
                className="rounded-full bg-pub-gold px-7 py-3 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark"
              >
                Send Message
              </button>
            </form>
          </Reveal>

          {/* Info */}
          <Reveal delay={0.1}>
            <MediaFrame slot="contact.map" ratio="16/9" className="rounded-2xl" sizes="(max-width: 1024px) 100vw, 50vw" />
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

const inputCls =
  "mt-1.5 w-full rounded-md border border-pub-line bg-pub-surface px-3 py-2.5 pub-body text-pub-ink focus:border-pub-gold focus:outline-none";

function FieldLabel({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="pub-body-sm font-medium text-pub-ink-soft">
        {label}{required && <span className="text-pub-gold-deep"> *</span>}
      </span>
      {children}
    </label>
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
