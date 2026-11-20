export interface LandingPageInput {
  landing_page_url?: string;
  ad_promise: string;
  landing_copy: string;
  audience: string;
  visitors?: number | string;
  conversions?: number | string;
  bounce_rate?: string;
  time_on_page?: string;
  lcp?: string;
  mobile_pct?: string;
  primary_goal?: string;
  /** Optional full-page screenshot for the AI to grade visual hierarchy. */
  lp_screenshot?: unknown;
}

import { PRICING_PSYCHOLOGY, PROOF_RULE, hasPriceOrOffer } from "./common-rules";
import { landingMetrics, computedBlock, factLine, fmtPct } from "../ad-metrics";

const BOUNCE_LABEL = {
  suspiciously_low: "below 40% — suspiciously low, check tracking",
  typical: "40-70% — typical for paid traffic",
  high: "over 70% up to 80% — high",
  very_high: "80%+ — very high",
} as const;

export function buildLandingPrompt(input: LandingPageInput): string {
  const m = landingMetrics(input);
  const computed = computedBlock([
    factLine("Conversion rate", m.cvrPct === null ? null : fmtPct(m.cvrPct), "conversions ÷ visitors", "visitors and conversions"),
    factLine("Bounce rate band", m.bounceBand ? `${m.bounceRatePct}% → ${BOUNCE_LABEL[m.bounceBand]}` : null, "directional bands for paid landing pages", "a bounce rate"),
  ]);
  const pricing = hasPriceOrOffer(input.ad_promise, input.landing_copy) ? `\n${PRICING_PSYCHOLOGY}\n` : "";
  return `Grade this landing page using real traffic + conversion data, then prescribe the highest-leverage fixes. Message match between ad and page is the #1 lever — every other call gets weighted against it.
${pricing}
${PROOF_RULE}

INPUT — page:
- URL: ${input.landing_page_url || "(not provided)"}
- Audience: ${input.audience}
- Primary conversion goal: ${input.primary_goal || "(not specified)"}

INPUT — the ad's promise (what the visitor clicked thinking they'd find):
"${input.ad_promise}"

INPUT — landing page copy:
"""
${(input.landing_copy ?? "").slice(0, 24_000)}
"""

INPUT — performance data:
- Visitors / period: ${input.visitors || "(not provided)"}
- Conversions: ${input.conversions || "(not provided)"}
- Bounce rate: ${input.bounce_rate || "(not provided)"}
- Avg time on page: ${input.time_on_page || "(not provided)"}
- LCP (Largest Contentful Paint): ${input.lcp || "(not provided)"}
- Mobile traffic %: ${input.mobile_pct || "(not provided)"}

${input.lp_screenshot ? `IMAGE ATTACHED:
The user has dropped a full-page screenshot. JUDGE THE VISUAL HIERARCHY directly:
- Is the H1 above the fold and the largest type on the page?
- Is the primary CTA visible without scrolling, and clearly the strongest button?
- Does the hero visual support or compete with the message?
- Are there competing CTAs on the same screen?
- Above-the-fold: H1 + subhead + visual + CTA all present?
Cite "(from screenshot)" in scores or fixes when the image — not the typed copy — drove the call.
When typed copy and image conflict, trust the image (it's the live page).

` : ""}PHASE 1 — THE NUMBERS:
${computed}
- LCP verdict (Google's Core Web Vitals thresholds): ≤ 2.5s = good · 2.5-4s = needs_improvement · > 4s = poor.
- Engagement health (rule of thumb): < 20s time-on-page = abandoned · 20-45s = scanning · > 45s = engaged.
- If a metric has no input, mark it "could not be computed" / "unknown" — NEVER invent.

PHASE 2 — DIAGNOSE MESSAGE MATCH (the #1 lever):
- Does the H1 echo the ad's promise within 5 words of the same idea?
- Is the visitor "yes-this-is-the-right-place" within 3 seconds of landing?
- High bounce + low time-on-page + weak message match = the diagnosis is settled before scoring anything else.

PHASE 3 — SCORE 1-10 EACH LEVER, with a NAMED reason (no vague verdicts):
- message_match: H1 echoes ad promise?
- clarity: stranger knows what's being sold in 5 seconds?
- cta_effectiveness: ONE primary CTA, visible above the fold, action-led verb?
- social_proof: real numbers, named entities, dated reviews on the page — NOT "trusted by thousands"? (Score what the page has; any proof you suggest adding must come from the brand brain — otherwise suggest a verifiable product/process fact.)
- specificity: ONE concrete, checkable benefit?
- objection_handling: acknowledges & rebuts top 2 objections?
- friction: 10 = almost no drag, 1 = heavy drag (long form, competing CTAs, unclear pricing). Like every lever here, HIGHER IS BETTER.
- above_the_fold: H1 + subhead + visual + CTA all visible without scroll on mobile?

PHASE 4 — RANK FIXES:
For each lever scored ≤ 6, write a SPECIFIC fix — quote the exact phrase to change and write the replacement. Order all fixes by expected impact (high → low). Anchor expected_impact to the computed metrics ("Bounce rate 76% + time 14s + message_match score 3 → message_match fix expected_impact=high").

PHASE 5 — TWO ONE-LINERS:
- biggest_problem: the single specific thing killing performance, named.
- biggest_opportunity: the single specific change that lifts conversion most.

PHASE 6 — ABOVE-THE-FOLD REWRITE:
Write a tight rewrite of H1 + subhead + 3 bullets + CTA button. Validate char counts as listed in the JSON schema.

Return ONLY valid JSON:
{
  "computed_metrics": {
    "conversion_rate": "string (e.g. '1.51%' or 'could not be computed')",
    "bounce_vs_benchmark": "string — the computed bounce band above, or 'could not be computed'",

    "lcp_verdict": "good | needs_improvement | poor | unknown",
    "engagement_health": "abandoned | scanning | engaged | unknown",
    "notes": "string — flag any contradictions or signals worth calling out"
  },
  "overall_grade_pulse": {
    "message_match_score": 0,
    "single_biggest_fix": "string"
  },

  "scores": {
    "message_match": { "score": 0, "reason": "string" },
    "clarity": { "score": 0, "reason": "string" },
    "cta_effectiveness": { "score": 0, "reason": "string" },
    "social_proof": { "score": 0, "reason": "string" },
    "specificity": { "score": 0, "reason": "string" },
    "objection_handling": { "score": 0, "reason": "string" },
    "friction": { "score": 0, "reason": "string" },
    "above_the_fold": { "score": 0, "reason": "string" }
  },
  "fixes": [
    {
      "lever": "string",
      "exact_phrase_to_change": "string (quote from input)",
      "replacement": "string",
      "expected_impact": "high|medium|low"
    }
  ],
  "biggest_opportunity": "string",
  "biggest_problem": "string",
  "rewrite_above_the_fold": {
    "h1": "string ≤ 60 chars",
    "subhead": "string ≤ 140 chars",
    "bullets": ["string"],
    "cta_button": "string ≤ 16 chars"
  }
}`;
}
