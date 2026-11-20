/**
 * Arithmetic the optimizers used to ask the model for (CTR, CVR, CPC, CPA,
 * week-over-week decay, bid feasibility) is computed in code and handed to
 * the prompt as facts — the model only interprets it.
 */
import { describe, it, expect } from "vitest";
import { performanceMetrics, pctChange, fatigueDecay, bidFeasibility, landingMetrics, computedBlock } from "../ad-metrics";
import { buildCtrPrompt } from "../prompts/ctr-optimizer";
import { buildQualityScorePrompt } from "../prompts/quality-score";
import { buildLandingPrompt } from "../prompts/landing-page";
import { buildFatiguePrompt } from "../prompts/ad-fatigue";
import { buildBidStrategyPrompt } from "../prompts/bid-strategy";
import { AI_TOOL_BY_NAME } from "../tools/registry";

describe("performanceMetrics", () => {
  it("computes CTR, CVR, CPC and CPA from spend", () => {
    const m = performanceMetrics({ impressions: 12400, clicks: 186, conversions: 9, spend: "₹14,800" });
    expect(m.ctrPct).toBeCloseTo(1.5, 2);
    expect(m.cvrPct).toBeCloseTo(4.84, 2);
    expect(m.cpc).toBeCloseTo(79.57, 2);
    expect(m.cpa).toBeCloseTo(1644.44, 2);
  });
  it("falls back to reported CPC × clicks for CPA and flags a CPC mismatch", () => {
    const m = performanceMetrics({ clicks: 100, conversions: 4, avgCpc: "$2.00" });
    expect(m.cpc).toBe(2);
    expect(m.cpa).toBe(50);
    const mm = performanceMetrics({ clicks: 100, spend: "250", avgCpc: "2" });
    expect(mm.cpcGapPct).toBeCloseTo(25, 5);
  });
  it("returns null instead of guessing", () => {
    const m = performanceMetrics({ impressions: "", clicks: 0, conversions: 3 });
    expect(m.ctrPct).toBeNull();
    expect(m.cvrPct).toBeNull();
    expect(m.cpa).toBeNull();
  });
});

describe("pctChange / fatigueDecay", () => {
  it("computes week-1 → latest change in %", () => {
    expect(pctChange(52000, 31000)).toBeCloseTo(-40.38, 2);
    expect(pctChange("1.9%", "0.8%")).toBeCloseTo(-57.89, 2);
    expect(pctChange(0, 5)).toBeNull();
    expect(pctChange("", 5)).toBeNull();
  });
  it("covers impressions, CTR, CPM and conversions", () => {
    const d = fatigueDecay({ impressions_week_1: 52000, impressions_week_latest: 31000, ctr_week_1: "1.9%", ctr_week_latest: "0.8%", cpm_week_1: "₹110", cpm_week_latest: "₹165", conversions_week_1: 41, conversions_week_latest: 12 });
    expect(d.impressions).toBeCloseTo(-40.38, 2);
    expect(d.cpm).toBeCloseTo(50, 5);
    expect(d.conversions).toBeCloseTo(-70.73, 2);
  });
});

describe("landingMetrics", () => {
  it("computes CVR and classifies bounce with no gap between bands", () => {
    expect(landingMetrics({ visitors: 2100, conversions: 17, bounce_rate: "71%" })).toMatchObject({ cvrPct: expect.closeTo(0.81, 2), bounceBand: "high" });
    expect(landingMetrics({ bounce_rate: "72.5" }).bounceBand).toBe("high");
    expect(landingMetrics({ bounce_rate: "55%" }).bounceBand).toBe("typical");
    expect(landingMetrics({ bounce_rate: "35%" }).bounceBand).toBe("suspiciously_low");
    expect(landingMetrics({ bounce_rate: "80%" }).bounceBand).toBe("very_high");
    expect(landingMetrics({}).bounceBand).toBeNull();
  });
});

describe("bidFeasibility", () => {
  it("budget ÷ target CPA caps monthly conversions", () => {
    const f = bidFeasibility({ monthlyBudget: "$4,000", targetCpa: "$150", currentCpa: "$180", conversionsPerMonth: 22, conversionsLast7d: 6 });
    expect(f.maxConversionsAtTargetCpa).toBeCloseTo(26.67, 2);
    expect(f.conversionsAtCurrentCpa).toBeCloseTo(22.22, 2);
    expect(f.monthlyConversions).toBeCloseTo(25.71, 2); // 6 × 30 / 7: last-7d preferred
    expect(f.monthlyConversionsSource).toBe("last_7d");
    expect(f.targetCpaReachable).toBe("no"); // 26.7 < 30 needed for tCPA
  });
  it("is unknown without a target CPA", () => {
    const f = bidFeasibility({ monthlyBudget: "4000", conversionsPerMonth: 22 });
    expect(f.maxConversionsAtTargetCpa).toBeNull();
    expect(f.targetCpaReachable).toBe("unknown");
    expect(f.monthlyConversionsSource).toBe("monthly");
  });
});

describe("prompts embed the computed values as facts", () => {
  it("CTR optimizer", () => {
    const p = buildCtrPrompt({ platform: "Google Search", industry: "Dental", current_copy: "x", impressions: 12400, clicks: 186, conversions: 9, spend: "₹14,800" });
    expect(p).toContain("COMPUTED FROM YOUR NUMBERS");
    expect(p).toContain("CTR: 1.50%");
    expect(p).not.toMatch(/Compute CTR = clicks/);
  });
  it("Quality Score", () => {
    const p = buildQualityScorePrompt({ keyword: "k", current_ad_copy: "x", landing_page_summary: "y", impressions: 5200, clicks: 98 });
    expect(p).toContain("CTR: 1.88%");
    expect(p).toMatch(/conversion rate: could not be computed/i);
  });
  it("Landing page", () => {
    const p = buildLandingPrompt({ ad_promise: "a", landing_copy: "b", audience: "c", visitors: 2100, conversions: 17, bounce_rate: "71%" });
    expect(p).toContain("Conversion rate: 0.81%");
    expect(p).not.toContain("estimated_post_click_drop_off_pct");
  });
  it("Ad fatigue (impressions_decay, not reach_decay)", () => {
    const p = buildFatiguePrompt({ platform: "Meta", ad_copy: "x", days_running: 38, impressions_week_1: 52000, impressions_week_latest: 31000 });
    expect(p).toContain("Impressions change: -40.4%");
    expect(p).toContain("impressions_decay");
    expect(p).not.toContain("reach_decay");
  });
  it("Bid strategy", () => {
    const p = buildBidStrategyPrompt({ platform: "Google Ads", goal: "Demo requests", monthly_budget: "$4,000", conversions_per_month: 22, conversions_last_7d: 6, target_cpa: "$150" });
    expect(p).toContain("26.7 conversions / month");
    expect(p).not.toContain("ECPC");
    expect(p).toMatch(/Never recommend Enhanced CPC/);
  });
  it("computedBlock labels the facts", () => {
    expect(computedBlock(["- a"])).toMatch(/treat as facts/i);
  });
});

describe("MCP registry exposes the same numbers", () => {
  it.each([
    ["optimize_ctr", { impressions: 1000, clicks: 20, conversions: 2, spend: "40" }, "ctrPct", 2],
    ["optimize_quality_score", { impressions: 1000, clicks: 50 }, "ctrPct", 5],
    ["optimize_landing_page", { visitors: 200, conversions: 4 }, "cvrPct", 2],
    ["optimize_ad_fatigue", { impressions_week_1: 100, impressions_week_latest: 50 }, "impressions", -50],
    ["optimize_bid_strategy", { monthly_budget: "3000", target_cpa: "100", conversions_per_month: 10 }, "maxConversionsAtTargetCpa", 30],
  ])("%s", (name, input, key, want) => {
    const c = AI_TOOL_BY_NAME[name].computed!(input) as Record<string, number>;
    expect(c[key]).toBeCloseTo(want, 5);
  });
});
