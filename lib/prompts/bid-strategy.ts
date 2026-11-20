export interface BidStrategyInput {
  platform: string;
  campaign_type_setup?: string;
  goal: string;
  current_strategy?: string;
  current_strategy_days_active?: number | string;
  monthly_budget: string;
  conversions_per_month: number | string;
  conversions_last_7d?: number | string;
  account_monthly_conversions?: number | string;
  cpa_trend?: string;
  current_cpa?: string;
  target_cpa?: string;
  target_roas?: string;
  /** Optional screenshot of Recommendations page or Conversions column. */
  bid_screenshot?: unknown;
}

import { BID_STRATEGY_RULES, BID_THRESHOLDS } from "./common-rules";
import { bidFeasibility, computedBlock, factLine, fmtAmount } from "../ad-metrics";

export function bidStrategyFeasibility(input: Partial<BidStrategyInput>) {
  return bidFeasibility({
    monthlyBudget: input.monthly_budget,
    targetCpa: input.target_cpa,
    currentCpa: input.current_cpa,
    conversionsPerMonth: input.conversions_per_month,
    conversionsLast7d: input.conversions_last_7d,
  });
}

export function buildBidStrategyPrompt(input: BidStrategyInput): string {
  const f = bidStrategyFeasibility(input);
  const one = (n: number) => n.toFixed(1);
  const computed = computedBlock([
    factLine(
      "Campaign conversions per 30 days",
      f.monthlyConversions === null ? null : one(f.monthlyConversions),
      f.monthlyConversionsSource === "last_7d" ? "last 7 days × 30 ÷ 7" : "the monthly figure you gave",
      "conversions per month or in the last 7 days"
    ),
    factLine(
      "Budget ÷ target CPA",
      f.maxConversionsAtTargetCpa === null ? null : `${one(f.maxConversionsAtTargetCpa)} conversions / month at most`,
      `${fmtAmount(f.monthlyBudget ?? 0)} ÷ ${fmtAmount(f.targetCpa ?? 0)}`,
      "a monthly budget and a target CPA"
    ),
    factLine(
      "Budget ÷ current CPA",
      f.conversionsAtCurrentCpa === null ? null : `${one(f.conversionsAtCurrentCpa)} conversions / month at today's CPA`,
      "monthly budget ÷ current CPA",
      "a monthly budget and the current CPA"
    ),
    f.targetCpaReachable === "no"
      ? `- FEASIBILITY: at the target CPA this budget buys fewer than the ${BID_THRESHOLDS.target_cpa_min_30d} conversions / 30 days Target CPA needs to learn. Say so plainly: raise the budget, relax the target, or use Maximize Conversions first.`
      : f.targetCpaReachable === "yes"
        ? `- FEASIBILITY: the budget can fund the ${BID_THRESHOLDS.target_cpa_min_30d}+ conversions / 30 days Target CPA needs, if CPA lands near target.`
        : "- FEASIBILITY: unknown (no target CPA) — do not invent one.",
  ]);
  return `Recommend a bidding strategy anchored to the user's actual conversion volume + trend. Smart Bidding requires VOLUME and STABILITY — both gates must clear before a recommendation is safe.

CORE RULE: Smart Bidding strategies need both (a) enough conversions to learn from AND (b) at least 7 uninterrupted days on the current strategy. Either gate failing forces a downgrade.

${BID_STRATEGY_RULES}

INPUT — context:
- Platform: ${input.platform}
- Campaign type: ${input.campaign_type_setup || "(not specified)"}
- Goal: ${input.goal}

INPUT — current setup:
- Current bid strategy: ${input.current_strategy || "(not specified)"}
- Days on current strategy: ${input.current_strategy_days_active || "(not specified)"}

INPUT — performance data:
- Monthly budget: ${input.monthly_budget}
- Conversions / month (campaign): ${input.conversions_per_month}
- Conversions in last 7 days (campaign): ${input.conversions_last_7d || "(not provided)"}
- Account-wide monthly conversions: ${input.account_monthly_conversions || "(not provided)"}
- CPA trend (last 30 days): ${input.cpa_trend || "unknown"}
- Current CPA: ${input.current_cpa || "(not provided)"}
- Target CPA: ${input.target_cpa || "(not provided)"}
- Target ROAS: ${input.target_roas || "(not provided)"}

${input.bid_screenshot ? `IMAGE ATTACHED:
The user has dropped a screenshot of their Recommendations page or Conversions column.
Extract the visible metrics — current strategy, conversion counts, CPA trend arrows, and any
Google "Recommendations" suggestions. Trust the image over typed fields when they conflict.

` : ""}${computed}

PHASE 1 — SMART-BIDDING READINESS GATES:
Check three gates. Each is ready / borderline / not_ready / unknown with a one-line observation:
  GATE A · CONVERSION VOLUME: compare the computed conversions per 30 days to the threshold for the
    user's CURRENT strategy AND for the next-tier-up strategy (rules above). If it came from the
    monthly figure, add "provide the last-7-day count for accuracy".
  GATE B · TREND HEALTH: cpa_trend rising or volatile = borderline; stable or falling = ready.
  GATE C · STRATEGY STABILITY: if current_strategy_days_active < 7 the campaign is still
    in learning — any strategy change resets it.

OVERALL READINESS = the worst gate, ranked not_ready < borderline < ready:
- Any gate not_ready → not_ready.
- Otherwise any gate borderline → borderline.
- An unknown gate can never make the result "ready": if the known gates are ready and one or more
  are unknown → borderline, and name the missing input. If every gate is unknown → unknown.

PHASE 2 — PICK THE STRATEGY:
Given the readiness verdict + the volume rules above:
- overall=ready AND volume clears the Target ROAS line AND value tracking exists: Target ROAS.
- overall=ready AND volume clears the Target CPA line AND the budget feasibility above is not "no": Target CPA.
- Volume clears the Maximize Conversions line (or Target CPA is not feasible on this budget): Maximize Conversions.
- Below the Maximize Conversions line, or overall=not_ready on trend: Manual CPC + bid adjustments.
- Brand-new campaign with no conversion history: Manual CPC (or capped Maximize Clicks for 1-2 weeks), then re-evaluate.
- Never recommend Enhanced CPC (retired for Search).

PHASE 3 — DECIDE:
1. recommended_strategy: the strategy name from above.
2. reason: must CITE the user's actual conversion numbers + the gate that drove the call.
3. fallback if data is insufficient (always provide this).
4. Learning phase: days untouched, what NOT to change, what's OK to change.
5. Bid adjustments (device / location / schedule / audience) — only when the chosen
   strategy supports manual modifiers.
6. Budget pacing: daily vs campaign-level + why.
7. Early-warning signs (volume drop, CPA spike, frequency > 3, "Learning Limited").
8. Graduation path: current → next strategy, with a numeric trigger threshold.

Return ONLY valid JSON:
{
  "smart_bidding_readiness": {
    "weekly_conversions_vs_threshold": "string — e.g. '25.7 conversions / 30 days vs 30 needed for Target CPA'",
    "trend_health": "string — e.g. 'rising — needs to stabilize first'",
    "overall": "ready | borderline | not_ready | unknown",
    "gates": [
      { "gate": "string", "status": "ready | borderline | not_ready | unknown", "observation": "string" }
    ]
  },
  "recommended_strategy": "string",
  "reason": "string (cites user's numbers + which gate drove the call)",
  "fallback_strategy_if_data_insufficient": "string",
  "learning_phase": {
    "days_to_hold": 0,
    "do_not_change": ["string"],
    "ok_to_change": ["string"]
  },
  "bid_adjustments": [
    { "dimension": "device|location|schedule|audience", "adjustment": "string", "reason": "string" }
  ],
  "budget_pacing_recommendation": "string",
  "early_warning_signs": ["string"],
  "graduation_path": {
    "current": "string",
    "next_strategy": "string",
    "trigger_threshold": "string (numeric)"
  }
}`;
}
