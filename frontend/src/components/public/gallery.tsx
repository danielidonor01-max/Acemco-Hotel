"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { MediaFrame } from "./media-frame";
import type { gallerySlots } from "@/lib/cms";

type Tile = (typeof gallerySlots)[number];

/** GallerySection (§15.7) — masonry of mixed-ratio tiles + lightbox. CMS-driven. */
export function GallerySection({ tiles }: { tiles: Tile[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open === null) return;
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % tiles.length));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + tiles.length) % tiles.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, tiles.length]);

  return (
    <>
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
        {tiles.map((tile, idx) => (
          <button
            key={idx}
            onClick={() => setOpen(idx)}
            className="group block w-full break-inside-avoid overflow-hidden rounded-2xl"
            aria-label={`Open gallery image ${idx + 1}`}
          >
            <MediaFrame
              slot={`gallery.${idx + 1}`}
              ratio={tile.ratio}
              src={tile.slot}
              zoom
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-pub-espresso/95 p-4" onClick={() => setOpen(null)}>
          <button className="absolute right-5 top-5 rounded-full p-2 text-pub-on-dark hover:bg-white/10" aria-label="Close" onClick={() => setOpen(null)}>
            <X size={26} />
          </button>
          <button
            className="absolute left-4 rounded-full p-2 text-pub-on-dark hover:bg-white/10"
            aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => (o === null ? o : (o - 1 + tiles.length) % tiles.length)); }}
          >
            <ChevronLeft size={30} />
          </button>
          {/* Portrait 9:16 frame — fits mobile; width-driven and capped for desktop. */}
          <div
            className="relative aspect-[9/16] max-h-[88vh] w-[88vw] max-w-[440px] overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <MediaFrame slot={`gallery.${open + 1}`} background src={tiles[open].slot} sizes="(max-width: 768px) 88vw, 440px" />
          </div>
          <button
            className="absolute right-4 rounded-full p-2 text-pub-on-dark hover:bg-white/10"
            aria-label="Next"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => (o === null ? o : (o + 1) % tiles.length)); }}
          >
            <ChevronRight size={30} />
          </button>
        </div>
      )}
    </>
  );
}
