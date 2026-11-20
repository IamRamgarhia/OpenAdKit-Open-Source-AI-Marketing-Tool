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
}

/** Parsed impression share in (0,100], else null. */
export function parseImpressionShare(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[%\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

import { MANDATORY_EXCLUSIONS, DIAGNOSIS_TREES } from "./common-rules";
import { getCurrencyCode } from "../currency";

export function buildBudgetWastePrompt(input: BudgetWasteInput): string {
  const cc = getCurrencyCode();
  // "Demand captured" is only knowable from the platform's impression-share
  // column. Without it the model would invent a percentage, so the metric is
  // dropped unless the user supplies the real figure.
  const share = parseImpressionShare(input.impression_share_pct);
  const demandRule = share !== null
    ? `  - demand_captured_pct — USE EXACTLY ${share} (the user's reported impression share). Do not change the value; explain the top contributor to lost share and the fix.`
    : `  - demand_captured_pct — OMIT this key entirely (no impression-share data was provided; never estimate it).`;
  return `Audit this ad account for budget waste and produce a PULSE REPORT (not a letter grade).

CURRENCY CONTEXT: All amounts in/out are in ${cc}. The field names below (e.g. waste_per_month_usd) carry the literal "_usd" suffix in the JSON schema for backwards compatibility, but the numeric VALUES should be in ${cc}.

${MANDATORY_EXCLUSIONS}

${DIAGNOSIS_TREES}


PULSE METRICS RULE (toprank pattern):
Return these headline numbers:
  - waste_per_month_usd (estimated waste — derive it from figures in the input and show the basis in top_contributor)
${demandRule}
  - cpa_efficiency_ratio (current CPA vs target CPA as a ratio — only if both are stated in the input, else 0 and say so)
Each number must have:
  - top_contributor: NAMED specific cause (campaign/keyword/ad group, not "some keywords")
  - fix_pointer: the single highest-impact action

NO LETTER GRADES. NO 0–100 scores hiding reasoning. Show the math, not the verdict.

ANTI-VAGUENESS:
- ❌ "Some keywords are underperforming"
- ✅ "Campaign 'Brand-Search-US' has $1,840 last-30-day spend on 12 keywords with 0 conversions and quality score ≤ 4"

INPUT:
- Platform: ${input.platform}
- Monthly spend: ${cc} ${(input.monthly_spend ?? "").slice(0, 100)}
- Campaign setup:
"""
${(input.campaign_summary ?? "").slice(0, 16_000)}
"""
- Match types in use: ${input.match_types || "not specified"}
- Negative keyword list: ${input.has_negatives || "not specified"}
- Ad scheduling: ${input.schedule || "always-on"}
- Device targeting: ${input.device_targeting || "all"}
- Geographic targeting: ${input.geo_targeting || "not specified"}
- Excludes current customers from prospecting: ${input.excludes_customers || "not specified"}
- Search impression share: ${share !== null ? `${share}%` : "not provided"}

20-QUESTION WASTE AUDIT — for each question, mark hit (waste likely present), miss (looks fine), unknown.

STOP-CONDITIONS — emit a top-level "stop_condition" if ANY of:
- Conversion tracking is not mentioned (cannot audit blind)
- Tracking measurement is broken or unverified
- Special Ad Categories (housing, employment, credit, finance) without explicit ack
If a stop condition fires, set audit_findings to [] and tell user to fix the stop_condition first.

Return ONLY valid JSON:
{
  "stop_condition": null,
  "pulse": {
    "waste_per_month_usd": { "value": 0, "top_contributor": "string (name names)", "fix_pointer": "string" },
    "demand_captured_pct": { "value": 0, "top_contributor": "string", "fix_pointer": "string" },
    "cpa_efficiency_ratio": { "value": 0, "top_contributor": "string", "fix_pointer": "string" }
  },
  "audit": [
    {
      "question": "string",
      "answer": "hit|miss|unknown",
      "evidence": "string (specific)",
      "fix": "string (specific)",
      "estimated_waste_usd": 0,
      "priority": "critical|high|medium|low",
      "fix_within_days": 0
    }
  ],
  "top_5_fixes_by_roi": [
    { "fix": "string", "estimated_recovery_usd": 0, "effort_hours": 0 }
  ],
  "reallocation_plan": "string (where to move the recovered $)"
}`;
}
