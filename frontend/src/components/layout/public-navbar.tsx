"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { site } from "@/lib/cms";
import { MediaFrame } from "@/components/public/media-frame";
import { useCart, useCartUI } from "@/stores/cart.store";

const NAV = [
  { label: "Rooms", href: "/rooms" },
  { label: "Dining", href: "/dining" },
  { label: "Facilities", href: "/facilities" },
  { label: "Events", href: "/events" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const count = useCart((s) => s.count());
  const openCart = useCartUI((s) => s.open);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);

  // The floating bar is light when scrolled or the menu is open, translucent-dark over the hero.
  const light = scrolled || menuOpen;
  const boxCls = cn(
    "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 pub-overline text-[0.7rem] transition-colors",
    light ? "border-pub-line bg-pub-bg text-pub-ink hover:bg-pub-sand" : "border-white/25 bg-white/10 text-pub-on-dark hover:bg-white/20",
  );

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 md:top-4">
      <div className="mx-auto w-full max-w-3xl">
        {/* Floating bar */}
        <div
          className={cn(
            "grid grid-cols-3 items-center rounded-2xl border px-3 py-2.5 backdrop-blur-md transition-colors duration-300 md:px-4 md:py-3",
            light ? "border-pub-line bg-pub-bg/95 shadow-sm" : "border-white/15 bg-pub-espresso/35",
          )}
        >
          {/* Left: Reserve */}
          <div className="flex justify-start">
            <Link href="/reservations" className={boxCls}>Reserve</Link>
          </div>

          {/* Center: wordmark */}
          <Link
            href="/"
            className={cn(
              "text-center font-display text-xl font-medium uppercase tracking-[0.35em] transition-colors md:text-2xl",
              light ? "text-pub-ink" : "text-pub-on-dark",
            )}
          >
            Acemco
          </Link>

          {/* Right: cart + hamburger */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={openCart}
              aria-label="Open cart"
              className={cn("relative rounded-lg p-2 transition-colors", light ? "text-pub-ink hover:bg-pub-sand" : "text-pub-on-dark hover:bg-white/15")}
            >
              <ShoppingBag size={19} strokeWidth={1.5} />
              {mounted && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pub-gold px-1 text-[0.6rem] font-semibold text-pub-ink">
                  {count}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className={cn("rounded-lg border p-2.5 transition-colors", light ? "border-pub-line text-pub-ink hover:bg-pub-sand" : "border-white/25 text-pub-on-dark hover:bg-white/15")}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Dropdown menu panel */}
        {menuOpen && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-pub-line bg-pub-surface shadow-xl">
            <nav className="flex flex-col items-center gap-3 px-6 pt-8 pb-2">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "font-sans text-[14px] font-medium uppercase tracking-[0.18em] transition-colors hover:text-pub-gold-deep",
                      active ? "text-pub-gold-deep" : "text-pub-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-6 flex gap-6">
                {site.socials.map((s) => (
                  <a key={s.label} href={s.href} className="pub-overline text-[0.7rem] text-pub-ink-soft transition-colors hover:text-pub-gold-deep">
                    {s.label} ↗
                  </a>
                ))}
              </div>
            </nav>
            {/* Featured image (CMS slot) */}
            <div className="relative mx-3 mb-3 mt-6 overflow-hidden rounded-xl">
              <MediaFrame slot="nav.featured" ratio="16/9" overlay="scrim-bottom" sizes="(max-width: 768px) 100vw, 68rem" />
              <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-5 pb-4 md:px-7 md:pb-6">
                <span className="pub-overline text-pub-on-dark">A warm arrival</span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-pub-on-dark/70 sm:block" />
                <span className="pub-overline text-pub-on-dark">Rooms &amp; suites</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
