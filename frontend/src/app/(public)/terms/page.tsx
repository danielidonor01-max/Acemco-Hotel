import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal";
import { getSiteSettings } from "@/lib/data/content";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return {
    title: "Terms",
    description: `The terms that apply when you book a stay or place an order with ${siteSettings.hotelName}.`,
  };
}

export default async function TermsPage() {
  const site = await getSiteSettings();
  return (
    <LegalPage
      title="Terms"
      intro={`These terms apply when you reserve a room, place an in-house order, or otherwise use the ${site.hotelName} website.`}
      updated="July 2026"
      sections={[
        {
          heading: "Reservations",
          body: [
            "A reservation request is confirmed only once we have acknowledged it. Rates are quoted per night and may vary by season and availability.",
            "Check-in and check-out times, occupancy limits, and any deposit or cancellation conditions are shared with your confirmation.",
          ],
        },
        {
          heading: "In-house ordering",
          body: [
            "Room-service and dining orders placed through this website are available to verified in-house guests only, and are charged to the room.",
            "Menu items and prices may change, and availability is subject to kitchen and service hours.",
          ],
        },
        {
          heading: "Use of this site",
          body: [
            "You agree to provide accurate information and to use the site lawfully. We may update content, rates, and availability at any time.",
            "All text, imagery, and branding on this site remain the property of the hotel.",
          ],
        },
        {
          heading: "Contact",
          body: [
            `Questions about these terms? Contact ${site.hotelName} at ${site.email} or ${site.phone}.`,
          ],
        },
      ]}
    />
  );
}
