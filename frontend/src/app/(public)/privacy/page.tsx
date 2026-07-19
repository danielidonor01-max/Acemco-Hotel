import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal";
import { getSiteSettings } from "@/lib/data/content";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return {
    title: "Privacy Notice",
    description: `How ${siteSettings.hotelName} collects, uses, and protects your personal data under the Nigeria Data Protection Act.`,
  };
}

/** Contact lines, skipping any the hotel hasn't set — never render a blank "Email: ." */
const contactLine = (site: { email: string; phone: string }) =>
  ["Email: " + site.email, site.phone && "Phone: " + site.phone].filter(Boolean).join(" · ") + ".";

export default async function PrivacyPage() {
  const site = await getSiteSettings();
  const reach = [site.phone && `call ${site.phone}`, site.email && `email ${site.email}`].filter(Boolean).join(" or ") || "contact reception";

  return (
    <LegalPage
      title="Privacy Notice"
      intro={`${site.hotelName} is committed to protecting your personal data. This notice explains what we collect when you book, stay, order, or enquire, how we use it, and your rights under the Nigeria Data Protection Act, 2023 (NDPA).`}
      updated="July 2026"
      sections={[
        {
          heading: "Who we are",
          body: [
            `${site.hotelName}, ${site.address}, ${site.city}, is the data controller responsible for your personal data. If you have any question about this notice or how we handle your information, ${reach}.`,
          ],
        },
        {
          heading: "Information we collect",
          body: [
            "When you make a reservation or check in, we collect your name, phone number, WhatsApp number, email address (if given), stay dates, number of guests, and any special requests.",
            "At check-in, and where required by law, we may record a means of identification (for example a national ID, driver's licence, or passport number) to confirm your identity.",
            "When you order room service, dining, or from the boutique, we record what you ordered and charge it to your room bill.",
            "For billing we keep a record of your charges, payments, and the payment method used. We do NOT store card numbers — card payments are handled at the point of payment.",
            "We also keep records of enquiries you send us, and limited technical information (such as device and browser type) needed to keep the website secure.",
          ],
        },
        {
          heading: "How we use your information",
          body: [
            "To confirm and manage your reservation, and to send you your booking confirmation and updates — usually by WhatsApp to the number you provide.",
            "To fulfil room-service, dining, and boutique orders, and to prepare an accurate bill.",
            "To meet our legal and tax obligations, including issuing receipts and charging Value Added Tax (VAT) at the rate set by law.",
            "To keep guests, staff, and the hotel secure, and to keep proper business records.",
            "We do not sell your personal data, and we do not use it for advertising by third parties.",
          ],
        },
        {
          heading: "Lawful basis",
          body: [
            "We process your data to perform our contract with you (your stay and any orders), to comply with legal obligations (such as tax and security record-keeping), and for our legitimate interest in running the hotel safely and well. Where we rely on your consent — such as sending you occasional offers — you may withdraw it at any time.",
          ],
        },
        {
          heading: "Who we share it with",
          body: [
            "We share your data only with service providers who help us operate — for example our booking and messaging systems and, where you use it, WhatsApp (Meta), whose own terms then also apply to that message.",
            "We may disclose information where the law requires it, or to protect the rights, safety, and property of our guests, staff, or the hotel.",
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            "We keep your booking and stay records for as long as needed to serve you and to meet our legal duties. Financial and tax records are kept for at least six years, as Nigerian tax law requires. When data is no longer needed, we securely delete or anonymise it.",
          ],
        },
        {
          heading: "How we protect it",
          body: [
            "Access to your data is restricted to authorised staff by role, every change is logged, and information is encrypted in transit. No system is perfectly secure, but we take reasonable steps to guard against loss, misuse, and unauthorised access.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Under the NDPA you have the right to access the personal data we hold about you, to correct it if it is wrong, to ask us to delete it where there is no legal reason to keep it, and to object to certain uses.",
            `To exercise any of these rights, ${reach}.`,
            "If you believe we have not handled your data properly, you may complain to us first, and you also have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC).",
          ],
        },
        {
          heading: "Contact",
          body: [
            `${site.hotelName}, ${site.address}, ${site.city}.`,
            contactLine(site),
          ],
        },
      ]}
    />
  );
}
