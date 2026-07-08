import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParallaxLayer } from "./parallax-layer";

type Overlay = "scrim-bottom" | "scrim-full" | "scrim-hero" | "scrim-none";

const OVERLAY_CLASS: Record<Overlay, string> = {
  "scrim-bottom":
    "after:absolute after:inset-0 after:bg-[linear-gradient(to_top,rgba(26,23,18,0.72)_0%,rgba(26,23,18,0)_55%)]",
  "scrim-full": "after:absolute after:inset-0 after:bg-[rgba(26,23,18,0.45)]",
  // Heavier gradient for full-bleed heroes — guarantees white text contrast even over a light placeholder.
  "scrim-hero":
    "after:absolute after:inset-0 after:bg-[linear-gradient(to_top,rgba(26,23,18,0.78)_0%,rgba(26,23,18,0.32)_45%,rgba(26,23,18,0.55)_100%)]",
  "scrim-none": "",
};

export interface MediaFrameProps {
  /** Stable CMS slot id — also the placeholder label (e.g. "home.hero"). */
  slot: string;
  /** Locked aspect ratio, e.g. "21/9". Reserves space → zero layout shift. */
  ratio?: string;
  /** S3 key / CDN URL. Undefined → dignified placeholder (§15.5). */
  src?: string;
  alt?: string;
  priority?: boolean;
  overlay?: Overlay;
  /** Slow zoom on hover — parent card should be `group`. */
  zoom?: boolean;
  /** Ken-burns scale on mount (heroes only). */
  kenburns?: boolean;
  /** Fill the (sized) parent instead of using an aspect-ratio box — for heroes. */
  background?: boolean;
  /** Sleek scroll parallax — the image drifts as the frame passes the viewport. */
  parallax?: boolean;
  sizes?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * The mandatory media primitive (UI Constitution §15.5).
 * Every image position on the public site renders through MediaFrame so an
 * unpopulated CMS slot shows an on-brand placeholder — never a broken image,
 * never layout shift.
 */
export function MediaFrame({
  slot,
  ratio = "4/3",
  src,
  alt = "",
  priority,
  overlay = "scrim-none",
  zoom,
  kenburns,
  background,
  parallax,
  sizes = "100vw",
  className,
  children,
}: MediaFrameProps) {
  const imgClass = cn(
    "object-cover",
    zoom && "transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]",
    kenburns && "pub-kenburns",
  );
  return (
    <div
      className={cn(
        "isolate overflow-hidden",
        background ? "absolute inset-0" : "relative",
        OVERLAY_CLASS[overlay],
        "after:pointer-events-none after:z-10",
        className,
      )}
      style={background ? undefined : { aspectRatio: ratio }}
    >
      {src ? (
        parallax ? (
          <ParallaxLayer src={src} alt={alt} priority={priority} sizes={sizes} imgClassName={imgClass} />
        ) : (
          <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={imgClass} />
        )
      ) : (
        <Placeholder slot={slot} ratio={ratio} />
      )}
      {children}
    </div>
  );
}

function Placeholder({ slot, ratio }: { slot: string; ratio: string }) {
  const label = `${slot.replace(/[.\-_/]+/g, " · ").toUpperCase()} — ${ratio.replace("/", ":")}`;
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[inherit] border border-pub-line-strong bg-pub-stone/90 text-pub-ink-muted"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, transparent, transparent 11px, rgba(146,138,124,0.08) 11px, rgba(146,138,124,0.08) 12px)",
      }}
      aria-hidden="true"
    >
      <ImageIcon size={32} strokeWidth={1} />
      <span className="pub-body-sm px-4 text-center font-medium tracking-[0.14em]">{label}</span>
    </div>
  );
}
