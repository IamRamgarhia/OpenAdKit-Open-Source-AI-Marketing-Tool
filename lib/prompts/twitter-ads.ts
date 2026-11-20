export const TWITTER_LIMITS = {
  tweet: 280,
  promoted_video_caption: 280,
  website_card_title: 70,
  /** Every link counts as this many characters (t.co wrapping). */
  link: 23,
} as const;

export interface TwitterInput {
  format: "promoted_tweet" | "promoted_video" | "website_card" | "follower_ad" | "thread";
  product: string;
  objective: string;
  voice: string;
  /** Where the ad sends people (optional). */
  landing_url?: string;
  /** Audience country / region (optional) — enables the posting-time window. */
  audience_geo?: string;
}

import { ANTI_FABRICATION_RULE, PROOF_RULE } from "./common-rules";

/** What each X format is and how its copy must be built. */
const FORMAT_SPECS: Record<Exclude<TwitterInput["format"], "thread">, string> = {
  promoted_tweet: `FORMAT — Promoted post (text, optionally with one image):
- "text" is the full post: ≤ 280 characters, where ANY link counts as exactly ${TWITTER_LIMITS.link} characters (X wraps it in t.co).
- If a landing URL is given, end the post with it (budget 23 chars + 1 space for it). If not, write no URL and no "[link]" placeholder.
- Line 1 carries the message — the feed may truncate the rest.`,
  promoted_video: `FORMAT — Promoted video:
- "text" is the caption shown above the video: ≤ 280 characters (links count as ${TWITTER_LIMITS.link}); aim for under 100 — the video carries the message.
- Write it so it makes sense with the video muted; name what the viewer will see.
- If a landing URL is given, it goes on the video's website button, not in the caption.`,
  website_card: `FORMAT — Website card (post + clickable card with image, headline and URL):
- "text" is the post copy above the card: ≤ 280 characters. Do NOT put the URL in the text — the card carries it.
- "website_card_title" is the card headline: ≤ ${TWITTER_LIMITS.website_card_title} characters, states the benefit or the action, works without the post text.`,
  follower_ad: `FORMAT — Follower ad (promotes the account, not a product page):
- "text" is the post: ≤ 280 characters. Tell people what they'll get by following (the kind of posts, how often) — no URL, no product pitch, no "follow for more".`,
};

const HASHTAG_RULE = "HASHTAGS: 0-2 per post, only if they are relevant and genuinely used (e.g. a branded or event tag). More than 2 reads as spam on X.";

export function buildTwitterPrompt(input: TwitterInput): string {
  const url = (input.landing_url ?? "").trim();
  const geo = (input.audience_geo ?? "").trim();
  const shared = `${ANTI_FABRICATION_RULE}

${PROOF_RULE}

${HASHTAG_RULE}
LINKS: any URL in a post counts as exactly ${TWITTER_LIMITS.link} characters on X (t.co), however long it is.

INPUT:
- Landing URL: ${url || "(none given — do not invent one)"}
- Audience geo: ${geo || "(not given)"}`;

  if (input.format === "thread") {
    return `Generate a 6-post promoted thread on X for: ${input.product}
Objective: ${input.objective}
Brand voice: ${input.voice || "(direct, witty, slightly contrarian)"}

${shared}

RULES:
- Each post ≤ 280 characters; a link counts as ${TWITTER_LIMITS.link}. Count yourself.
- The hook post must work standalone — readers may never see post 2.
- The "proof" post uses a fact from the brand brain or the input (feature, process, guarantee, a stat ONLY if listed). Never invent numbers or customers.
- Final post ends with the CTA${url ? ` and the landing URL (${url})` : " (no URL was given — do not add a placeholder)"}.
- No emoji spam. One emoji max per post, only if it earns its place.
- Hashtags only in the final post (0-1).

Return ONLY valid JSON:
{
  "thread": [
    { "position": 1, "role": "hook", "text": "string", "chars": 0 },
    { "position": 2, "role": "problem", "text": "string", "chars": 0 },
    { "position": 3, "role": "context", "text": "string", "chars": 0 },
    { "position": 4, "role": "solution", "text": "string", "chars": 0 },
    { "position": 5, "role": "proof", "text": "string", "chars": 0 },
    { "position": 6, "role": "cta", "text": "string", "chars": 0 }
  ]
}`;
  }

  const spec = FORMAT_SPECS[input.format] ?? FORMAT_SPECS.promoted_tweet;
  const isCard = input.format === "website_card";
  const timeRule = geo
    ? `- best_time_window_utc: a typical weekday engagement window for an audience in ${geo}, written in UTC with the local time in brackets, prefixed "rule of thumb:". Not account data.`
    : `- best_time_window_utc: "" (empty string) — no audience geo was given, so don't guess a time zone.`;

  return `Generate 5 X (Twitter) ${input.format.replace(/_/g, " ")} variants for: ${input.product}
Objective: ${input.objective}
Voice: ${input.voice || "(direct, witty, scroll-stopping)"}

${spec}

${shared}

RULES:
- 5 distinct angles — no near-duplicates. Angles: pain, curiosity, contrarian, specific_fact (a concrete fact from the brand brain or input — not an invented stat), confession.
- "chars" = the X-weighted count (links = ${TWITTER_LIMITS.link}). status "over" → give a trimmed_alt that fits.
${isCard ? `- website_card_title: one card headline ≤ ${TWITTER_LIMITS.website_card_title} characters.` : `- website_card_title: "" (empty string — this format has no card).`}
${timeRule}

Return ONLY valid JSON:
{
  "tweets": [
    {
      "label": "A | B | C | D | E",
      "angle": "pain | curiosity | contrarian | specific_fact | confession",
      "text": "string",
      "chars": 0,
      "status": "ok | over",
      "trimmed_alt": "string or null"
    }
  ],
  "website_card_title": "${isCard ? `string ≤ ${TWITTER_LIMITS.website_card_title} chars` : ""}",
  "best_time_window_utc": "${geo ? "string, e.g. 'rule of thumb: 03:30-05:30 UTC (9-11am local)'" : ""}"
}`;
}
