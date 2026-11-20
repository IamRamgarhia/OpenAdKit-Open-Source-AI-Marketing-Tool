import { describe, it, expect } from "vitest";
import { buildAbTestPrompt } from "../prompts/ab-test";
import { buildBudgetPlannerPrompt, projectionPlatform } from "../prompts/budget-planner";
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
  it("hands the model the app's projection as facts and keeps saturation flags top-level", () => {
    const p = buildBudgetPlannerPrompt({ total_monthly: "5000", goal: "sales", business_type: "ecom", current_aov_or_ltv: "200", current_cvr: "4", has_organic: "", geo: "", avg_cpc: "2.5", gross_margin_pct: "40" });
    expect(p).toContain("PROJECTION COMPUTED BY THE APP");
    expect(p).toContain("Conversions / month: 80");
    expect(p).toContain("at 40% gross margin: 80");
    expect(p).toContain('"saturation_flags"');
    expect(p).not.toContain('"break_even"');
  });
  it("maps MCP short platform names onto benchmark platforms", () => {
    expect(projectionPlatform("meta")).toBe("Meta Feed");
    expect(projectionPlatform("google_search")).toBe("Google Search");
    expect(projectionPlatform("")).toBe("Google Search");
    expect(projectionPlatform("LinkedIn Sponsored")).toBe("LinkedIn Sponsored");
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
