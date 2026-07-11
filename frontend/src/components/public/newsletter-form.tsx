"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Newsletter signup.
 *
 * There is no subscriber store or email provider yet (email infra is deliberately
 * deferred), so this hands the address off to the hotel's mailbox rather than
 * pretending. It previously cleared the field and said "we'll be in touch" while
 * discarding the address entirely — the guest believed they had subscribed and
 * would never hear from us again.
 */
export function NewsletterForm({ email: hotelEmail }: { email?: string }) {
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!hotelEmail) {
      toast.error("Sign-up isn't available yet — please reach us on the contact page.");
      return;
    }
    const subject = encodeURIComponent("Newsletter sign-up");
    const body = encodeURIComponent(`Please add ${email} to the Acemco mailing list.`);
    window.location.href = `mailto:${hotelEmail}?subject=${subject}&body=${body}`;
    setEmail("");
    toast.success("Opening your mail app to confirm your sign-up.");
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
