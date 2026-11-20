import { getCurrencyCode } from "../currency";

export interface BudgetPlannerInput {
  total_monthly: string;
  goal: string;
  business_type: string;
  current_aov_or_ltv: string;
  current_cvr: string;
  has_organic: string;
  geo: string;
  /** Platform the volume projection is computed for (benchmarks are per platform). */
  primary_platform?: string;
  /** lib/benchmarks INDUSTRIES value, or "" for none. */
  industry?: string;
  /** User's own average CPC, if known. */
  avg_cpc?: string;
}

/**
 * The model allocates budget and explains trade-offs. It is NOT asked for
 * impressions / clicks / conversions / ROAS / break-even CPA any more — those
 * are computed client-side from the user's inputs (lib/budget-estimates.ts),
 * because "estimates" from the model were arithmetic on invented numbers.
 */
export function buildBudgetPlannerPrompt(input: BudgetPlannerInput): string {
  const cc = getCurrencyCode();
  return `Build a monthly ad budget allocation plan. Amounts in ${cc} — every split must add up to the total.

INPUT:
- Currency: ${cc} (ALL amounts in the output should be in ${cc})
- Total monthly budget: ${cc} ${input.total_monthly}
- Goal: ${input.goal}
- Business type: ${input.business_type}
- Current AOV / LTV: ${input.current_aov_or_ltv || "not given"}
- Current site CVR: ${input.current_cvr || "not given"}
- Existing organic traffic: ${input.has_organic || "not given"}
- Geo: ${input.geo || "not given"}
- Main platform under consideration: ${input.primary_platform || "not specified"}

PRODUCE:

1. PLATFORM SPLIT — % and amount per platform. Justify each (must reference the user's actual inputs, not generic logic).

2. FUNNEL SPLIT — within those amounts, how much for awareness (cold prospecting), consideration (mid-funnel / engager retargeting) and conversion (hot retargeting). The split shifts with goal + existing organic baseline.

3. CAMPAIGN BREAKOUT — campaign-by-campaign monthly amounts. Note which platforms need a minimum daily spend to exit the learning phase, as guidance (say "typically", don't present it as a guarantee).

4. SATURATION FLAGS — qualitative: where adding more budget at this level is likely to hit diminishing returns, and why.

5. RESERVE — recommend setting aside 10-15% for testing, scaling winners and replacing fatigued creative.

6. NO-GO LIST — what NOT to spend on at this budget level. Specific.

DO NOT output impressions, clicks, conversions, CPA, revenue, ROAS or break-even figures — the app computes those from the user's own numbers.

Return ONLY valid JSON:
{
  "platform_split": [
    { "platform": "string", "pct": 0, "monthly_usd": 0, "rationale": "string (cite user's inputs)" }
  ],
  "funnel_split_overall": [
    { "stage": "awareness|consideration|conversion", "pct": 0, "monthly_usd": 0 }
  ],
  "campaign_breakout": [
    { "campaign_name": "string", "platform": "string", "funnel_stage": "string", "monthly_usd": 0, "learning_phase_note": "string" }
  ],
  "break_even": {
    "saturation_flags": [{ "platform": "string", "reason": "string" }]
  },
  "reserve": {
    "pct": 0,
    "monthly_usd": 0,
    "uses": ["testing", "scaling winners", "creative refresh"]
  },
  "no_go_list": ["string — specific things this budget cannot do well"]
}`;
}
