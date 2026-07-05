import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gold uppercase eyebrow — the signature public device (§15.3). */
export function Overline({
  children,
  className,
  onDark = false,
}: {
  children: React.ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <p
      className={cn(
        "pub-overline",
        onDark ? "text-pub-gold" : "text-pub-gold-deep",
        className,
      )}
    >
      {children}
    </p>
  );
}

type ButtonVariant = "pub-primary" | "pub-outline" | "pub-on-dark";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 pub-cta transition-colors duration-300 ease-out disabled:opacity-40 disabled:cursor-not-allowed";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  "pub-primary": "bg-pub-gold text-pub-ink hover:bg-pub-gold-deep hover:text-pub-on-dark",
  "pub-outline": "border border-pub-ink text-pub-ink hover:bg-pub-ink hover:text-pub-bg",
  "pub-on-dark": "border border-pub-on-dark text-pub-on-dark hover:bg-pub-on-dark hover:text-pub-espresso",
};

/** Public CTA button, optionally rendered as a Link when `href` is given. */
export function PubButton({
  variant = "pub-primary",
  href,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  href?: string;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(BUTTON_BASE, BUTTON_VARIANT[variant], className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

/** Text link with an animated gold underline (§15.7 pub-ghost-link). */
export function GhostLink({
  href,
  children,
  className,
  onDark = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "pub-underline group inline-flex items-center gap-2 pub-cta",
        onDark ? "text-pub-on-dark" : "text-pub-ink",
        className,
      )}
    >
      {children}
      <ArrowRight
        size={16}
        className="transition-transform duration-300 group-hover:translate-x-1"
      />
    </Link>
  );
}
