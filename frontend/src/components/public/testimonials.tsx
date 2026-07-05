"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Overline } from "./ui";
import type { Testimonial } from "@/lib/cms";

/** TestimonialSection (§15.7) — espresso band, italic pull-quote, gentle fade carousel. */
export function TestimonialSection({ items }: { items: Testimonial[] }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || items.length <= 1) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [reduce, items.length]);

  const t = items[i];

  return (
    <section className="pub-section bg-pub-espresso text-pub-on-dark">
      <div className="pub-container text-center">
        <Overline onDark className="mb-8">Guest Voices</Overline>
        <div className="mx-auto min-h-[10rem] max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={i}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="pub-display-quote text-pub-on-dark">“{t.quote}”</p>
              <footer className="pub-overline mt-6 text-pub-gold">
                {t.name} — {t.origin}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>
        {items.length > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {items.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Testimonial ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-pub-gold" : "w-1.5 bg-pub-on-dark-soft/40"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
