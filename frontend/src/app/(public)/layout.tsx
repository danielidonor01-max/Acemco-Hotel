import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { CartDrawer } from "@/components/public/cart-drawer";
import { getHeroImage } from "@/lib/data/content";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navFeaturedSrc = await getHeroImage("nav.featured");
  return (
    <div className="public-theme min-h-screen">
      <PublicNavbar featuredSrc={navFeaturedSrc} />
      <main>{children}</main>
      <PublicFooter />
      <CartDrawer />
    </div>
  );
}
