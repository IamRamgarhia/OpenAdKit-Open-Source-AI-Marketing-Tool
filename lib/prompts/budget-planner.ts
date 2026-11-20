import { getCurrencyCode } from "../currency";
import { estimateVolume, type VolumeEstimate } from "../budget-estimates";

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
  /** Gross margin %, if known — turns the break-even CPA into a profit break-even. */
  gross_margin_pct?: string;
}

/** Benchmark platform names; MCP callers often send "meta" / "google_search". */
export const PROJECTION_PLATFORMS = ["Google Search", "Meta Feed", "TikTok In-Feed", "LinkedIn Sponsored"] as const;

export function projectionPlatform(v: unknown): string {
  const k = String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return "Google Search";
  return PROJECTION_PLATFORMS.find((p) => p.toLowerCase().replace(/[^a-z]/g, "").startsWith(k) || k.startsWith(p.toLowerCase().split(" ")[0])) ?? String(v);
}

/** The planner's volume projection — shared by the prompt, the page and the MCP registry. */
export function plannerEstimate(input: Partial<BudgetPlannerInput>, currencyCode: string): VolumeEstimate | null {
  return estimateVolume({
    monthlyBudget: input.total_monthly,
    platform: projectionPlatform(input.primary_platform),

    industry: input.industry || undefined,
    cpc: input.avg_cpc,
    cvrPct: input.current_cvr,
    aov: input.current_aov_or_ltv,
    grossMarginPct: input.gross_margin_pct,
    currencyCode,
  });
}

function projectionFacts(est: VolumeEstimate | null, cc: string): string {
  if (!est) return "- No projection: the monthly budget is missing or not a number.";
  const n = (v: number | null, dp = 0) => (v === null ? "not computable" : v.toLocaleString("en-US", { maximumFractionDigits: dp }));
  const src = (s: string) => (s === "input" ? "user's input" : s === "benchmark" ? "labelled benchmark midpoint" : "missing");
  return [
    `- Clicks / month: ${n(est.clicks)} (CPC from ${src(est.cpc.source)})`,
    `- Conversions / month: ${n(est.conversions, 1)} (CVR from ${src(est.cvrPct.source)})`,
    `- CPA: ${n(est.cpa, 2)} ${cc}`,
    `- ROAS: ${est.roas === null ? "not computable (no AOV / LTV)" : `${est.roas.toFixed(2)}×`}`,
    `- Break-even CPA at 100% margin (= AOV): ${n(est.revenueBreakEvenCpa, 2)}${est.profitBreakEvenCpa !== null ? ` · at ${est.grossMarginPct}% gross margin: ${n(est.profitBreakEvenCpa, 2)}` : " (no gross margin given)"}`,
  ].join("\n");
}

/**
 * The model allocates budget and explains trade-offs. It is NOT asked for
 * impressions / clicks / conversions / ROAS / break-even CPA any more — those
 * are computed client-side from the user's inputs (lib/budget-estimates.ts),
 * because "estimates" from the model were arithmetic on invented numbers.
 */
export function buildBudgetPlannerPrompt(input: BudgetPlannerInput): string {
  const cc = getCurrencyCode();
  const est = plannerEstimate(input, cc);
  const keyNote = cc === "USD" ? "" : ` (keys ending in "_usd" are legacy names — their values are in ${cc})`;
  return `Build a monthly ad budget allocation plan. Amounts in ${cc}${keyNote} — every split must add up to the total.

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
- Gross margin: ${input.gross_margin_pct ? `${input.gross_margin_pct}%` : "not given"}

PROJECTION COMPUTED BY THE APP for ${projectionPlatform(input.primary_platform)} (facts — the user sees these next to your plan):
${projectionFacts(est, cc)}
Use them qualitatively when justifying the split — e.g. "at a projected CPA above the break-even CPA, keep prospecting spend small until CVR improves". Do not restate them as new numbers or compute others.

PRODUCE:

1. PLATFORM SPLIT — % and amount per platform. Justify each (must reference the user's actual inputs, not generic logic).

2. FUNNEL SPLIT — within those amounts, how much for awareness (cold prospecting), consideration (mid-funnel / engager retargeting) and conversion (hot retargeting). The split shifts with goal + existing organic baseline.

3. CAMPAIGN BREAKOUT — campaign-by-campaign monthly amounts. Note which platforms need a minimum daily spend to exit the learning phase, as guidance (say "typically", don't present it as a guarantee).

4. SATURATION FLAGS — qualitative: where adding more budget at this level is likely to hit diminishing returns, and why (top-level "saturation_flags").

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
  "saturation_flags": [{ "platform": "string", "reason": "string" }],
  "reserve": {
    "pct": 0,
    "monthly_usd": 0,
    "uses": ["testing", "scaling winners", "creative refresh"]
  },
  "no_go_list": ["string — specific things this budget cannot do well"]
}`;
}
