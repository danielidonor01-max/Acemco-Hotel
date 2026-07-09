"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Full-bleed looping hero video (§15.8) — e.g. a still luxury room with the
 * curtains breathing in the breeze. Muted + autoplay + loop + inline so it
 * plays silently on every device (the combination iOS/Android require).
 *
 * The poster/fallback is drawn from the video itself, never a CMS image — so
 * the homepage hero is fully decoupled from Sanity. Because the frame is
 * `object-cover`, a landscape clip is cropped hard on a portrait phone: supply
 * `srcMobile` (a portrait cut of the same footage) and it's used at ≤767px.
 * Under reduced-motion the clip is shown paused on a seeked still frame.
 */
export function HeroVideo({
  src,
  srcMobile,
  poster,
  className,
}: {
  src: string;
  srcMobile?: string;
  /** Optional explicit still; defaults to a frame seeked from the video. */
  poster?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!srcMobile) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [srcMobile]);

  const activeSrc = isMobile && srcMobile ? srcMobile : src;

  // Reduced motion: show a static frame seeked from the video itself (paused,
  // no autoplay) — motion-sensitive guests still see the room, never a CMS image.
  if (reduce) {
    return (
      <video
        key={`still-${activeSrc}`}
        className={className}
        src={`${activeSrc}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        poster={poster}
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      key={activeSrc}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={poster}
      aria-hidden="true"
    >
      <source src={activeSrc} />
    </video>
  );
}
