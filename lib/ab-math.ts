/**
 * A/B test sample-size math, computed deterministically on the client.
 *
 * The A/B planner used to ask the model for "sample size" and "days to
 * significance" with no baseline conversion rate — numbers it had no way to
 * know — and showed them under a heading called "Math". This is the standard
 * two-proportion z-test sample size (Fleiss, no continuity correction):
 *
 *   n = ( z₁₋α/₂·√(2·p̄·(1−p̄)) + z₁₋β·√(p₁(1−p₁) + p₂(1−p₂)) )² / (p₂ − p₁)²
 *
 * with p₁ = baseline rate, p₂ = p₁·(1 + relative MDE), p̄ = (p₁+p₂)/2.
 * Defaults: α = 0.05 two-sided, power = 0.80.
 */

/** Inverse standard-normal CDF (Acklam's rational approximation, |ε| < 1.2e-9). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p must be in (0,1)");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export interface SampleSizeInput {
  /** Baseline conversion rate in PERCENT (e.g. 3.2 for 3.2%). */
  baselinePct: number;
  /** Minimum detectable effect, RELATIVE, in percent (e.g. 20 = +20%). */
  mdePct: number;
  alpha?: number;
  power?: number;
}

/** Visitors (or clicks / impressions — whatever the rate's denominator is) needed PER VARIANT. */
export function sampleSizePerVariant({ baselinePct, mdePct, alpha = 0.05, power = 0.8 }: SampleSizeInput): number | null {
  const p1 = baselinePct / 100;
  const p2 = p1 * (1 + mdePct / 100);
  if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1) || p1 === p2) return null;
  if (!(alpha > 0 && alpha < 1) || !(power > 0 && power < 1)) return null;
  const za = normInv(1 - alpha / 2);
  const zb = normInv(power);
  const pbar = (p1 + p2) / 2;
  const num = za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((num * num) / ((p2 - p1) * (p2 - p1)));
}

export interface TestPlanMath {
  perVariant: number;
  /** Days at the given daily traffic per variant, or null if traffic unknown. */
  days: number | null;
  baselinePct: number;
  targetPct: number;
  mdePct: number;
}

/** Parse loosely-typed form values ("3.2%", "200") into a plan, or null if unusable. */
export function planAbTest(baseline: unknown, mde: unknown, dailyPerVariant: unknown): TestPlanMath | null {
  const parse = (v: unknown) => Number(String(v ?? "").replace(/[%,\s]/g, ""));
  const baselinePct = parse(baseline);
  const mdePct = parse(mde);
  const daily = parse(dailyPerVariant);
  const perVariant = sampleSizePerVariant({ baselinePct, mdePct });
  if (perVariant === null) return null;
  return {
    perVariant,
    days: Number.isFinite(daily) && daily > 0 ? Math.ceil(perVariant / daily) : null,
    baselinePct,
    targetPct: baselinePct * (1 + mdePct / 100),
    mdePct,
  };
}
