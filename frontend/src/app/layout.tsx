import type { Metadata } from "next";
import { Inter, Cormorant } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display serif for headings + the Acemco wordmark. Cormorant — a delicate,
// high-contrast light serif — evokes the same editorial-luxury feel as Rosa
// Hotels' PP Fragment Serif (a free, self-hosted stand-in for the paid face).
const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Acemco Express Holiday Inn",
    template: "%s · Acemco Express",
  },
  description:
    "A warm, considered stay in Warri — rooms that feel like arrivals, all-day dining, and a lounge that comes alive after dark.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
