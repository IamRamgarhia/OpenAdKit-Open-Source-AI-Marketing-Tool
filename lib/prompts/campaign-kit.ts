import type { BrandBrain } from "../brand-brain";

export interface CampaignKitInput {
  campaign_name: string;
  product: string;
  primary_offer: string;
  audience: string;
  goal: string;
  budget_monthly: string;
}

import { BANNED_WORDS_RULE, HONESTY_CLAUSE, ANTI_FABRICATION_RULE, PROOF_RULE, mentionsIndia } from "./common-rules";

/** Campaign-kit surfaces and how a brand's platform list maps onto them. */
const SURFACES: { name: string; match: RegExp }[] = [
  { name: "Google Search", match: /google|search|sem|ppc/i },
  { name: "Meta (Facebook / Instagram)", match: /meta|facebook|instagram|\bfb\b|\big\b|reels/i },
  { name: "TikTok", match: /tiktok/i },
  { name: "YouTube", match: /youtube|shorts/i },
  { name: "LinkedIn", match: /linkedin/i },
  { name: "X (Twitter)", match: /twitter|\bx\b/i },
];

/** Surfaces the brand already uses, from its Brand Brain platforms. */
export function brandSurfaces(platforms: readonly string[] | undefined): string[] {
  const list = (platforms ?? []).filter(Boolean);
  return SURFACES.filter((s) => list.some((p) => s.match.test(p))).map((s) => s.name);
}

export function buildCampaignKitPrompt(input: CampaignKitInput, brain?: BrandBrain | null): string {
  const surfaces = brandSurfaces(brain?.platforms);
  const india = mentionsIndia(input.audience, input.budget_monthly, input.product, brain?.service_area, brain?.audience_who, brain?.audience_demographics);
  const surfaceRule = surfaces.length
    ? `The brand's Brand Brain lists these platforms: ${surfaces.join(", ")}. Allocate budget across THESE first. A surface the brand doesn't use gets 0% unless the goal clearly needs it (say why).`
    : "No platform list in the Brand Brain: choose the 2-4 surfaces that fit this goal, audience and budget; the rest get 0%.";
  const indiaRule = india
    ? "\nMARKET CHECK: the audience / budget points to India. TikTok is not available in India (banned since 2020): give TikTok 0% and use Instagram Reels / YouTube Shorts for short-form video instead. The \"tiktok\" block stays empty."
    : "";

  return `Generate a complete multi-platform campaign kit for: ${input.campaign_name}

${BANNED_WORDS_RULE}

${HONESTY_CLAUSE}

${ANTI_FABRICATION_RULE}

${PROOF_RULE}

ALL OUTPUT MUST BE MESSAGE-MATCHED to ONE central USP/promise. Variants per platform — but all anchored to the same hook.

CASCADE RULE (Copycat / marketingskills pattern): START at the tightest constraint (Google headline 30 chars) and expand outward. Never start at long-form first.

INPUT:
- Product / service: ${input.product}
- Primary offer: ${input.primary_offer}
- Audience: ${input.audience}
- Goal: ${input.goal}
- Monthly budget: ${input.budget_monthly}

SURFACES:
${surfaceRule}${indiaRule}
For every surface at 0%, return its block with empty strings / empty arrays instead of writing copy nobody will run.

GENERATE — one bundle:

1. The MASTER HOOK (one sentence, ≤ 90 chars). This is the anchor every platform variant must echo.

2. GOOGLE RSA: 5 headlines (≤ 30), 2 descriptions (≤ 90).

3. META FEED: 3 primary text variants (≤ 125 above-fold), 3 headlines (≤ 40), 1 CTA button.

4. TIKTOK (only if allocated): 5 hooks (≤ 12 words each) + 1 UGC creator brief (4–6 sentences).

5. YOUTUBE IN-STREAM (only if allocated): 15-second script (hook, value, CTA).

6. LINKEDIN (only if allocated): 1 sponsored content post (intro ≤ 150, headline ≤ 70).

7. X / TWITTER (only if allocated): 3 posts (≤ 280 each; a link counts as 23).

8. EMAIL SUBJECT LINES (5): paired send for retargeting list.

9. LANDING PAGE HERO COPY: H1 (≤ 60), subhead (≤ 140), 3 bullet benefits, CTA button text.

10. BUDGET ALLOCATION — % split across the surfaces above (must total 100). Justify each % from the goal, audience and budget; a 0% line says why.

11. KPI TARGETS — up to 3 month-1 targets. Each states its basis: a figure from the input or Brand Brain (e.g. "your current CPA"), or the word "estimate" with the assumption behind it. Never present an invented number as a target the brand already hits.

Return ONLY valid JSON:
{
  "master_hook": "string",
  "master_usp": "string",
  "google_rsa": { "headlines": ["string"], "descriptions": ["string"] },
  "meta_feed": { "primary_text": ["string"], "headlines": ["string"], "cta": "string" },
  "tiktok": { "hooks": ["string"], "ugc_brief": "string" },
  "youtube_in_stream": {
    "hook": { "t": "0-3s", "vo": "string", "visual": "string" },
    "value": { "t": "3-12s", "vo": "string", "visual": "string" },
    "cta": { "t": "12-15s", "vo": "string", "visual": "string" }
  },
  "linkedin": { "intro": "string", "headline": "string" },
  "twitter": ["string"],
  "email_subjects": ["string"],
  "landing_hero": { "h1": "string", "subhead": "string", "bullets": ["string"], "cta_button": "string" },
  "budget_split": [
    { "platform": "string", "pct": 0, "rationale": "string" }
  ],
  "kpi_targets": [
    { "metric": "string", "target": "string", "by_when": "string", "basis": "string — input / brand-brain figure, or 'estimate: <assumption>'" }
  ]
}`;
}
