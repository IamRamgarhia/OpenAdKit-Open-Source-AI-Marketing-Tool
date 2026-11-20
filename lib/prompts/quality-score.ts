export interface QualityScoreInput {
  keyword: string;
  match_type?: string;
  current_qs?: string;
  expected_ctr_rating?: string;
  ad_relevance_rating?: string;
  landing_page_rating?: string;
  current_ad_copy: string;
  landing_page_url?: string;
  landing_page_summary: string;
  impressions?: number | string;
  clicks?: number | string;
  conversions?: number | string;
  avg_cpc?: string;
  top_search_terms?: string;
}

import { performanceMetrics, performanceLines, computedBlock } from "../ad-metrics";

export function qualityScoreMetrics(input: Pick<QualityScoreInput, "impressions" | "clicks" | "conversions" | "avg_cpc">) {
  return performanceMetrics({ impressions: input.impressions, clicks: input.clicks, conversions: input.conversions, avgCpc: input.avg_cpc });
}

export function buildQualityScorePrompt(input: QualityScoreInput): string {
  const computed = computedBlock(performanceLines(qualityScoreMetrics(input)));
  return `You are diagnosing Google Ads Quality Score using real factor ratings + performance data, then prescribing the exact changes that will move each factor.

INPUT — keyword:
- Target keyword: ${input.keyword}
- Match type: ${input.match_type || "(not specified)"}
- Current QS (1-10): ${input.current_qs || "(not provided)"}

INPUT — Google's three QS factor ratings (taken directly from the Keywords-tab QS tooltip):
- Expected CTR: ${input.expected_ctr_rating || "unknown"}
- Ad relevance: ${input.ad_relevance_rating || "unknown"}
- Landing page experience: ${input.landing_page_rating || "unknown"}

INPUT — ad copy (RSA headlines + descriptions exactly as in the platform):
"""
${input.current_ad_copy}
"""

INPUT — landing page:
- URL: ${input.landing_page_url || "(not provided)"}
- Summary: ${input.landing_page_summary}

INPUT — performance data:
- Impressions: ${input.impressions || "(not provided)"}
- Clicks: ${input.clicks || "(not provided)"}
- Conversions: ${input.conversions || "(not provided)"}
- Avg CPC reported: ${input.avg_cpc || "(not provided)"}

INPUT — top search terms triggering this keyword (from Search Terms report):
"""
${input.top_search_terms || "(not provided)"}
"""

CONTEXT (Google's actual rules — cite these in reasoning):
- Quality Score is 1-10 per keyword, computed from THREE factors:
  1. Expected CTR (below_average / average / above_average)
  2. Ad relevance (below_average / average / above_average)
  3. Landing page experience (below_average / average / above_average)
- A higher Quality Score generally lowers CPC and raises ad rank for the same bid (Google's auction documentation). How much varies by account — do not quote a percentage.
- QS is NOT affected by bid, budget, device, or time of day.

PHASE 1 — THE NUMBERS (already computed — read them, do not redo the math):
${computed}

PHASE 2 — RECONCILE COMPUTED METRICS WITH GOOGLE'S FACTOR RATINGS:
If user provided factor ratings AND we computed CTR, sanity-check:
- "Expected CTR: above_average" but computed CTR < industry avg → may be a low-impression-volume artifact, note it.
- "Ad relevance: above_average" but search terms include irrelevant queries → mismatch worth flagging.

PHASE 3 — DIAGNOSE EACH FACTOR (rating + named reason):
- Expected CTR: take the user-provided rating as source of truth (when present). Reason must NAME specific copy attributes — e.g. "Headlines 1–3 do not contain the exact keyword '${input.keyword}'; Google's algorithm strongly weights keyword presence in headlines for CTR prediction."
- Ad relevance: same. Score how tightly the ad text mirrors keyword + search-term intent.
- Landing page experience: same. Score against the LP summary. Note message-match (does the ad's promise appear above the fold on the LP?), page load (LCP), mobile UX, content depth, navigation transparency.

PHASE 4 — SEARCH-TERM ANALYSIS (only if queries provided):
Classify each query intent: buying / research / problem_aware / low_intent / branded / wrong_audience.
Flag queries that should be NEGATIVE keywords.

PHASE 5 — RANKED FIXES:
Produce 5-8 fixes ordered by expected QS impact. Each fix:
- Names the factor it targets
- Is concrete and copy-paste actionable ("Add headline 'Teeth Whitening in Pune' (23 chars, exact keyword)") — never generic ("improve headline").
- Rates expected impact as high / medium / low and names the factor it moves. Do not quote CPC or QS percentages — you cannot know them.

PHASE 6 — RSA-READY HEADLINES:
Generate 5 improved headlines ≤ 30 chars that:
- Include the exact keyword "${input.keyword}" in at least 3 of them
- Each targets ONE specific factor (mark which)

PHASE 7 — NEGATIVES + LANDING PAGE CHECKLIST:
- 6-10 negative keywords (anchor to actual search-terms input when provided, else use intent heuristics for the keyword).
- 8-item landing page checklist against Google's actual signals (load speed, mobile usability, content match, transparency, navigation, original content, security, social proof).

PHASE 8 — PROJECTION:
Given the fixes above, project:
- current: the QS from the input (0 if not provided).
- after_fixes: a directional range, labelled as an estimate (e.g. "estimate: 6-7"), capped at 10.
- cpc_savings_estimate: qualitative only (e.g. "lower CPC likely as expected CTR and landing page improve") — no percentages.
- One-sentence reasoning anchored to the factor changes.

Return ONLY valid JSON:
{
  "computed_metrics": {
    "ctr": "string",
    "conversion_rate": "string",
    "cpa": "string",
    "cpc": "string",
    "notes": "string — flag any reported-vs-computed mismatch"
  },
  "current_factors": {
    "expected_ctr": { "rating": "below_average | average | above_average | unknown", "reason": "string (name names)" },
    "ad_relevance": { "rating": "below_average | average | above_average | unknown", "reason": "string" },
    "landing_page_experience": { "rating": "below_average | average | above_average | unknown", "reason": "string" }
  },
  "search_term_signals": [
    { "intent": "buying | research | problem_aware | low_intent | branded | wrong_audience",
      "observation": "string — name the query and why it matters" }
  ],
  "fixes": [
    {
      "factor": "expected_ctr | ad_relevance | landing_page_experience",
      "fix": "string — specific, copy-paste actionable",
      "expected_impact": "high | medium | low — and the factor it moves"
    }
  ],
  "improved_headlines": [
    { "text": "string ≤ 30 chars", "chars": 0, "targets_factor": "expected_ctr | ad_relevance | landing_page_experience" }
  ],
  "negative_keywords": ["string"],
  "landing_page_checklist": [
    { "item": "string", "status_guess": "ok|issue|unknown", "fix_if_issue": "string" }
  ],
  "projected_qs": {
    "current": 0,
    "after_fixes": "string — directional range labelled 'estimate'",
    "cpc_savings_estimate": "string (qualitative, no percentages)",

    "reasoning": "string — anchored to which factors moved"
  }
}`;
}
