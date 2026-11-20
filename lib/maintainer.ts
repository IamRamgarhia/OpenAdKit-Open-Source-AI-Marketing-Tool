/**
 * Who builds OpenAdKit, and how to support or hire them. Single source for
 * the sidebar credit, /support, /about and the README-facing copy, matching
 * DiceCodes' other free tools (Free GST Billing, All-In-One SEO Tool).
 *
 * Every value can be overridden at build time with a NEXT_PUBLIC_* variable
 * (forks and white-label deployments), and an empty string hides that item.
 */
import { REPO_URL } from "./repo";

const env = (v: string | undefined, fallback: string) => (v === undefined ? fallback : v);

export const MAINTAINER = {
  name: env(process.env.NEXT_PUBLIC_MAINTAINER_NAME, "DiceCodes"),
  website: env(process.env.NEXT_PUBLIC_MAINTAINER_WEBSITE, "https://dicecodes.com"),
  github: env(process.env.NEXT_PUBLIC_MAINTAINER_GITHUB, REPO_URL),
  contactEmail: env(process.env.NEXT_PUBLIC_MAINTAINER_EMAIL, "contact@dicecodes.com"),
  /** UPI handle for INR support (GPay, PhonePe, Paytm, BHIM). */
  upi: env(process.env.NEXT_PUBLIC_MAINTAINER_UPI, "princeramgarhiaa-1@okaxis"),
  /** International fallback: cards / PayPal balance. */
  paypal: env(
    process.env.NEXT_PUBLIC_MAINTAINER_PAYPAL,
    "https://www.paypal.com/donate/?business=princeramgarhiaa@gmail.com&currency_code=USD&item_name=Support%20OpenAdKit",
  ),
  tagline: env(process.env.NEXT_PUBLIC_MAINTAINER_TAGLINE, "Free and open source. No subscriptions. Built in India."),
} as const;

/** Preset INR amounts on the support page. */
export const UPI_AMOUNTS = [100, 250, 500, 1000] as const;

/**
 * The note that shows up in the payee's bank statement. Names the software
 * so the payment is identifiable weeks later; the optional name lets
 * DiceCodes thank the supporter. Only safe characters, max 50.
 */
export function upiNote(payerName?: string): string {
  const name = (payerName ?? "").replace(/[^\p{L}\p{N} .,'-]/gu, "").replace(/\s+/g, " ").trim();
  const note = name ? `OpenAdKit support - ${name}` : "OpenAdKit support";
  return note.slice(0, 50);
}

/** `upi://pay?...` deep link understood by every UPI app. */
export function upiDeepLink(opts?: { amount?: number | null; note?: string }): string {
  if (!MAINTAINER.upi) return "";
  const params = new URLSearchParams({ pa: MAINTAINER.upi, pn: MAINTAINER.name, cu: "INR" });
  if (opts?.amount && opts.amount > 0) params.set("am", String(Math.round(opts.amount)));
  if (opts?.note) params.set("tn", opts.note);
  // %20 rather than "+" for spaces: several UPI apps show a literal "+" in the note.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** Pre-filled "project enquiry" email. */
export function enquiryMailto(subject = "Project enquiry (from OpenAdKit)"): string {
  return `mailto:${MAINTAINER.contactEmail}?subject=${encodeURIComponent(subject)}`;
}

/** WhatsApp share text for "tell another marketer". */
export function whatsappShareUrl(): string {
  const text =
    "OpenAdKit — free, open source AI ad generator for Google, Meta, TikTok, LinkedIn and more. " +
    "Bring your own AI key, no subscription: " +
    REPO_URL;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
