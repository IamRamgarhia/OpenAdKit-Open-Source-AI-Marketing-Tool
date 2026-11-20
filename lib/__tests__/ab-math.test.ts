import { describe, it, expect } from "vitest";
import { normInv, sampleSizePerVariant, planAbTest } from "../ab-math";

describe("normInv", () => {
  it("matches standard z-values", () => {
    expect(normInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(normInv(0.8)).toBeCloseTo(0.841621, 5);
    expect(normInv(0.5)).toBeCloseTo(0, 8);
    expect(normInv(0.01)).toBeCloseTo(-2.326348, 5);
  });
});

describe("sampleSizePerVariant (two-proportion, α=.05 two-sided, power=.8)", () => {
  // Reference values from the closed-form formula (Fleiss, no continuity
  // correction) — the same figure G*Power / most online calculators give.
  it("10% → 12% (20% relative lift) ≈ 3,841 per variant", () => {
    expect(sampleSizePerVariant({ baselinePct: 10, mdePct: 20 })).toBe(3841);
  });
  it("5% → 6% ≈ 8,158 per variant", () => {
    expect(sampleSizePerVariant({ baselinePct: 5, mdePct: 20 })).toBe(8158);
  });
  it("50% → 60% ≈ 388 per variant", () => {
    expect(sampleSizePerVariant({ baselinePct: 50, mdePct: 20 })).toBe(388);
  });
  it("smaller effects need far more traffic", () => {
    const big = sampleSizePerVariant({ baselinePct: 3, mdePct: 30 })!;
    const small = sampleSizePerVariant({ baselinePct: 3, mdePct: 10 })!;
    expect(small).toBeGreaterThan(big * 7);
  });
  it("rejects impossible inputs", () => {
    expect(sampleSizePerVariant({ baselinePct: 0, mdePct: 20 })).toBeNull();
    expect(sampleSizePerVariant({ baselinePct: 90, mdePct: 20 })).toBeNull(); // p2 > 100%
    expect(sampleSizePerVariant({ baselinePct: 5, mdePct: 0 })).toBeNull();
    expect(sampleSizePerVariant({ baselinePct: NaN, mdePct: 10 })).toBeNull();
  });
});

describe("planAbTest", () => {
  it("parses form strings and computes days", () => {
    const p = planAbTest("10%", "20", "400");
    expect(p?.perVariant).toBe(3841);
    expect(p?.days).toBe(10);
    expect(p?.targetPct).toBeCloseTo(12, 10);
  });
  it("days is null without traffic", () => {
    expect(planAbTest("10", "20", "")?.days).toBeNull();
  });
  it("null when baseline missing", () => {
    expect(planAbTest("", "20", "100")).toBeNull();
  });
});
