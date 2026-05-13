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

export function buildQualityScorePrompt(input: QualityScoreInput): string {
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
- Moving QS 5 → 7 typically reduces CPC 16-28% AND raises ad rank.
- QS is NOT affected by bid, budget, device, or time of day.

PHASE 1 — COMPUTE THE NUMBERS:
- CTR = clicks / impressions × 100 (2dp)
- Conversion rate = conversions / clicks × 100 (2dp)
- CPA = (avg_cpc × clicks) / conversions if all present
- CPC = avg_cpc as given (verify reasonableness)
- If a metric can't be computed, mark "could not be computed" — never invent.

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
- Is concrete and copy-paste actionable ("Add headline 'Project Management for Teams of 10-50' (28 chars, exact-match keyword)") — never generic ("improve headline").
- Includes expected impact directionally ("Likely +0.5–1.0 QS · -8-15% CPC").

PHASE 6 — RSA-READY HEADLINES:
Generate 5 improved headlines ≤ 30 chars that:
- Include the exact keyword "${input.keyword}" in at least 3 of them
- Each targets ONE specific factor (mark which)

PHASE 7 — NEGATIVES + LANDING PAGE CHECKLIST:
- 6-10 negative keywords (anchor to actual search-terms input when provided, else use intent heuristics for the keyword).
- 8-item landing page checklist against Google's actual signals (load speed, mobile usability, content match, transparency, navigation, original content, security, social proof).

PHASE 8 — PROJECTION:
Given the fixes above, project:
- Current QS → After fixes QS (cap at 10).
- CPC savings estimate as a directional range ("8-22% lower CPC").
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
      "expected_impact": "string — directional, e.g. '+0.5-1.0 QS · -10-18% CPC'"
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
    "after_fixes": 0,
    "cpc_savings_estimate": "string (directional)",
    "reasoning": "string — anchored to which factors moved"
  }
}`;
}
