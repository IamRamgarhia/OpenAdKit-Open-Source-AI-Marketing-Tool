import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * robots.txt. Only evergreen public pages are crawlable; app routes that
 * need a key or hold personal data are not.
 *
 * AI crawlers are named explicitly so OpenAdKit can be cited by AI search.
 * A crawler obeys ONLY the most specific group that names it (it does not
 * merge in the `*` group), so every group carries the full Disallow list.
 *
 * Generated (not a static file) so the Sitemap line points at this
 * deployment's own origin.
 */
const ALLOW = [
  "/",
  "/about",
  "/support",
  "/benchmarks",
  "/platforms",
  "/platforms/",
  "/learn",
  "/learn/",
  "/launch-guide",
  "/alternatives",
  "/how-to-use",
  "/providers",
  "/strategy/decision-tree",
];
const DISALLOW = [
  "/api/",
  "/brand",
  "/generate/",
  "/optimize/",
  "/research/",
  "/launch/wizard",
  "/settings",
  "/setup",
  "/history",
  "/suggestions",
  "/report",
  "/strategy",
  "/campaigns",
];
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: ["/", "/strategy/decision-tree"], disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
