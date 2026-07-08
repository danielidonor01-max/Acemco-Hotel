"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Scroll parallax for a filling image (§15.5 companion). The image is rendered
 * ~14% taller than its frame and drifts vertically as the frame passes through
 * the viewport, so it never reveals an edge. Honors prefers-reduced-motion
 * (renders a plain, static filling image). Client-only — used by MediaFrame.
 */
export function ParallaxLayer({
  src,
  alt = "",
  priority,
  sizes = "100vw",
  imgClassName,
}: {
  src: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
  imgClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Drift within the extra 14% of height on each side → no edge ever shows.
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  if (reduce) {
    return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={cn("object-cover", imgClassName)} />;
  }

  return (
    <div ref={ref} className="absolute inset-0">
      <motion.div className="absolute inset-x-0" style={{ top: "-14%", height: "128%", y, willChange: "transform" }}>
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={cn("object-cover", imgClassName)} />
      </motion.div>
    </div>
  );
}
