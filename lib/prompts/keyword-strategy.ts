export interface KeywordInput {
  product: string;
  market: string;
  competitors?: string;
  current_keywords?: string;
  search_terms_report?: string;
  monthly_budget?: string;
  current_conversions_per_month?: number | string;
  target_cpa?: string;
  search_console_export?: string;
}

export function buildKeywordPrompt(input: KeywordInput): string {
  return `Build a Google Ads keyword strategy for ${input.product}, anchored to the user's actual Search Terms data.

INPUT — context:
- Product / service: ${input.product}
- Market / region: ${input.market}
- Known competitors: ${input.competitors || "(not provided)"}
- Current keyword list (with match-type when provided):
"""
${input.current_keywords || "(no keywords running yet — fresh launch)"}
"""

INPUT — performance data:
- Monthly Google Ads budget: ${input.monthly_budget || "(not provided)"}
- Conversions / month (current): ${input.current_conversions_per_month || "(not provided)"}
- Target CPA: ${input.target_cpa || "(not provided)"}

INPUT — Search Terms report (the source of truth for what queries are actually triggering your ads):
"""
${input.search_terms_report || "(not provided — recommendations will be inference-based, less precise)"}
"""

INPUT — Search Console organic queries (optional, identifies SEO-overlap vs paid-only opportunities):
"""
${input.search_console_export || "(not provided)"}
"""

IF AN IMAGE IS ATTACHED:
The user has dropped a screenshot of their Search Terms report. Extract each visible row:
query · impressions · clicks · CTR · conversions · cost · added/excluded status. Use this
EXACTLY as if it were pasted text. When typed text and image conflict, trust the image.
Cite "(from screenshot)" in search_terms_analysis when image data drove a recommendation.

PHASE 1 — ANALYZE THE SEARCH TERMS REPORT (the highest-leverage step):
If search_terms_report is provided (or visible in screenshot), compute:
  - WASTE: total spend on queries with 0 conversions for ≥ X clicks (X depends on CPA target — 2× target CPA worth of clicks with zero conversions = clear waste).
  - HIGH-INTENT QUERIES: those that converted at or below target CPA. These deserve their own exact-match keyword + tighter ad group.
  - ZERO-CLICK QUERIES: high impressions but 0-1 clicks → ad copy/relevance issue OR a negative-keyword candidate.
  - MATCH-TYPE GAPS: queries triggering broad match keywords that should be promoted to phrase/exact, OR triggering exact-match terms that are too restrictive (broad-match opportunities for Smart Bidding accounts).
  - INTENT MISCLASSIFICATIONS: queries the ad shouldn't be matching at all (different audience, wrong product). Those become NEGATIVES, not new keywords.

PHASE 2 — BUILD THE KEYWORD LIST:
1. Map each new keyword to its intent stage:
   - informational (top of funnel, learning)
   - commercial_investigation (mid: comparing, evaluating)
   - transactional (bottom: ready to act)
   - branded (own brand + competitor brand)
   - navigational (specific products/SKUs)
2. Match-type rules:
   - Use PHRASE or EXACT for transactional terms (waste-control)
   - Use BROAD only if paired with Smart Bidding AND a strong negative list
   - Branded campaigns: exact match
3. Promote any high-intent query from the Search Terms report to its own exact-match keyword.

PHASE 3 — NEGATIVE KEYWORDS:
- 10-15 negatives derived FROM the search-terms data when provided (each one has a "reason" field referencing the query it came from). When data is not provided, fall back to inference-based negatives but mark reason="inferred".
- Include obvious irrelevance ("free", "DIY", "jobs", "salary" when these would dilute the ad).

PHASE 4 — AD GROUP STRUCTURE:
Group keywords by tightly-themed intent clusters (single-theme ad groups — 5-15 keywords each).
Adjacency principle: queries that would trigger the same ad text belong in the same ad group.

PHASE 5 — LONG-TAIL + COMPETITOR GAPS:
- 5-8 long-tail (4+ word, clear intent, lower CPC) — prefer ones that surfaced as good performers in Search Terms.
- 3-5 competitor keyword gaps — what competitors are likely bidding on that the user isn't (informed by competitor list + market).

PHASE 6 — BIDDING STRATEGY based on conversion volume:
- < 15 conv/month: Manual CPC + bid adjustments. Smart Bidding will misfire on thin data.
- 15-49 conv/month: ECPC (Enhanced CPC) — soft Smart Bidding.
- 50+ conv/month + target CPA defined: Target CPA.
- 50+ conv/month + revenue tracking: Target ROAS.
- New campaign with 0 conversion history: Maximize Clicks for 7 days, then switch.

Return ONLY valid JSON:
{
  "search_terms_analysis": {
    "estimated_waste": "string — dollar/% figure when computable, 'not enough data' otherwise",
    "high_intent_queries_count": 0,
    "zero_conversion_queries_count": 0,
    "match_type_gaps": "string — short count + example (e.g. '4 broad → phrase')",
    "summary": "string (2-3 sentences) — anchored to the actual queries. (no Search Terms data provided) if absent."
  },
  "keywords": [
    {
      "term": "string",
      "intent": "informational|commercial_investigation|transactional|branded|navigational",
      "match_type": "broad|phrase|exact",
      "ad_group_suggestion": "string",
      "long_tail": false,
      "competition_guess": "low|medium|high",
      "source": "from_search_terms | inferred | competitor_gap"
    }
  ],
  "negative_keywords": [
    { "term": "string", "reason": "string — quote the source query when from data, 'inferred' otherwise" }
  ],
  "ad_group_structure": [
    { "name": "string", "theme": "string", "keyword_count": 0, "example_keywords": ["string"] }
  ],
  "long_tail_opportunities": ["string"],
  "competitor_gaps": ["string"],
  "bidding_recommendation": {
    "strategy": "string",
    "reason": "string — anchored to conversion volume",
    "learning_phase_days": 0,
    "switch_to_smart_when": "string (e.g. '50+ conversions/30 days')"
  }
}`;
}
