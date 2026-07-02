import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Server and first client render both emit USD so React hydration matches;
// only after the first paint do we flip to the user's chosen currency, which
// re-renders (StatusBar, /history) then pick up. (Hydration-mismatch fix.)
let hydrated = false;
if (typeof window !== "undefined") {
  requestAnimationFrame(() => {
    hydrated = true;
  });
}

export function formatCost(usd: number): string {
  // Routes through the currency setting so /history, StatusBar, and any other
  // cost-display surface honor the user's chosen currency.
  if (typeof window === "undefined" || !hydrated) {
    // SSR + first client render fall back to USD so markup agrees on hydration.
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
  }
  // Lazy import so SSR doesn't choke on the browser-only localStorage path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { formatMoney } = require("./currency");
  return formatMoney(usd, { fromUsd: true });
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function countChars(s: string | null | undefined): number {
  return (s ?? "").length;
}

/** Validate an AI-emitted or user-supplied URL before rendering as <a href>.
 *  Returns the URL only if it's a real http(s) URL — blocks javascript:, data:,
 *  vbscript:, file:, and other schemes that could exfiltrate keys from
 *  localStorage if a prompt-injected response slips through. (Audit MEDIUM-1.) */
export function safeHref(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" || u.protocol === "tel:") {
      return trimmed;
    }
    return null;
  } catch {
    // Relative URLs (no scheme) are also safe — they resolve against the
    // current origin and can't execute scripts.
    if (/^[\/.#?]/.test(trimmed) && !trimmed.includes(":")) return trimmed;
    return null;
  }
}
