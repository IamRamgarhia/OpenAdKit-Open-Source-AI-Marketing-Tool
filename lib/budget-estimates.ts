import { BENCHMARKS, type Benchmark } from "./benchmarks";

/**
 * Deterministic volume projection for the Budget Planner.
 *
 * The planner used to let the model "estimate" impressions / clicks /
 * conversions / ROAS — arithmetic on numbers it invented. These are now
 * computed from the user's own inputs (CPC, CVR, AOV) and, only where the
 * user left a gap, a CLEARLY LABELLED midpoint of the stored benchmark range.
 */

export type Source = "input" | "benchmark" | "missing";

export interface Assumption {
  value: number | null;
  source: Source;
  /** Human label for where a benchmark came from. */
  note?: string;
}

export interface VolumeEstimate {
  budget: number;
  cpc: Assumption;
  cvrPct: Assumption;
  ctrPct: Assumption;
  aov: Assumption;
  clicks: number | null;
  impressions: number | null;
  conversions: number | null;
  cpa: number | null;
  revenue: number | null;
  roas: number | null;
  /** CPA at which revenue = spend (gross, before margin): equals AOV. */
  breakEvenCpa: number | null;
}

export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Midpoint of the benchmark range for metric/platform (industry-specific first, then general). */
export function benchmarkMidpoint(
  metric: Benchmark["metric"],
  platform: string,
  industry?: string
): { value: number; benchmark: Benchmark } | null {
  const rows = BENCHMARKS.filter((b) => b.metric === metric && b.platform === platform);
  const b = (industry ? rows.find((r) => r.industry === industry) : undefined) ?? rows.find((r) => !r.industry) ?? null;
  if (!b) return null;
  return { value: (b.low + b.high) / 2, benchmark: b };
}

function describe(b: Benchmark): string {
  const unit = b.unit === "pct" ? "%" : b.unit === "usd" ? " USD" : "×";
  return `benchmark midpoint · ${b.platform}${b.industry ? ` / ${b.industry}` : ""} ${b.low}–${b.high}${unit}`;
}

function pick(
  userValue: unknown,
  metric: Benchmark["metric"],
  platform: string,
  industry: string | undefined,
  allowBenchmark: boolean
): Assumption {
  const n = parseNumber(userValue);
  if (n !== null && n > 0) return { value: n, source: "input" };
  if (allowBenchmark) {
    const m = benchmarkMidpoint(metric, platform, industry);
    if (m) return { value: m.value, source: "benchmark", note: describe(m.benchmark) };
  }
  return { value: null, source: "missing" };
}

export function estimateVolume(args: {
  monthlyBudget: unknown;
  platform: string;
  industry?: string;
  cpc?: unknown;
  cvrPct?: unknown;
  aov?: unknown;
  /** Benchmarks are USD; only fall back to a benchmark CPC when budgeting in USD. */
  currencyCode: string;
}): VolumeEstimate | null {
  const budget = parseNumber(args.monthlyBudget);
  if (budget === null || budget <= 0) return null;
  const industry = args.industry || undefined;
  const cpc = pick(args.cpc, "cpc_usd", args.platform, industry, args.currencyCode === "USD");
  const cvrPct = pick(args.cvrPct, "cvr", args.platform, industry, true);
  const ctrPct = pick(undefined, "ctr", args.platform, industry, true);
  const aovN = parseNumber(args.aov);
  const aov: Assumption = aovN !== null && aovN > 0 ? { value: aovN, source: "input" } : { value: null, source: "missing" };

  const clicks = cpc.value ? budget / cpc.value : null;
  const impressions = clicks !== null && ctrPct.value ? clicks / (ctrPct.value / 100) : null;
  const conversions = clicks !== null && cvrPct.value ? clicks * (cvrPct.value / 100) : null;
  const cpa = conversions ? budget / conversions : null;
  const revenue = conversions !== null && aov.value ? conversions * aov.value : null;
  const roas = revenue !== null ? revenue / budget : null;
  return {
    budget,
    cpc,
    cvrPct,
    ctrPct,
    aov,
    clicks,
    impressions,
    conversions,
    cpa,
    revenue,
    roas,
    breakEvenCpa: aov.value,
  };
}

/** Daily amount from a model-provided line item: trust daily if numeric, else monthly / 30.4. */
export function dailyFrom(daily: unknown, monthly: unknown): number | null {
  const d = parseNumber(daily);
  if (d !== null) return d;
  const m = parseNumber(monthly);
  return m !== null ? m / 30.4 : null;
}
