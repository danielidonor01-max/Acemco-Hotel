"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, useCartUI } from "@/stores/cart.store";

const LEFT = [
  { label: "Rooms", href: "/rooms" },
  { label: "Dining", href: "/dining" },
  { label: "Facilities", href: "/facilities" },
  { label: "Event", href: "/events" },
];
const RIGHT = [
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];
const ALL = [...LEFT, ...RIGHT];

const WORDMARK = "Acemco";

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
  const linkBase = "pub-overline text-[0.7rem] transition-colors hover:text-pub-gold-deep";
  const linkColor = solid ? "text-pub-ink-soft" : "text-pub-on-dark/85";

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={cn(linkBase, linkColor, active && (solid ? "text-pub-ink" : "text-pub-on-dark"))}>
        {label}
      </Link>
    );
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "border-b border-pub-line bg-pub-bg/95 backdrop-blur-sm" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="pub-container flex h-16 items-center md:h-24">
        {/* Left links (desktop) */}
        <ul className="hidden flex-1 items-center gap-7 lg:flex">
          {LEFT.map((i) => (
            <li key={i.href}><NavLink {...i} /></li>
          ))}
        </ul>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
          className={cn("flex-1 lg:hidden", solid ? "text-pub-ink" : "text-pub-on-dark")}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Centered wordmark */}
        <Link
          href="/"
          className={cn(
            "font-display text-xl font-medium uppercase tracking-[0.35em] transition-colors md:text-2xl",
            solid ? "text-pub-ink" : "text-pub-on-dark",
          )}
        >
          {WORDMARK}
        </Link>

        {/* Right links + actions */}
        <div className="flex flex-1 items-center justify-end gap-6">
          <ul className="hidden items-center gap-7 lg:flex">
            {RIGHT.map((i) => (
              <li key={i.href}><NavLink {...i} /></li>
            ))}
          </ul>
          <Link
            href="/reservations"
            className={cn(
              "hidden rounded-full px-5 py-2.5 pub-cta transition-colors lg:inline-flex",
              solid ? "bg-pub-gold text-pub-ink hover:bg-pub-gold-deep hover:text-pub-on-dark" : "border border-pub-on-dark/60 text-pub-on-dark hover:bg-pub-on-dark hover:text-pub-espresso",
            )}
          >
            Reserve
          </Link>
          <button
            type="button"
            onClick={openCart}
            aria-label="Open cart"
            className={cn("relative transition-colors", solid ? "text-pub-ink hover:text-pub-gold-deep" : "text-pub-on-dark hover:text-pub-gold")}
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            {mounted && count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-pub-gold px-1 text-[0.65rem] font-semibold text-pub-ink">
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-pub-espresso lg:hidden">
          <ul className="pub-container flex flex-col gap-1 py-8">
            {ALL.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block py-3 pub-display-3 text-pub-on-dark">{item.label}</Link>
              </li>
            ))}
            <li className="mt-4">
              <Link href="/reservations" className="inline-flex rounded-full bg-pub-gold px-7 py-3 pub-cta text-pub-ink">
                Reserve a Room
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
