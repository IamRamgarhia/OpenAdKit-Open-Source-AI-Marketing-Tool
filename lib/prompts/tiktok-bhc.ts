export interface BhcInput {
  brand: string;
  product_or_message: string;
  target_audience: string;
  budget_band: "100k_300k" | "300k_1m" | "gt_1m";
  desired_action: string;
  geo: string;
}

import { VIDEO_HOOK_RULE, ANTI_FABRICATION_RULE, PROOF_RULE, mentionsIndia } from "./common-rules";

const BUDGET_LABEL: Record<string, string> = {
  "100k_300k": "100k–300k (USD-equivalent)",
  "300k_1m": "300k–1M (USD-equivalent)",
  gt_1m: "over 1M (USD-equivalent)",
};

export function buildBhcPrompt(input: BhcInput): string {
  const india = mentionsIndia(input.geo, input.target_audience);
  const marketGuard = india
    ? `
MARKET CHECK (overrides everything below): TikTok is not available in India (banned since 2020). A Branded Hashtag Challenge cannot run there. Set viability.score ≤ 2, recommend_proceed = false, and in alternative_if_not recommend an Instagram Reels / YouTube Shorts creator challenge instead. Still fill the brief, written so it can be adapted to Reels / Shorts, and say so in viability.reasoning.
`
    : "";
  return `Generate a TikTok Branded Hashtag Challenge brief.

${VIDEO_HOOK_RULE}

${ANTI_FABRICATION_RULE}

${PROOF_RULE}

CONTEXT — Branded Hashtag Challenges are TikTok's sponsored user-generated participation campaigns:
- They are a premium, sales-negotiated product: pricing is quoted by TikTok per market and changes — check current rates with a TikTok rep; don't quote figures as fact.
- The challenge is promoted for a fixed featured period (historically about 6 days) on the Discover page.
- Outcomes vary widely: strong concepts get large participation, weak ones can spend the featured slot with little participation — high-risk.
${marketGuard}
DECISION GUARD: if the input suggests this won't work (niche B2B / no cultural angle / passive product / market where TikTok isn't available), flag it.

INPUT:
- Brand: ${input.brand}
- Product / message: ${input.product_or_message}
- Audience: ${input.target_audience}
- Budget band: ${BUDGET_LABEL[input.budget_band] ?? input.budget_band}
- Desired action: ${input.desired_action}
- Geo: ${input.geo}

GENERATE:

1. **Viability assessment** — should they actually do a BHC? Score 0-10 with reasoning. Below 6 = recommend Spark Ads instead.

2. **Hashtag concept** — the actual #BrandedHashtag. Rules:
   - Memorable in ≤ 3 syllables when spoken
   - Has to make sense without context
   - Not a verb that's already in common use (low-distinctiveness)
   - You cannot check live usage: list possible conflicts as "unverified — check before launch" (search the tag on TikTok first)
   - Bilingual-friendly if relevant geo

3. **Participation mechanics** — what do users DO to participate?
   - The clear, simple instruction (one sentence)
   - The visual / audio / dance / transformation that defines the challenge
   - The story arc users can riff on (without prescribing it)
   - What rewards / featured-by-brand incentive

4. **Seed creator strategy** — which 3-5 creator archetypes should kick this off
   - Tier (mega, macro, mid, micro)
   - Why this archetype
   - Specific brief points for each
   - Required posting cadence in week 1

5. **Featured Discover page copy** — TikTok limits:
   - Challenge name display (≤ 24 chars)
   - Description (≤ 80 chars)
   - Featured creator brief

6. **Sound strategy** — original sound vs licensed track. With reasoning.

7. **Six-day timeline** — what happens each of the 6 featured days?

8. **Success metrics + kill criteria** — when to declare win vs cut losses early
   - Day 1 floor: minimum participations (a directional target the brand sets — label it so, not a forecast)
   - Day 3 checkpoint
   - End-of-week win threshold

9. **Compliance** — disclosure language, age-gating if relevant, brand-safety constraints.

Return ONLY valid JSON:
{
  "viability": {
    "score": 0,
    "reasoning": "string",
    "recommend_proceed": true,
    "alternative_if_not": "string"
  },
  "hashtag": {
    "tag": "#string",
    "rationale": "string",
    "potential_conflicts": ["string — possible conflict, marked 'unverified — check before launch'"]
  },
  "participation_mechanic": {
    "instruction": "string ≤ 1 sentence",
    "defining_element": "string",
    "story_arc": "string",
    "incentive": "string"
  },
  "seed_creators": [
    { "tier": "mega|macro|mid|micro", "archetype": "string", "rationale": "string", "brief_points": ["string"], "post_cadence_week_1": "string" }
  ],
  "discover_page": {
    "challenge_name": "string ≤ 24 chars",
    "description": "string ≤ 80 chars",
    "featured_creator_brief": "string"
  },
  "sound_strategy": {
    "approach": "original | licensed | both",
    "rationale": "string"
  },
  "six_day_timeline": [
    { "day": 1, "actions": ["string"], "expected_outcome": "string" }
  ],
  "success_metrics": {
    "day_1_floor_participations": 0,
    "day_3_checkpoint": "string",
    "end_of_week_win_threshold": "string",
    "kill_signal": "string"
  },
  "compliance": {
    "disclosure_language": "string",
    "age_gating_needed": false,
    "brand_safety_constraints": ["string"]
  }
}`;
}
