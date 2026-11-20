import { describe, it, expect } from "vitest";
import { buildAbTestPrompt } from "../prompts/ab-test";
import { buildBudgetPlannerPrompt } from "../prompts/budget-planner";
import { buildBudgetWastePrompt, parseImpressionShare } from "../prompts/budget-waste";

describe("A/B prompt: numbers come from the app, not the model", () => {
  const base = { platform: "Meta Feed", current_ad: "Ad", hypothesis_to_test: "urgency" };
  it("embeds the computed sample size and no longer asks the model for one", () => {
    const p = buildAbTestPrompt({ ...base, baseline_rate_pct: "10", mde_pct: "20", daily_visitors_per_variant: "400" });
    expect(p).toContain("3,841 per variant");
    expect(p).toContain("10 day(s)");
    expect(p).not.toContain("sample_size_per_variant_clicks");
    expect(p).not.toContain("expected_days_to_significance");
  });
  it("tells the model not to invent numbers when inputs are missing", () => {
    const p = buildAbTestPrompt({ ...base, baseline_rate_pct: "", mde_pct: "", daily_visitors_per_variant: "" });
    expect(p).toMatch(/Do NOT invent sample sizes/);
  });
  it("flags tests longer than 4 weeks", () => {
    const p = buildAbTestPrompt({ ...base, baseline_rate_pct: "2", mde_pct: "10", daily_visitors_per_variant: "100" });
    expect(p).toMatch(/exceeds 4 weeks/);
  });
});

describe("Budget planner prompt", () => {
  it("does not ask the model for volume / ROAS arithmetic", () => {
    const p = buildBudgetPlannerPrompt({ total_monthly: "5000", goal: "leads", business_type: "SaaS", current_aov_or_ltv: "", current_cvr: "", has_organic: "", geo: "" });
    expect(p).not.toContain('"volume_projection"');
    expect(p).not.toContain('"cpa_break_even_usd"');
    expect(p).toMatch(/DO NOT output impressions, clicks/);
  });
});

describe("Budget waste: demand captured only from real impression share", () => {
  const base = { platform: "Google Ads", monthly_spend: "5000", campaign_summary: "x" };
  it("omits the metric without impression share", () => {
    const p = buildBudgetWastePrompt(base);
    expect(p).toMatch(/OMIT this key entirely/);
  });
  it("pins the value when provided", () => {
    const p = buildBudgetWastePrompt({ ...base, impression_share_pct: "42%" });
    expect(p).toContain("USE EXACTLY 42");
  });
  it("parseImpressionShare", () => {
    expect(parseImpressionShare("42%")).toBe(42);
    expect(parseImpressionShare("")).toBeNull();
    expect(parseImpressionShare("140")).toBeNull();
  });
});
