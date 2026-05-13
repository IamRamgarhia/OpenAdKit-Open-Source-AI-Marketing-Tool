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
}

export function buildBidStrategyPrompt(input: BidStrategyInput): string {
  return `Recommend a bidding strategy anchored to the user's actual conversion volume + trend. Smart Bidding requires VOLUME and STABILITY — both gates must clear before a recommendation is safe.

CORE RULE: Smart Bidding strategies need both (a) enough conversions to learn from AND (b) at least 7 uninterrupted days on the current strategy. Either gate failing forces a downgrade.

Conversion volume thresholds (cite these to the user, never invent):
- Manual CPC / ECPC: works with any volume
- Maximize Conversions: needs ≥ 15 conversions / month
- Target CPA (tCPA): needs ≥ 15 conversions / week sustained
- Target ROAS (tROAS): needs ≥ 30 conversions / week AND consistent value tracking
- Meta Advantage+ / Lowest-Cost: needs ≥ 50 conversions / 7 days at ad-set level (post learning-phase exit)
- Cost Cap (Meta): needs ≥ 50 conversions / 7 days
- TikTok ACO: needs ≥ 50 conversions / 7 days

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

IF AN IMAGE IS ATTACHED:
The user has dropped a screenshot of their Recommendations page or Conversions column.
Extract the visible metrics — current strategy, conversion counts, CPA trend arrows, and any
Google "Recommendations" suggestions. Trust the image over typed fields when they conflict.

PHASE 1 — SMART-BIDDING READINESS GATES:
Check three gates. Each is ready / borderline / not_ready / unknown with a one-line observation:
  GATE A · WEEKLY CONVERSION VOLUME: compare conversions_last_7d to the threshold for the
    user's CURRENT strategy AND for the next-tier-up strategy. If 7d is missing, infer from
    monthly × 7/30 and mark "inferred — provide 7-day count for accuracy".
  GATE B · TREND HEALTH: cpa_trend rising or volatile = borderline; stable or falling = ready.
  GATE C · STRATEGY STABILITY: if current_strategy_days_active < 7 the campaign is still
    in learning — any strategy change resets it.

Overall readiness = the worst of the three gates.

PHASE 2 — PICK THE STRATEGY:
Given the readiness verdict + the volume math:
- If overall=ready AND volume clears tROAS thresholds + revenue tracking: Target ROAS.
- If overall=ready AND volume clears tCPA: Target CPA.
- If volume below tCPA but ≥ Maximize Conversions threshold: Maximize Conversions.
- Below Maximize Conversions threshold OR borderline trend: ECPC (Enhanced CPC) — soft signal.
- < 5 conversions/week or volatile trend: Manual CPC + bid adjustments.
- Brand-new campaign with 0 conversion history: Maximize Clicks for 7 days, then re-evaluate.

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
    "weekly_conversions_vs_threshold": "string — '9 last 7d vs ≥ 15 needed for tCPA'",
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
