import { describe, it, expect } from "vitest";
import { estimateVolume, benchmarkMidpoint, parseNumber, dailyFrom } from "../budget-estimates";

describe("parseNumber", () => {
  it("pulls the number out of free text", () => {
    expect(parseNumber("120 LTV")).toBe(120);
    expect(parseNumber("$1,250.50")).toBe(1250.5);
    expect(parseNumber("2.4%")).toBe(2.4);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
  });
});

describe("benchmarkMidpoint", () => {
  it("prefers the industry row", () => {
    const m = benchmarkMidpoint("cpc_usd", "Google Search", "b2b_saas");
    expect(m?.value).toBeCloseTo(5.25, 10);
    expect(m?.benchmark.industry).toBe("b2b_saas");
  });
  it("falls back to the general row", () => {
    expect(benchmarkMidpoint("cpc_usd", "Meta Feed", "legal")?.value).toBeCloseTo(0.95, 10);
  });
  it("null when nothing is stored", () => {
    expect(benchmarkMidpoint("cpc_usd", "Snapchat")).toBeNull();
  });
});

describe("estimateVolume", () => {
  it("uses the user's own numbers when given", () => {
    const e = estimateVolume({ monthlyBudget: "5000", platform: "Google Search", cpc: "2.50", cvrPct: "4", aov: "200", currencyCode: "USD" })!;
    expect(e.cpc.source).toBe("input");
    expect(e.clicks).toBeCloseTo(2000, 10);
    expect(e.conversions).toBeCloseTo(80, 10);
    expect(e.cpa).toBeCloseTo(62.5, 10);
    expect(e.revenue).toBeCloseTo(16000, 10);
    expect(e.roas).toBeCloseTo(3.2, 10);
    expect(e.breakEvenCpa).toBe(200);
  });

  it("fills gaps with labelled benchmark midpoints", () => {
    const e = estimateVolume({ monthlyBudget: 1000, platform: "Meta Feed", currencyCode: "USD" })!;
    expect(e.cpc.source).toBe("benchmark");
    expect(e.cpc.note).toMatch(/benchmark midpoint/);
    expect(e.cvrPct.source).toBe("benchmark");
    expect(e.clicks).toBeCloseTo(1000 / 0.95, 6);
    expect(e.revenue).toBeNull(); // no AOV → no revenue / ROAS invented
    expect(e.roas).toBeNull();
  });

  it("does not apply USD benchmark CPC to a non-USD budget", () => {
    const e = estimateVolume({ monthlyBudget: 1000, platform: "Meta Feed", currencyCode: "EUR" })!;
    expect(e.cpc.source).toBe("missing");
    expect(e.clicks).toBeNull();
    expect(e.conversions).toBeNull();
  });

  it("null without a budget", () => {
    expect(estimateVolume({ monthlyBudget: "", platform: "Meta Feed", currencyCode: "USD" })).toBeNull();
  });
});

describe("dailyFrom", () => {
  it("coerces strings (daily_usd.toFixed on a string used to crash)", () => {
    expect(dailyFrom("33.5", 1000)).toBe(33.5);
    expect(dailyFrom(undefined, "912")).toBeCloseTo(30, 0);
    expect(dailyFrom(null, null)).toBeNull();
  });
});
