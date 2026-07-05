import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { CartDrawer } from "@/components/public/cart-drawer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-theme min-h-screen">
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
      <CartDrawer />
    </div>
  );
}
