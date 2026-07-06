"use client";

import { useState } from "react";
import { toast } from "sonner";

/** Newsletter signup — client-side confirmation (no email captured until a backend endpoint exists). */
export function NewsletterForm() {
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setEmail("");
    toast.success("Thank you — we'll be in touch with quiet news.");
  }

  return (
    <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        aria-label="Email address"
        className="flex-1 rounded-full border border-pub-line bg-pub-surface px-5 py-3 pub-body text-pub-ink focus:border-pub-gold focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-full bg-pub-gold px-7 py-3 pub-cta text-pub-ink transition-colors hover:bg-pub-gold-deep hover:text-pub-on-dark"
      >
        Subscribe
      </button>
    </form>
  );
}
