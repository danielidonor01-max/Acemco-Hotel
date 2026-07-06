import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal";
import { site } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: `How ${site.hotelName} collects, uses, and protects your personal information.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      intro={`${site.hotelName} respects your privacy. This notice explains what we collect when you book, order, or enquire, and how we use it.`}
      updated="July 2026"
      sections={[
        {
          heading: "Information we collect",
          body: [
            "When you make a reservation, place an in-house order, or contact us, we collect the details you provide — such as your name, phone number, email address, stay dates, and any special requests.",
            "We also collect limited technical information (such as device and browser type) to keep the site secure and working well.",
          ],
        },
        {
          heading: "How we use your information",
          body: [
            "We use your information to confirm and manage reservations, fulfil room-service and dining orders, respond to enquiries, and improve our service.",
            "We do not sell your personal information. We share it only with trusted providers who help us operate the hotel, and only as needed.",
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You may unsubscribe from our occasional updates at any time. You can also request access to, correction of, or deletion of your personal information.",
            `To make a request, contact us at ${site.email} or ${site.phone}.`,
          ],
        },
        {
          heading: "Contact",
          body: [
            `${site.hotelName}, ${site.address}, ${site.city}.`,
            `Email: ${site.email} · Phone: ${site.phone}.`,
          ],
        },
      ]}
    />
  );
}
