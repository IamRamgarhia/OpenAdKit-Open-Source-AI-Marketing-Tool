export interface SparkInput {
  product: string;
  audience: string;
  organic_post_context: string;
  brand_voice: string;
}

import { VIDEO_HOOK_RULE, ANTI_FABRICATION_RULE, PROOF_RULE } from "./common-rules";

export function buildSparkAdsPrompt(input: SparkInput): string {
  return `Generate a TikTok Spark Ads creator brief PLUS the boost-decision rules for picking which organic post to spark.

${VIDEO_HOOK_RULE}

${ANTI_FABRICATION_RULE}

${PROOF_RULE}

CONTEXT — Spark Ads boost an organic post (the brand's own or a creator's, with their authorization code) into a paid placement. The post keeps its handle, comments and likes, so it reads as native content rather than an ad. Advertisers commonly report better engagement than standard In-Feed ads, but results vary by account — don't promise a CPM or CTR.

It only works if the original post earned attention organically — boosting a flop does not save it.

INPUT:
- Product: ${input.product}
- Target audience: ${input.audience}
- Organic post / creator context: ${input.organic_post_context}
- Brand voice: ${input.brand_voice || "(let Claude infer from creator's native style)"}

GENERATE:
1. BOOST-DECISION CRITERIA — which organic posts are worth sparking? Express thresholds RELATIVE to the account's own organic baseline (e.g. "2-second view rate above your median post") unless the input gives real numbers. Any absolute figure must be labelled "directional".
2. CREATOR BRIEF — short, native-feeling brief the creator can actually follow:
   - "Show, don't tell" specifics
   - What NOT to do (no jump-cuts, no logo card, no scripted pitch)
   - The single performance goal for the post
3. ADAPTATION COPY — caption + on-screen text variants tuned for paid placement (still ≤ 100 chars).
4. SPONSORSHIP DISCLOSURE — TikTok-compliant disclosure language (FTC compliant, TikTok-policy compliant).
5. CTA OVERLAY — when and how to add the CTA without breaking native feel (last 2-3 seconds typically).
6. KILL/SCALE RULES — when to stop the Spark boost vs scale up. Triggers relative to the boost's first days (e.g. "cost per result 30% above day-1-3 average") unless the input gives targets. The spend cap is in the brand's currency; 0 if no budget was given.
7. AUDIENCE TARGETING — interest/behavior/lookalike recommendations for the boosted post.

Return ONLY valid JSON:
{
  "boost_decision_criteria": {
    "hook_rate_min_pct": 0,
    "completion_rate_min_pct": 0,
    "organic_engagement_rate_min_pct": 0,
    "thresholds_basis": "string — 'your organic baseline' or 'directional rule of thumb'",
    "post_age_max_days": 0,
    "do_not_spark_if": ["string"]
  },
  "creator_brief": {
    "show_dont_tell": ["string"],
    "do_not": ["string"],
    "single_goal": "string",
    "creator_personality_match_check": "string"
  },
  "adaptation_copy": {
    "caption_variants": ["string ≤ 100 chars"],
    "on_screen_text_variants": ["string"],
    "hashtag_strategy": ["#string"]
  },
  "disclosure": {
    "in_caption": "string",
    "in_video": "string",
    "duration_visible_seconds": 0
  },
  "cta_overlay": {
    "timing_seconds": "string e.g. '23-27 of 30s post'",
    "text": "string",
    "visual_treatment": "string"
  },
  "scale_rules": {
    "scale_when": "string with numeric trigger",
    "kill_when": "string with numeric trigger",
    "max_spend_per_post_usd": 0,
    "spend_cap_note": "string — the cap is in the brand's currency (the key name is legacy)"

  },
  "audience_targeting": {
    "interests": ["string"],
    "behaviors": ["string"],
    "lookalike_seed": "string",
    "exclusions": ["string"]
  }
}`;
}
