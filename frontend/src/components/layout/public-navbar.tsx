"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { site } from "@/lib/cms";
import { useCart, useCartUI } from "@/stores/cart.store";

const NAV = [
  { label: "Rooms", href: "/rooms" },
  { label: "Dining", href: "/dining" },
  { label: "Facilities", href: "/facilities" },
  { label: "Offers", href: "/offers" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const count = useCart((s) => s.count());
  const openCart = useCartUI((s) => s.open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const solid = scrolled || mobileOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid
          ? "border-b border-pub-line bg-pub-bg/95 backdrop-blur-sm"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="pub-container flex h-16 items-center justify-between md:h-20">
        {/* Wordmark */}
        <Link href="/" className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-xl font-medium tracking-tight transition-colors md:text-2xl",
              solid ? "text-pub-ink" : "text-pub-on-dark",
            )}
          >
            {site.hotelName}
          </span>
          <span
            className={cn(
              "pub-overline mt-0.5 text-[0.6rem] transition-colors",
              solid ? "text-pub-gold-deep" : "text-pub-gold",
            )}
          >
            {site.tagline}
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "pub-underline pub-cta font-medium tracking-normal transition-colors",
                    solid ? "text-pub-ink-soft hover:text-pub-ink" : "text-pub-on-dark/90 hover:text-pub-on-dark",
                    active && (solid ? "text-pub-ink" : "text-pub-on-dark"),
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCart}
            aria-label="Open cart"
            className={cn(
              "relative rounded-full p-2 transition-colors",
              solid ? "text-pub-ink hover:bg-pub-sand" : "text-pub-on-dark hover:bg-white/10",
            )}
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            {mounted && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pub-gold px-1 text-[0.65rem] font-semibold text-pub-ink">
                {count}
              </span>
            )}
          </button>

          <Link
            href="/reservations"
            className="hidden rounded-full bg-pub-gold px-5 py-2.5 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark sm:inline-flex"
          >
            Reserve
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className={cn(
              "rounded-full p-2 transition-colors lg:hidden",
              solid ? "text-pub-ink" : "text-pub-on-dark",
            )}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-pub-espresso lg:hidden">
          <ul className="pub-container flex flex-col gap-1 py-8">
            {NAV.map((item, i) => (
              <li key={item.href} style={{ animationDelay: `${i * 40}ms` }}>
                <Link
                  href={item.href}
                  className="block py-3 pub-display-3 text-pub-on-dark"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-4">
              <Link
                href="/reservations"
                className="inline-flex rounded-full bg-pub-gold px-7 py-3 pub-cta text-pub-ink"
              >
                Reserve a Room
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
