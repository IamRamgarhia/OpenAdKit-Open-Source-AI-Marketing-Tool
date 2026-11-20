// Directional benchmark ranges compiled from public industry reports (2024-25).
// These are RANGES, not absolutes — they vary widely by account, offer, geo and
// season. Verify against your own attribution before treating any as truth.

/** Shown wherever these numbers are displayed or used in an estimate. */
export const BENCHMARK_DISCLAIMER =
  "Directional industry ranges from public reports — not guarantees. Your own account data always wins.";

export interface Benchmark {
  metric: "ctr" | "cpc_usd" | "cpa_usd" | "cvr" | "roas";
  platform: string;
  industry?: string;
  low: number;
  high: number;
  unit: "pct" | "usd" | "ratio";
  note?: string;
}

export const BENCHMARKS: Benchmark[] = [
  // Google Search CTR by industry (directional; most verticals land ~2-5.5%)
  { metric: "ctr", platform: "Google Search", industry: "ecommerce", low: 2.4, high: 3.0, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "finance", low: 2.5, high: 3.3, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "healthcare", low: 3.0, high: 3.6, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "legal", low: 3.4, high: 4.3, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "real_estate", low: 3.3, high: 4.1, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "b2b_saas", low: 2.0, high: 3.0, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "education", low: 3.0, high: 3.8, unit: "pct" },
  { metric: "ctr", platform: "Google Search", industry: "travel", low: 4.0, high: 5.5, unit: "pct" },
  // Google Display
  { metric: "ctr", platform: "Google Display", low: 0.4, high: 0.9, unit: "pct" },
  // Meta Feed CTR
  { metric: "ctr", platform: "Meta Feed", low: 0.9, high: 1.5, unit: "pct" },
  { metric: "ctr", platform: "Meta Stories", low: 0.5, high: 0.8, unit: "pct" },
  { metric: "ctr", platform: "Meta Reels", low: 1.0, high: 1.8, unit: "pct" },
  { metric: "ctr", platform: "Meta Carousel", low: 1.2, high: 2.2, unit: "pct", note: "Often out-clicks single-image ads — test it on your account" },
  // TikTok
  { metric: "ctr", platform: "TikTok In-Feed", low: 1.5, high: 3.0, unit: "pct" },
  { metric: "ctr", platform: "TikTok Spark Ads", low: 2.5, high: 3.5, unit: "pct", note: "Carries the post's organic engagement; often beats standard In-Feed — directional" },
  // LinkedIn
  { metric: "ctr", platform: "LinkedIn Sponsored", low: 0.4, high: 0.65, unit: "pct" },
  { metric: "ctr", platform: "LinkedIn Lead Gen", low: 0.5, high: 0.95, unit: "pct" },
  // Twitter / X
  { metric: "ctr", platform: "Twitter/X Promoted", low: 0.6, high: 1.5, unit: "pct" },

  // CPC ranges
  { metric: "cpc_usd", platform: "Google Search", industry: "ecommerce", low: 0.8, high: 2.5, unit: "usd" },
  { metric: "cpc_usd", platform: "Google Search", industry: "finance", low: 3.0, high: 12.0, unit: "usd" },
  { metric: "cpc_usd", platform: "Google Search", industry: "legal", low: 4.0, high: 18.0, unit: "usd" },
  { metric: "cpc_usd", platform: "Google Search", industry: "b2b_saas", low: 2.5, high: 8.0, unit: "usd" },
  { metric: "cpc_usd", platform: "Google Search", industry: "real_estate", low: 1.5, high: 4.0, unit: "usd" },
  { metric: "cpc_usd", platform: "Meta Feed", low: 0.4, high: 1.5, unit: "usd" },
  { metric: "cpc_usd", platform: "TikTok In-Feed", low: 0.3, high: 1.0, unit: "usd" },
  { metric: "cpc_usd", platform: "LinkedIn Sponsored", low: 5.0, high: 12.0, unit: "usd" },

  // CVR
  { metric: "cvr", platform: "Google Search", industry: "ecommerce", low: 1.8, high: 3.0, unit: "pct" },
  { metric: "cvr", platform: "Google Search", industry: "b2b_saas", low: 2.0, high: 4.0, unit: "pct" },
  { metric: "cvr", platform: "Google Search", industry: "finance", low: 3.0, high: 7.0, unit: "pct" },
  { metric: "cvr", platform: "Meta Feed", low: 1.0, high: 2.5, unit: "pct" },
  { metric: "cvr", platform: "TikTok In-Feed", low: 1.0, high: 2.5, unit: "pct" },
  { metric: "cvr", platform: "LinkedIn Lead Gen", low: 5.0, high: 12.0, unit: "pct" },

  // ROAS
  { metric: "roas", platform: "Google Shopping", industry: "ecommerce", low: 3.0, high: 8.0, unit: "ratio" },
  { metric: "roas", platform: "Meta Feed", industry: "ecommerce", low: 2.0, high: 5.0, unit: "ratio" },
  { metric: "roas", platform: "TikTok In-Feed", industry: "ecommerce", low: 1.5, high: 4.0, unit: "ratio" },
  { metric: "roas", platform: "Meta Advantage+", industry: "ecommerce", low: 1.4, high: 1.7, unit: "ratio", note: "Limited public data — treat as a rough reference" },
];

export const INDUSTRIES = [
  { value: "ecommerce", label: "E-commerce" },
  { value: "b2b_saas", label: "B2B SaaS" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "legal", label: "Legal" },
  { value: "real_estate", label: "Real estate" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
];

export type Verdict = "above" | "within" | "below" | "no_data";

export function compareToBenchmark(
  yourValue: number,
  platform: string,
  metric: Benchmark["metric"],
  industry?: string
): { verdict: Verdict; benchmark?: Benchmark; readout: string } {
  const candidates = BENCHMARKS.filter((b) => b.metric === metric && b.platform === platform);
  const exact = industry ? candidates.find((b) => b.industry === industry) : null;
  const general = candidates.find((b) => !b.industry);
  const b = exact || general;
  if (!b) return { verdict: "no_data", readout: `No ${metric.toUpperCase()} benchmark stored for ${platform}${industry ? ` / ${industry}` : ""}.` };
  if (yourValue < b.low) return { verdict: "below", benchmark: b, readout: `Below typical ${b.low}-${b.high}${b.unit === "pct" ? "%" : b.unit === "usd" ? " USD" : "×"} for ${platform}${b.industry ? ` / ${b.industry}` : ""}.` };
  if (yourValue > b.high) return { verdict: "above", benchmark: b, readout: `Above typical ${b.low}-${b.high}${b.unit === "pct" ? "%" : b.unit === "usd" ? " USD" : "×"} — strong.` };
  return { verdict: "within", benchmark: b, readout: `Within typical ${b.low}-${b.high}${b.unit === "pct" ? "%" : b.unit === "usd" ? " USD" : "×"}.` };
}
