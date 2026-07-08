import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { CartDrawer } from "@/components/public/cart-drawer";
import { QueryProvider } from "@/providers/query-provider";
import { getHeroImage, getSiteSettings } from "@/lib/data/content";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [navFeaturedSrc, siteSettings] = await Promise.all([
    getHeroImage("nav.featured"),
    getSiteSettings(),
  ]);

  return (
    <QueryProvider>
      <div className="public-theme min-h-screen">
        <PublicNavbar featuredSrc={navFeaturedSrc} siteSettings={siteSettings} />
        <main>{children}</main>
        <PublicFooter siteSettings={siteSettings} />
        <CartDrawer />
      </div>
    </QueryProvider>
  );
}
