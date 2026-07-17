/** Default country calling code — Nigeria. */
const DEFAULT_CC = '234';

/**
 * Normalise a phone number to E.164 digits WITHOUT the leading '+', which is the
 * form wa.me links and the WhatsApp API both expect (e.g. 2348077125775).
 *
 * Guests type the same number half a dozen ways — `08077125775`,
 * `+234 807 712 5775`, `0807-712-5775`. Storing them verbatim means the same
 * person looks like several, and a wa.me link built from a local `0…` number
 * silently fails to resolve. Normalising at the edge keeps one identity per line.
 *
 * Returns null when the input can't be a real number, so callers can reject it
 * rather than store a value that will never receive a message.
 */
export function toWhatsAppNumber(raw: string | null | undefined, countryCode = DEFAULT_CC): string | null {
  if (!raw) return null;
  // Strip everything but digits; a leading '+' carries no extra information once
  // we know the country code.
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // 00 is the international prefix in much of the world (00234… === +234…).
  const trimmed = digits.startsWith('00') ? digits.slice(2) : digits;

  // Already international.
  if (trimmed.startsWith(countryCode) && trimmed.length >= countryCode.length + 9) return trimmed;

  // National format with trunk prefix: 0807… → 234807…
  if (trimmed.startsWith('0')) {
    const national = trimmed.replace(/^0+/, '');
    return national.length >= 9 ? countryCode + national : null;
  }

  // Bare national number: 807… → 234807…
  if (trimmed.length >= 9 && trimmed.length <= 11) return countryCode + trimmed;

  return null;
}

/** A wa.me deep link with a pre-filled message. */
export function waLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
