import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal";
import { getSiteSettings, getCancellationPolicy } from "@/lib/data/content";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return {
    title: "Terms",
    description: `The terms that apply when you book a stay or place an order with ${siteSettings.hotelName}.`,
  };
}

export default async function TermsPage() {
  const [site, policy] = await Promise.all([getSiteSettings(), getCancellationPolicy()]);

  // Describe the LIVE policy in plain words, so the page can't promise something
  // the system won't do. `freeUntilHours` of 0 means every cancellation carries a fee.
  const freeWindow =
    policy.freeUntilHours > 0
      ? `You may cancel free of charge up to ${policy.freeUntilHours} hours before your check-in date.`
      : "All cancellations are subject to a fee.";
  const lateFee =
    policy.lateFeePercent > 0
      ? `Cancelling later than that attracts a charge of ${policy.lateFeePercent}% of the booking total.`
      : "Later cancellations are not charged a fee.";
  const noShow = `If you do not arrive and do not cancel (a "no-show"), a charge of ${policy.noShowFeePercent}% of the booking total applies.`;
  const deposit = policy.depositRefundable
    ? "Where a deposit was paid, it is refunded on a free cancellation and otherwise applied toward any cancellation charge."
    : "Deposits are non-refundable, but are applied toward any cancellation charge.";

  const reach = [site.phone, site.email].filter(Boolean).join(" or ");

  return (
    <LegalPage
      title="Terms"
      intro={`These terms apply when you reserve a room, place an in-house order, or otherwise use the ${site.hotelName} website. Please read them alongside our Privacy Notice.`}
      updated="July 2026"
      sections={[
        {
          heading: "Reservations",
          body: [
            "A reservation is a request until we confirm it. We confirm bookings by WhatsApp to the number you provide, so please make sure it is correct.",
            "Check-in is from 2:00 PM and check-out is by 12:00 noon. Occupancy is limited to the number of guests on the booking.",
            "You agree to give accurate details. We may decline or cancel a booking made with false information.",
          ],
        },
        {
          heading: "Prices, rates, and VAT",
          body: [
            "All prices are in Nigerian Naira (₦). Room rates are quoted per night and vary by season, day of the week, and how full the hotel is — the rate shown when you book is the rate that applies.",
            "Value Added Tax (VAT) at the prevailing statutory rate (currently 7.5%) is added to your bill. Your receipt shows the tax separately.",
          ],
        },
        {
          heading: "Payment",
          body: [
            "We accept cash, card, and bank transfer. Payment is taken at the hotel unless we agree otherwise in writing (for example, corporate bookings billed to a company account).",
            "We do not store card details. Any deposit taken at booking is credited toward your final bill.",
          ],
        },
        {
          heading: "Cancellations, no-shows, and refunds",
          body: [freeWindow, lateFee, noShow, deposit, "Refunds due to you are processed to your original payment method or by bank transfer."],
        },
        {
          heading: "In-house ordering",
          body: [
            "Room-service, dining, and boutique orders placed through this website are for verified in-house guests only, and are charged to your room and settled at check-out.",
            "Menu items and prices may change, and availability depends on kitchen and service hours.",
          ],
        },
        {
          heading: "Your responsibilities",
          body: [
            "You agree to use the hotel and this website lawfully and with respect for other guests, our staff, and our property. You are responsible for any loss or damage you cause during your stay.",
            "All text, imagery, and branding on this site remain the property of the hotel.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "We take reasonable care to provide our services as described, but we are not liable for matters outside our reasonable control. Nothing in these terms removes any right you have under Nigerian consumer-protection law.",
          ],
        },
        {
          heading: "Governing law",
          body: [
            "These terms are governed by the laws of the Federal Republic of Nigeria, and any dispute is subject to the courts of Delta State.",
            reach ? `Questions about these terms? Contact ${site.hotelName} at ${reach}.` : `Questions about these terms? Contact ${site.hotelName} at reception.`,
          ],
        },
      ]}
    />
  );
}
