export const CTR_BENCHMARKS = {
  google_search_avg_2025: 4.99,
  google_by_industry: {
    ecommerce: 2.69,
    finance: 2.91,
    healthcare: 3.27,
    legal: 3.84,
    real_estate: 3.71,
    b2b_saas: 2.45,
  },
  meta: {
    feed: "0.9–1.5%",
    stories: "0.5–0.8%",
    carousel: "1.2–2.2%",
    reels: "1.0–1.8%",
  },
  tiktok: {
    in_feed: "1.5–3.0%",
    spark_ads: "~3.0%",
  },
} as const;

export interface CtrInput {
  platform: string;
  industry: string;
  current_copy: string;
  impressions?: number | string;
  clicks?: number | string;
  conversions?: number | string;
  spend?: string;
  avg_cpc?: string;
  search_terms?: string;
  reporting_window?: string;
  goal?: string;
  audience_one_liner?: string;
}

import { CREATIVE_TESTING_HIERARCHY, DIAGNOSIS_TREES } from "./common-rules";

export function buildCtrPrompt(input: CtrInput): string {
  return `You are diagnosing a paid ad's CTR using real performance data, then prescribing targeted rewrites.

${DIAGNOSIS_TREES}

${CREATIVE_TESTING_HIERARCHY}

INPUT — performance data:
- Platform: ${input.platform}
- Industry: ${input.industry}
- Reporting window: ${input.reporting_window || "not specified"}
- Goal: ${input.goal || "increase_ctr"}
- Impressions: ${input.impressions || "(not provided)"}
- Clicks: ${input.clicks || "(not provided)"}
- Conversions: ${input.conversions || "(not provided)"}
- Spend: ${input.spend || "(not provided)"}
- Avg CPC reported: ${input.avg_cpc || "(not provided)"}
- Audience one-liner: ${input.audience_one_liner || "(see brand brain)"}

INPUT — ad copy:
"""
${input.current_copy}
"""

INPUT — top search terms / queries triggering this ad:
"""
${input.search_terms || "(not provided)"}
"""

IF AN IMAGE IS ATTACHED:
The user has dropped a screenshot of their ads dashboard. Read it. Extract impressions,
clicks, conversions, spend, CTR, CPC, conversion rate, search terms, and anything else
visible. When the typed fields above conflict with what's in the image, trust the image
(it's the source-of-truth screenshot). When a metric is only in the image and not in
the typed fields, USE the image value. Cite "(from screenshot)" in the diagnosis_summary
or notes when image-derived data drives a conclusion.

PHASE 1 — ANALYZE THE NUMBERS FIRST (do not skip):
- Compute CTR = clicks / impressions × 100, rounded to 2dp.
- Compute conversion rate = conversions / clicks × 100, rounded to 2dp.
- Compute CPA = spend / conversions if both present.
- Compute CPC = spend / clicks if both present (cross-check with reported avg CPC; flag mismatches > 10%).
- If any input is missing, note that the metric "could not be computed" — never invent numbers.

PHASE 2 — BENCHMARK COMPARISON:
- Google Search 2025 avg CTR 4.99% (industry varies — ecommerce 2.69%, finance 2.91%, healthcare 3.27%, legal 3.84%, real estate 3.71%, B2B SaaS 2.45%).
- Meta Feed 0.9–1.5% · Stories 0.5–0.8% · Reels 1.0–1.8% · Carousel 1.2–2.2%.
- TikTok In-Feed 1.5–3.0% · Spark Ads ~3.0%.
- Verdict tiers vs computed CTR: above_avg (>20% above benchmark), at_avg (±20%), below_avg (20-50% below), severely_below (>50% below).

PHASE 3 — SEARCH-TERM ANALYSIS (only if queries provided):
For each provided query (or cluster of similar queries) classify intent: buying / research / problem-aware / low_intent / branded / wrong_audience.
Note any query that suggests the ad is matching irrelevant intent — that's an immediate CTR drag.

PHASE 4 — LEVER SCORING (0-10 with named reason — no vague verdicts):
- emotional_trigger: is a feeling pulled (FOMO, pride, fear of loss, identity)?
- specificity: numbers, named entities, dated claims?
- urgency: time-bound or scarcity language?
- power_words: action verbs that move (vs filler "get", "find", "discover" alone)?
- relevance: does the copy address the user's actual query intent (see Phase 3)?
Every reason must NAME the specific phrase / word / structural choice causing the problem. Forbidden: "the copy is weak". Required: 'Headline 1 ("Get Started Today") uses a generic CTA verb with no specificity, benefit, or urgency — 3 missing levers in 18 chars.'

PHASE 5 — REWRITES:
Produce 5 rewrites, each targeting ONE lever. Show exact before → after with the SAME goal in each case (don't change what the ad sells). Predict lift in DIRECTIONAL terms only (e.g. "+30–60%", "small", "marginal"). Never quote a fabricated exact %.

PHASE 6 — KILL / ITERATE / REWRITE-FROM-SCRATCH:
- iterate: 3+ levers scored ≥6 AND verdict is below_avg/at_avg AND search-term intent is mostly correct.
- rewrite_from_scratch: 3+ levers scored ≤4 OR copy/audience mismatch is severe.
- kill: verdict severely_below AND conversion rate < 0.5% AND no obvious lever to fix (poor product/market fit signal, not copy).

Return ONLY valid JSON:
{
  "computed_metrics": {
    "ctr": "string (e.g. '1.43%' or 'could not be computed')",
    "conversion_rate": "string",
    "cpa": "string",
    "cpc": "string",
    "notes": "string — call out any mismatches between reported and computed (e.g. 'reported CPC $4.56 vs computed $4.21 — discrepancy may indicate auction-time bid changes')"
  },
  "verdict": "above_avg | at_avg | below_avg | severely_below",
  "industry_benchmark_cited": "string (e.g. 'B2B SaaS Google Search avg 2.45%')",
  "diagnosis_summary": "string (2-3 sentences) — grounded in the computed metrics, not generic",
  "search_term_signals": [
    { "intent": "buying | research | problem_aware | low_intent | branded | wrong_audience",
      "observation": "string — name the query and what it tells you" }
  ],
  "scores": {
    "emotional_trigger": { "score": 0, "reason": "string — name names" },
    "specificity": { "score": 0, "reason": "string" },
    "urgency": { "score": 0, "reason": "string" },
    "power_words": { "score": 0, "reason": "string" },
    "relevance": { "score": 0, "reason": "string" }
  },
  "rewrites": [
    {
      "lever_targeted": "emotional_trigger | specificity | urgency | power_words | relevance",
      "before": "exact phrase from input",
      "after": "rewritten phrase",
      "expected_lift_directional": "string"
    }
  ],
  "full_rewritten_version": "string — best holistic rewrite combining the wins above",
  "kill_or_iterate": "iterate | rewrite_from_scratch | kill",
  "kill_or_iterate_reason": "string — anchored to the computed metrics + lever scores"
}`;
}
