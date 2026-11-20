/**
 * Provider-catalog integrity tests.
 *
 * Why this file exists: the Anthropic catalog shipped Opus 4.7 priced at
 * $15/$75 per MTok when the real rate was $5/$25 — a silent 3x over-report on
 * every cost estimate, every per-client spend rollup, and every extraction
 * cost preview. Nothing caught it because nothing asserted anything about the
 * catalog. These tests can't know the *published* price, but they lock down
 * every invariant that IS checkable, so the next drift is a red build rather
 * than a wrong invoice.
 */
import { describe, it, expect } from "vitest";
import { PROVIDERS, PROVIDER_BY_ID, findModel, estimateCostUsd } from "../providers";

describe("provider catalog integrity", () => {
  it("has a unique id per provider", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("indexes every provider by id", () => {
    for (const p of PROVIDERS) expect(PROVIDER_BY_ID[p.id]).toBe(p);
  });

  for (const p of PROVIDERS) {
    describe(`${p.id}`, () => {
      it("declares at least one model", () => {
        expect(p.models.length).toBeGreaterThan(0);
      });

      it("has a default_model that exists in its own catalog", () => {
        // The single most damaging drift: a default that isn't in models[]
        // makes findModel() return null, so estimateCostUsd() silently
        // returns 0 for every generation on that provider.
        expect(findModel(p.id, p.default_model)).not.toBeNull();
      });

      it("has unique model ids", () => {
        const ids = p.models.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("prices every model with finite, non-negative numbers", () => {
        for (const m of p.models) {
          expect(Number.isFinite(m.pricing.input_per_million_usd), `${m.id} input price`).toBe(true);
          expect(Number.isFinite(m.pricing.output_per_million_usd), `${m.id} output price`).toBe(true);
          expect(m.pricing.input_per_million_usd).toBeGreaterThanOrEqual(0);
          expect(m.pricing.output_per_million_usd).toBeGreaterThanOrEqual(0);
        }
      });

      it("never prices output below input", () => {
        // Every commercial LLM charges more for output than input. A row that
        // violates this is a transposed pair, which is how the Opus 4.7 error
        // class starts.
        for (const m of p.models) {
          if (m.pricing.input_per_million_usd === 0) continue; // free tier
          expect(
            m.pricing.output_per_million_usd,
            `${m.id}: output ${m.pricing.output_per_million_usd} < input ${m.pricing.input_per_million_usd}`
          ).toBeGreaterThanOrEqual(m.pricing.input_per_million_usd);
        }
      });

      it("keeps prices inside a sane envelope (catches 10x fat-fingers)", () => {
        for (const m of p.models) {
          expect(m.pricing.input_per_million_usd, `${m.id} input`).toBeLessThanOrEqual(50);
          expect(m.pricing.output_per_million_usd, `${m.id} output`).toBeLessThanOrEqual(250);
        }
      });

      it("gives every model a non-empty label", () => {
        for (const m of p.models) expect(m.label.trim().length).toBeGreaterThan(0);
      });

      it("declares supports_vision at provider level if any model has it", () => {
        const anyVision = p.models.some((m) => m.supports_vision);
        if (anyVision) expect(p.supports_vision).toBe(true);
      });

      it("uses an https key url", () => {
        expect(p.get_key_url.startsWith("https://")).toBe(true);
      });
    });
  }
});

describe("anthropic model ids", () => {
  const ids = PROVIDER_BY_ID.anthropic.models.map((m) => m.id);

  it("never uses a date-suffixed variant", () => {
    // `claude-haiku-4-5-20251001` is not a valid model ID — aliases are bare.
    for (const id of ids) {
      expect(id, `${id} has a date suffix`).not.toMatch(/-\d{8}$/);
    }
  });

  it("offers the current flagship + balanced models", () => {
    expect(ids).toContain("claude-opus-5");
    expect(ids).toContain("claude-sonnet-5");
  });
});

describe("estimateCostUsd", () => {
  it("returns 0 for an unknown provider or model", () => {
    expect(estimateCostUsd("nope", "nope", { input_tokens: 1000, output_tokens: 1000 })).toBe(0);
    expect(estimateCostUsd("anthropic", "not-a-model", { input_tokens: 1000, output_tokens: 1000 })).toBe(0);
  });

  it("returns 0 for null usage", () => {
    expect(estimateCostUsd("anthropic", "claude-sonnet-5", null)).toBe(0);
  });

  it("prices a known model correctly", () => {
    // Sonnet 5: $2 in / $10 out per million (was mis-listed at 3/15).
    const cost = estimateCostUsd("anthropic", "claude-sonnet-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(12, 6);
  });

  it("bills cache writes at 1.25x and cache reads at 0.1x input rate", () => {
    const cost = estimateCostUsd("anthropic", "claude-sonnet-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    // 2 * 1.25 + 2 * 0.1 = 2.50 + 0.20
    expect(cost).toBeCloseTo(2.7, 6);
  });

  it("treats missing usage fields as zero rather than NaN", () => {
    const cost = estimateCostUsd("anthropic", "claude-sonnet-5", { input_tokens: 1000 });
    expect(Number.isFinite(cost)).toBe(true);
    expect(cost).toBeGreaterThan(0);
  });
});
