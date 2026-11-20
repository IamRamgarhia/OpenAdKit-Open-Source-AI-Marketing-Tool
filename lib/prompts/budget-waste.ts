export interface BudgetWasteInput {
  platform: string;
  monthly_spend: string;
  campaign_summary: string;
  match_types?: string;
  has_negatives?: string;
  schedule?: string;
  device_targeting?: string;
  geo_targeting?: string;
  excludes_customers?: string;
  /** Search impression share (%) as reported by the ad platform, if known. */
  impression_share_pct?: string;
  /** Is conversion tracking set up and verified? yes / no / unsure (blank = unsure). */
  conversion_tracking?: string;
}

/** Parsed impression share in (0,100], else null. */
export function parseImpressionShare(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[%\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

/** "yes" only when the user confirmed tracking works; anything else is unconfirmed. */
export function trackingStatus(v: unknown): "yes" | "no" | "unsure" {
  const s = String(v ?? "").trim().toLowerCase();
  if (/^(y|yes|verified|working|on)\b/.test(s)) return "yes";
  if (/^(n|no|none|off|broken)\b/.test(s)) return "no";
  return "unsure";
}

/**
 * The 20 structural waste checks, listed so the model audits the same things
 * every run (the prompt used to say "20-question audit" without the list).
 */
export const WASTE_AUDIT_QUESTIONS = [
  "Is conversion tracking set up and verified, with the primary conversion a real business outcome (not page views)?",
  "Are broad-match keywords running without Smart Bidding and a solid negative list?",
  "Is there a negative keyword list, updated from the search-terms report in the last 30 days?",
  "Are search terms / keywords with clicks worth 2× the target CPA and zero conversions still active?",
  "Are Search Partners, Display expansion or the Audience Network on by default in an intent-led campaign?",
  "Does geo targeting reach people merely 'interested in' the area instead of people in it?",
  "Does the schedule run 24/7 without checking conversions by hour / day?",
  "Do all devices get equal bids despite different conversion rates?",
  "Are existing customers excluded from prospecting?",
  "Are recent converters excluded for a sensible window?",
  "Are brand and non-brand terms mixed in one campaign (brand masking non-brand CPA)?",
  "Do ad groups / ad sets mix unrelated themes, so one ad serves many intents?",
  "Is the budget split across so many campaigns / ad sets that none gets enough conversions to learn?",
  "Do audiences or keywords overlap, so campaigns bid against each other?",
  "Does each ad land on a page that matches its keyword / promise (not the homepage)?",
  "Are ads with high frequency and falling CTR still running?",
  "Is placement inventory unchecked (mobile apps, low-quality sites, in-game placements)?",
  "Is the bid strategy matched to the campaign's conversion volume?",
  "Are good campaigns 'limited by budget' while weaker ones keep spending?",
  "Are auto-applied recommendations or auto-generated assets on without review?",
] as const;

import { MANDATORY_EXCLUSIONS, DIAGNOSIS_TREES } from "./common-rules";
import { getCurrencyCode } from "../currency";

export function buildBudgetWastePrompt(input: BudgetWasteInput): string {
  const cc = getCurrencyCode();
  const tracking = trackingStatus(input.conversion_tracking);
  // "Demand captured" is only knowable from the platform's impression-share
  // column. Without it the model would invent a percentage, so the metric is
  // dropped unless the user supplies the real figure.
  const share = parseImpressionShare(input.impression_share_pct);
  const demandRule = share !== null
    ? `  - demand_captured_pct — USE EXACTLY ${share} (the user's reported impression share). Do not change the value; explain the top contributor to lost share and the fix.`
    : `  - demand_captured_pct — OMIT this key entirely (no impression-share data was provided; never estimate it).`;
  const demandTemplate = share !== null
    ? `,\n    "demand_captured_pct": { "value": ${share}, "top_contributor": "string", "fix_pointer": "string" }`
    : "";
  const currencyNote = cc === "USD"
    ? "CURRENCY: amounts are in USD."
    : `CURRENCY: all amounts in and out are in ${cc}. Some JSON keys end in "_usd" for backwards compatibility — the VALUES must still be in ${cc}.`;
  const trackingRule = tracking === "yes"
    ? "CONVERSION TRACKING: the user confirmed it is set up and verified. Use conversion-based evidence where the input gives it."
    : `CONVERSION TRACKING: ${tracking === "no" ? "the user says it is NOT set up" : "not confirmed by the user"}. Do NOT stop — still run the structural audit (match types, negatives, geo, schedule, devices, exclusions, structure, placements). Mark checks that need conversion data as "unknown", set their estimated waste to 0, and put a plain one-sentence warning in "tracking_warning" (top-level) saying conversion-based waste can't be measured until tracking is verified. Question 1 is a "hit" when tracking is not set up.`;

  return `Audit this ad account for budget waste and produce a PULSE REPORT (not a letter grade).

${currencyNote}

${trackingRule}

${MANDATORY_EXCLUSIONS}

${DIAGNOSIS_TREES}


PULSE METRICS RULE (toprank pattern):
Return these headline numbers:
  - waste_per_month_usd (estimated waste — derive it from figures in the input and show the basis in top_contributor; 0 with "not enough data" when the input has no figures to derive it from)
${demandRule}
  - cpa_efficiency_ratio (current CPA ÷ target CPA — only if both are stated in the input, else 0 and say so in top_contributor)
Each number must have:
  - top_contributor: NAMED specific cause (campaign/keyword/ad group, not "some keywords")
  - fix_pointer: the single highest-impact action

NO LETTER GRADES. NO 0–100 scores hiding reasoning. Show the math, not the verdict.

ANTI-VAGUENESS:
- ❌ "Some keywords are underperforming"
- ✅ "Campaign 'Brand-Search' has 1,840 of last-30-day spend on 12 keywords with 0 conversions" (only with figures the user gave)

INPUT:
- Platform: ${input.platform}
- Monthly spend: ${cc} ${(input.monthly_spend ?? "").slice(0, 100)}
- Campaign setup:
"""
${(input.campaign_summary ?? "").slice(0, 16_000)}
"""
- Conversion tracking: ${tracking === "yes" ? "set up and verified" : tracking === "no" ? "not set up" : "not confirmed"}
- Match types in use: ${input.match_types || "not specified"}
- Negative keyword list: ${input.has_negatives || "not specified"}
- Ad scheduling: ${input.schedule || "not specified"}
- Device targeting: ${input.device_targeting || "not specified"}
- Geographic targeting: ${input.geo_targeting || "not specified"}
- Excludes current customers from prospecting: ${input.excludes_customers || "not specified"}
- Search impression share: ${share !== null ? `${share}%` : "not provided"}

20-QUESTION WASTE AUDIT — answer every question below, in this order, in the "audit" array. For each: hit (waste likely present), miss (looks fine), unknown (input doesn't say), or n/a (doesn't apply to ${input.platform}, e.g. keyword checks on Meta). Evidence must quote or point to the input; never invent account figures.
${WASTE_AUDIT_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n")}

STOP-CONDITION — emit a top-level "stop_condition" (a string) ONLY if the account runs in a Special Ad Category (housing, employment, credit, financial products / social issues) and the input does not say the category is declared. Then set "audit" to [] and tell the user to declare the category first. Otherwise "stop_condition" is null.

Return ONLY valid JSON:
{
  "stop_condition": null,${tracking === "yes" ? "" : `\n  "tracking_warning": "string — one sentence",`}
  "pulse": {
    "waste_per_month_usd": { "value": 0, "top_contributor": "string (name names)", "fix_pointer": "string" }${demandTemplate},
    "cpa_efficiency_ratio": { "value": 0, "top_contributor": "string", "fix_pointer": "string" }
  },
  "audit": [
    {
      "question": "string (from the list)",
      "answer": "hit|miss|unknown|n/a",
      "evidence": "string (specific, from the input)",
      "fix": "string (specific)",
      "estimated_waste_usd": 0,
      "priority": "critical|high|medium|low",
      "fix_within_days": 0
    }
  ],
  "top_5_fixes_by_roi": [
    { "fix": "string", "estimated_recovery_usd": 0, "effort_hours": 0 }
  ],
  "reallocation_plan": "string (where to move the recovered budget)"
}`;
}
