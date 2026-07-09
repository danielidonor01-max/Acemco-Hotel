import { MediaFrame } from "./media-frame";
import { HeroVideo } from "./hero-video";
import { Reveal } from "./reveal";
import { getHeroImage } from "@/lib/data/content";
import { cn } from "@/lib/utils";

/**
 * Hero (§15.8, redesigned). A single full-viewport "living" visual: a looping
 * muted video when one is supplied (a still room with the curtains breathing in
 * the breeze), otherwise the still image with a slow ambient drift so it feels
 * alive. The hook headline + CTAs sit in a band directly *beneath* the image,
 * on the light page ground — so the type is always full-contrast and never
 * fights the photo. No eyebrow, no sub-copy: just the one big line.
 */
export async function Hero({
  slot,
  title,
  actions,
  size = "page",
  align = "center",
  video,
  videoMobile,
  poster,
}: {
  slot: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  size?: "full" | "page";
  align?: "center" | "left";
  /** Optional looping video URL (landscape) — full-bleed, muted, autoplay. */
  video?: string;
  /** Optional portrait cut used on phones (≤767px) so it isn't hard-cropped. */
  videoMobile?: string;
  /** Optional still for the video hero; defaults to a frame from the video. */
  poster?: string;
}) {
  // A video hero is self-contained — no CMS image is fetched or used, so the
  // homepage never depends on (or waits on) Sanity for its hero.
  const src = video ? undefined : await getHeroImage(slot);
  const mediaH =
    size === "full" ? "h-[92svh] min-h-[560px]" : "h-[56svh] min-h-[380px]";

  return (
    <section className="relative w-full bg-pub-bg">
      {/* The living visual — fills the viewport behind the floating navbar. */}
      <div className={cn("relative w-full overflow-hidden bg-pub-espresso", mediaH)}>
        {video ? (
          <HeroVideo
            src={video}
            srcMobile={videoMobile}
            poster={poster}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <MediaFrame slot={slot} src={src} background alive priority sizes="100vw" />
        )}
        {/* Soft top wash so the translucent navbar stays legible over a bright frame. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/25 to-transparent" />
      </div>

      {/* Text band — dark ink on the light ground → always legible. */}
      <div
        className={cn(
          "pub-container relative z-20 pb-14 pt-10 md:pb-20 md:pt-12",
          align === "center" ? "text-center" : "text-left",
        )}
      >
        <div className={cn("max-w-4xl", align === "center" && "mx-auto")}>
          <Reveal slow>
            <h1 className={size === "full" ? "pub-display-hero" : "pub-display-1"}>{title}</h1>
          </Reveal>
          {actions && (
            <Reveal delay={0.12}>
              <div
                className={cn(
                  "mt-8 flex flex-wrap gap-4",
                  align === "center" && "justify-center",
                )}
              >
                {actions}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
