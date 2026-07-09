"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Full-bleed looping hero video (§15.8) — e.g. a still luxury room with the
 * curtains breathing in the breeze. Muted + autoplay + loop + inline so it
 * plays silently on every device (the combination iOS/Android require).
 *
 * Because the frame is `object-cover`, a landscape clip is cropped hard on a
 * portrait phone. Supply `srcMobile` (a portrait cut of the same footage) and
 * it's used at ≤767px, `src` (landscape) above — remounting so the new source
 * autoplays. Under reduced-motion it falls back to the poster still.
 */
export function HeroVideo({
  src,
  srcMobile,
  poster,
  className,
}: {
  src: string;
  srcMobile?: string;
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

  if (reduce) {
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt="" className={className} />
    ) : null;
  }

  const activeSrc = isMobile && srcMobile ? srcMobile : src;

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
