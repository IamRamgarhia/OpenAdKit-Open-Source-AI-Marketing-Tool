export interface AudienceTargetingInput {
  platform: "meta" | "google" | "linkedin" | "tiktok";
  product: string;
  audience_who: string;
  budget_monthly: string;
  geo: string;
  goal: string;
  current_cpa?: string;
  current_cvr?: string;
  current_aov_or_ltv?: string;
  existing_audiences?: string;
  best_creator_audience?: string;
}

import { RETARGETING_MATRIX, MANDATORY_EXCLUSIONS } from "./common-rules";

export function buildAudienceTargetingPrompt(input: AudienceTargetingInput): string {
  return `Design a layered audience targeting plan for ${input.platform}, anchored to the real performance data the user provided.

${RETARGETING_MATRIX}

${MANDATORY_EXCLUSIONS}


PRINCIPLE: stack OVERLAPPING signals (in-market + behavior + demographic) rather than narrow on a single dimension. Cold prospecting needs reach; retargeting needs reach × intent.

INPUT — context:
- Platform: ${input.platform}
- Product: ${input.product}
- Who buys this: ${input.audience_who}
- Geo: ${input.geo}
- Goal: ${input.goal}

INPUT — performance data:
- Monthly budget: ${input.budget_monthly}
- Current CPA: ${input.current_cpa || "(not provided)"}
- Current conversion rate: ${input.current_cvr || "(not provided)"}
- AOV / LTV: ${input.current_aov_or_ltv || "(not provided)"}
- Best-performing audience signal: ${input.best_creator_audience || "(not provided)"}

INPUT — audiences currently running (name · monthly spend · CPA, one per line):
"""
${input.existing_audiences || "(none provided — treat the plan as a fresh launch)"}
"""

IF AN IMAGE IS ATTACHED:
The user has dropped a screenshot of their Audiences tab (Meta Ads Manager / Google Audiences /
LinkedIn). Extract for each visible row: audience name, audience size, spend, impressions, CPA,
CVR. When typed fields and image conflict, trust the image. When metrics only appear in the image,
USE the image values. Cite "(from screenshot)" in audience_diagnosis when image-derived data drives
a tier or budget recommendation.

PHASE 1 — ANALYZE THE EXISTING SETUP:
For each audience already running:
  - Classify temperature (cold / warm / hot)
  - Compute CPA-to-budget ratio (overspending audiences first)
  - Identify which one to: scale (good CPA + room) / hold (good CPA + saturated) / pause (bad CPA) / replace (broken signal)
If nothing is currently running, mark audience_diagnosis = "(fresh launch — no existing data)".

PHASE 2 — REBALANCE AGAINST GOAL CPA:
If user provided current_cpa AND current_aov_or_ltv, target CPA ≤ 30% of AOV (or ≤ 15% of LTV).
Pick budget splits that move CURRENT CPA toward that target, not generic "60/30/10" defaults.
Note the math: "AOV $120 → CPA target ≤ $36 · current CPA $42 → over by 17% → cut Tier 1 share from
60% to 45% and reallocate to Tier 2 retargeting (cheaper CPA at this stage)."

PHASE 3 — DESIGN THE THREE TIERS (cold / warm / hot):

GENERATE — three tiers, ordered by audience temperature:

TIER 1: COLD PROSPECTING (broadest, highest fill, lowest CVR)
- Recommended audience size range (Meta/TikTok: 2M-20M usually; LinkedIn: 100k-1M; Google: in-market segments)
- Interest stacks (groups of 3-5 interests OR'd together)
- Demographic constraints
- Lookalike seeds (which source list, what %)
- Geo refinement
- Budget % allocation

TIER 2: WARM RETARGETING (medium reach, medium-high intent)
- Website visitors (rules: time on site, pages visited, days back)
- Video viewers (% completion threshold)
- Engagers (likes, comments, shares)
- Email list (Customer Match / LinkedIn / Meta CRM upload)
- Budget % allocation

TIER 3: HOT REMARKETING (small reach, highest intent)
- Cart abandoners / form-starters
- Past purchasers for upsell/cross-sell
- Suppression rules — exclude recent converters, exclude do-not-contact
- Budget % allocation

For each tier add:
- KPI target appropriate to temperature
- Frequency cap recommendation
- Creative format that converts best at this stage

EXCLUSIONS (apply across all tiers):
- Current customers (unless tier 3)
- Recent converters (last 30 days for sales, last 7 for trial signups)
- Competitor employees (LinkedIn specifically)
- Anyone already in your CRM as not-a-fit

Return ONLY valid JSON:
{
  "audience_diagnosis": "string — what's working / what to pause / what to replace, anchored to provided CPA + CVR. Cite (from screenshot) where relevant. (fresh launch — no existing data) if no audiences were provided.",
  "computed_targets": {
    "cpa_target_ceiling": "string — the math (e.g. 'AOV $120 → CPA ≤ $36') · 'could not be computed' if AOV/LTV missing",
    "ltv_to_cpa_health": "healthy | tight | broken | unknown",
    "scale_or_squeeze": "scale | hold | squeeze | rebuild — what the existing setup should do next"
  },
  "cold_prospecting": {
    "audience_size_range": "string e.g. '5M-15M'",
    "interests_stacks": [{ "label": "string", "items": ["string"] }],
    "demographics": { "age_min": 0, "age_max": 0, "gender": "string", "income": "string", "education": "string" },
    "lookalike_seeds": [{ "source_list_name": "string", "match_pct": 0 }],
    "geo_refinement": "string",
    "budget_pct": 0,
    "kpi_target": "string",
    "frequency_cap": "string",
    "creative_format": "string"
  },
  "warm_retargeting": {
    "audiences": [
      { "name": "string", "rule": "string e.g. 'visited /pricing in last 14 days, time on site > 30s'", "expected_size": "string" }
    ],
    "budget_pct": 0,
    "kpi_target": "string",
    "frequency_cap": "string",
    "creative_format": "string"
  },
  "hot_remarketing": {
    "audiences": [
      { "name": "string", "rule": "string", "expected_size": "string" }
    ],
    "budget_pct": 0,
    "kpi_target": "string",
    "frequency_cap": "string",
    "creative_format": "string"
  },
  "exclusions": [
    { "name": "string", "rule": "string", "applies_to_tiers": ["cold", "warm", "hot"] }
  ],
  "platform_specific_features_to_enable": [
    { "feature": "string e.g. 'Meta Advantage+ Audience'", "use": true, "rationale": "string" }
  ]
}`;
}
