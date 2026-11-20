import { CREATIVE_TESTING_HIERARCHY, RETIRE_THRESHOLD_RULE } from "./common-rules";
import { planAbTest } from "../ab-math";

export interface AbTestInput {
  platform: string;
  current_ad: string;
  hypothesis_to_test: string;
  /** Baseline conversion rate of the control, in % (CTR, CVR — whatever the test's metric is). */
  baseline_rate_pct: string;
  /** Minimum detectable effect, relative %, e.g. 20 = detect a +20% lift. */
  mde_pct: string;
  /** Visitors / clicks / impressions per variant per day (the rate's denominator). */
  daily_visitors_per_variant: string;
}

/**
 * Sample size + duration are computed client-side (lib/ab-math.ts) from the
 * user's baseline / MDE / traffic and handed to the model as fixed facts. The
 * model writes the qualitative plan only — it used to be asked for sample
 * sizes with no baseline rate at all, i.e. to make them up.
 */
export function buildAbTestPrompt(input: AbTestInput): string {
  const plan = planAbTest(input.baseline_rate_pct, input.mde_pct, input.daily_visitors_per_variant);
  const math = plan
    ? `- Required sample: ${plan.perVariant.toLocaleString("en-US")} per variant to detect ${plan.baselinePct}% → ${plan.targetPct.toFixed(2)}% (two-proportion z-test, α=0.05 two-sided, 80% power).
- Estimated duration: ${plan.days !== null ? `${plan.days} day(s) at ${input.daily_visitors_per_variant} per variant per day` : "unknown (no daily traffic given)"}.${plan.days !== null && plan.days > 28 ? "\n- This exceeds 4 weeks: recommend a bolder change (bigger expected effect) or a higher-traffic placement instead of greenlighting it." : ""}`
    : "- Not computable: baseline rate / MDE missing or invalid. Do NOT invent sample sizes or durations.";

  return `Design a rigorous A/B test for this ad.

${CREATIVE_TESTING_HIERARCHY}

${RETIRE_THRESHOLD_RULE}


INPUT:
- Platform: ${input.platform}
- Current control:
"""
${input.current_ad}
"""
- What user wants to test: ${input.hypothesis_to_test}

TEST MATH (computed deterministically by the app — treat as fixed facts):
${math}

PRINCIPLES:
- TEST ONE VARIABLE at a time. If user wants to test 3 things, plan 3 sequential tests, not one mess.
- Each variant must be a CLEAN comparison — same offer, same audience, same placement; only ONE thing changes.
- Do NOT output any sample-size, duration, significance or lift numbers of your own. Refer to the figures above when writing decision rules.

GENERATE:
1. Test hypothesis (one sentence, formal: "If [change], then [metric] will [direction] because [why]").
2. Control = current_ad verbatim.
3. Variant A — single change to test the hypothesis. Name the change explicitly.
4. Variant B — different angle on the same hypothesis (defensive duplicate to reduce variance).
5. Metric to watch + secondary metrics.
6. Decision framework: when to KILL (loser), DECLARE WINNER, EXTEND, RETEST — in terms of reaching the required sample above.
7. Common failure modes to watch for (peeking, novelty effect, seasonality, sample pollution).

Return ONLY valid JSON:
{
  "hypothesis": "string",
  "primary_metric": "string",
  "secondary_metrics": ["string"],
  "variants": [
    { "label": "Control", "ad_copy": "string", "single_change_from_control": "n/a" },
    { "label": "A", "ad_copy": "string", "single_change_from_control": "string" },
    { "label": "B", "ad_copy": "string", "single_change_from_control": "string" }
  ],
  "decision_rules": {
    "kill_variant_when": "string",
    "declare_winner_when": "string",
    "extend_test_when": "string",
    "retest_when": "string"
  },
  "failure_modes_to_avoid": ["string"]
}`;
}
