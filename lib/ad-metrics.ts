import { parseNumber } from "./budget-estimates";
import { BID_THRESHOLDS } from "./prompts/common-rules";

/**
 * Deterministic performance arithmetic for the optimizers.
 *
 * The CTR / Quality Score / landing-page / fatigue / bid prompts used to tell
 * the model to "compute CTR = clicks / impressions". Models get division
 * wrong surprisingly often, and when an input is missing they fill the gap.
 * These helpers do the math in code; prompts embed the result as facts and
 * the MCP registry returns it as `computed_in_code`.
 *
 * Every function returns null for a value it cannot compute — never a guess.
 */

const num = (v: unknown): number | null => {
  const n = parseNumber(v);
  return n !== null && n >= 0 ? n : null;
};

const ratio = (a: number | null, b: number | null): number | null => (a !== null && b !== null && b > 0 ? a / b : null);

/** Percent change from `before` to `after` (negative = decline). */
export function pctChange(before: unknown, after: unknown): number | null {
  const a = num(before);
  const b = num(after);
  return a !== null && b !== null && a > 0 ? ((b - a) / a) * 100 : null;
}

export interface PerformanceMetrics {
  ctrPct: number | null;
  cvrPct: number | null;
  /** spend ÷ clicks, else the reported average CPC. */
  cpc: number | null;
  cpcSource: "spend_div_clicks" | "reported" | null;
  /** spend ÷ conversions, else reported CPC × clicks ÷ conversions. */
  cpa: number | null;
  /** How far reported CPC is from spend ÷ clicks, in % (when both exist). */
  cpcGapPct: number | null;
}

export function performanceMetrics(i: { impressions?: unknown; clicks?: unknown; conversions?: unknown; spend?: unknown; avgCpc?: unknown }): PerformanceMetrics {
  const impressions = num(i.impressions);
  const clicks = num(i.clicks);
  const conversions = num(i.conversions);
  const spend = num(i.spend);
  const reported = num(i.avgCpc);
  const ctr = ratio(clicks, impressions);
  const cvr = ratio(conversions, clicks);
  const computedCpc = ratio(spend, clicks);
  const cpc = computedCpc ?? reported;
  const cost = spend ?? (reported !== null && clicks !== null ? reported * clicks : null);
  return {
    ctrPct: ctr === null ? null : ctr * 100,
    cvrPct: cvr === null ? null : cvr * 100,
    cpc,
    cpcSource: computedCpc !== null ? "spend_div_clicks" : reported !== null ? "reported" : null,
    cpa: ratio(cost, conversions),
    cpcGapPct: computedCpc !== null && reported !== null && reported > 0 ? (Math.abs(computedCpc - reported) / reported) * 100 : null,
  };
}

export interface FatigueDecay {
  impressions: number | null;
  ctr: number | null;
  cpm: number | null;
  conversions: number | null;
}

export function fatigueDecay(i: Record<string, unknown>): FatigueDecay {
  return {
    impressions: pctChange(i.impressions_week_1, i.impressions_week_latest),
    ctr: pctChange(i.ctr_week_1, i.ctr_week_latest),
    cpm: pctChange(i.cpm_week_1, i.cpm_week_latest),
    conversions: pctChange(i.conversions_week_1, i.conversions_week_latest),
  };
}

export type BounceBand = "suspiciously_low" | "typical" | "high" | "very_high";

/** Directional bands for paid-traffic landing pages (contiguous, no gaps). */
export function bounceBand(pct: number | null): BounceBand | null {
  if (pct === null || pct > 100) return null;
  if (pct < 40) return "suspiciously_low";
  if (pct <= 70) return "typical";
  if (pct < 80) return "high";
  return "very_high";
}

export interface LandingMetrics {
  cvrPct: number | null;
  bounceRatePct: number | null;
  bounceBand: BounceBand | null;
}

export function landingMetrics(i: { visitors?: unknown; conversions?: unknown; bounce_rate?: unknown }): LandingMetrics {
  const cvr = ratio(num(i.conversions), num(i.visitors));
  const bounce = num(i.bounce_rate);
  return { cvrPct: cvr === null ? null : cvr * 100, bounceRatePct: bounce, bounceBand: bounceBand(bounce) };
}

export interface BidFeasibility {
  monthlyBudget: number | null;
  targetCpa: number | null;
  /** Budget ÷ target CPA: the most conversions a month this budget buys at target. */
  maxConversionsAtTargetCpa: number | null;
  /** Budget ÷ current CPA: what the budget buys at today's CPA. */
  conversionsAtCurrentCpa: number | null;
  /** Campaign conversions per 30 days; from the last 7 days (×30/7) when given. */
  monthlyConversions: number | null;
  monthlyConversionsSource: "last_7d" | "monthly" | null;
  /** Can this budget even produce the conversions Target CPA needs to learn? */
  targetCpaReachable: "yes" | "no" | "unknown";
  thresholds: typeof BID_THRESHOLDS;
}

export function bidFeasibility(i: { monthlyBudget?: unknown; targetCpa?: unknown; currentCpa?: unknown; conversionsPerMonth?: unknown; conversionsLast7d?: unknown }): BidFeasibility {
  const budget = num(i.monthlyBudget);
  const target = num(i.targetCpa);
  const maxAtTarget = ratio(budget, target);
  const last7 = num(i.conversionsLast7d);
  const monthly = num(i.conversionsPerMonth);
  const monthlyConversions = last7 !== null ? (last7 * 30) / 7 : monthly;
  return {
    monthlyBudget: budget,
    targetCpa: target,
    maxConversionsAtTargetCpa: maxAtTarget,
    conversionsAtCurrentCpa: ratio(budget, num(i.currentCpa)),
    monthlyConversions,
    monthlyConversionsSource: last7 !== null ? "last_7d" : monthly !== null ? "monthly" : null,
    targetCpaReachable: maxAtTarget === null ? "unknown" : maxAtTarget >= BID_THRESHOLDS.target_cpa_min_30d ? "yes" : "no",
    thresholds: BID_THRESHOLDS,
  };
}

// ── prompt formatting ─────────────────────────────────────────────────────

export const fmtPct = (n: number, dp = 2) => `${n.toFixed(dp)}%`;
export const fmtSigned = (n: number, dp = 1) => `${n > 0 ? "+" : ""}${n.toFixed(dp)}%`;
export const fmtAmount = (n: number, dp = 2) => n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp });

/** "- label: value (basis)" or "- label: could not be computed (needs …)". */
export function factLine(label: string, value: string | null, basis: string, needs: string): string {
  return value === null ? `- ${label}: could not be computed (needs ${needs})` : `- ${label}: ${value} (${basis})`;
}

export function computedBlock(lines: string[], note = ""): string {
  return `COMPUTED FROM YOUR NUMBERS (calculated by the app, not estimated — treat as facts, do not recompute or change them; copy them into the matching output fields):
${lines.join("\n")}${note ? `\n${note}` : ""}`;
}

/** Lines for CTR / CVR / CPC / CPA. Amounts are in the currency of the inputs. */
export function performanceLines(m: PerformanceMetrics): string[] {
  return [
    factLine("CTR", m.ctrPct === null ? null : fmtPct(m.ctrPct), "clicks ÷ impressions", "impressions and clicks"),
    factLine("Conversion rate", m.cvrPct === null ? null : fmtPct(m.cvrPct), "conversions ÷ clicks", "clicks and conversions"),
    factLine(
      "CPC",
      m.cpc === null ? null : fmtAmount(m.cpc),
      m.cpcSource === "reported" ? "reported average CPC" : "spend ÷ clicks, same currency as the inputs",
      "spend and clicks, or a reported CPC"
    ),
    factLine("CPA", m.cpa === null ? null : fmtAmount(m.cpa), "cost ÷ conversions, same currency as the inputs", "conversions plus spend or CPC"),
    ...(m.cpcGapPct !== null && m.cpcGapPct > 10 ? [`- Reported CPC differs from spend ÷ clicks by ${m.cpcGapPct.toFixed(0)}% — flag this mismatch in notes.`] : []),
  ];
}
