import { describe, it, expect } from "vitest";
import { tryParseJson, estimateCostUsd } from "../llm";

describe("tryParseJson — tolerant JSON extraction from LLM output", () => {
  it("parses a clean JSON string", () => {
    expect(tryParseJson('{"ok":true}')).toEqual({ ok: true });
  });

  it("returns null on completely non-JSON text", () => {
    expect(tryParseJson("the AI rambled here with no JSON at all")).toBeNull();
  });

  it("extracts JSON from inside markdown fences", () => {
    const text = "Here's your output:\n```json\n{\"verdict\":\"good\"}\n```\nLet me know!";
    expect(tryParseJson(text)).toEqual({ verdict: "good" });
  });

  it("extracts JSON without explicit json marker on the fence", () => {
    const text = "Sure:\n```\n{\"a\":1}\n```";
    expect(tryParseJson(text)).toEqual({ a: 1 });
  });

  it("handles JSON with surrounding prose by grabbing the outermost braces", () => {
    const text = `Preamble. {"score": 7, "label": "ok"} Trailing notes.`;
    const parsed = tryParseJson<{ score: number; label: string }>(text);
    expect(parsed).toEqual({ score: 7, label: "ok" });
  });

  it("returns null for an empty string", () => {
    expect(tryParseJson("")).toBeNull();
  });
});

describe("estimateCostUsd — provider-aware pricing", () => {
  it("computes anthropic Sonnet pricing correctly (3 / 15 per million)", () => {
    const cost = estimateCostUsd("anthropic", "claude-sonnet-4-6", {
      input_tokens: 10_000,
      output_tokens: 5_000,
    });
    // 10k * 3/1M + 5k * 15/1M = 0.030 + 0.075 = 0.105
    expect(cost).toBeCloseTo(0.105, 4);
  });

  it("returns 0 for a free OpenRouter model", () => {
    const cost = estimateCostUsd("openrouter", "meta-llama/llama-3.3-70b-instruct:free", {
      input_tokens: 100_000,
      output_tokens: 50_000,
    });
    expect(cost).toBe(0);
  });

  it("returns 0 when usage is null", () => {
    expect(estimateCostUsd("anthropic", "claude-sonnet-4-6", null)).toBe(0);
  });

  it("returns 0 when provider or model id is unknown — never throws", () => {
    expect(estimateCostUsd("not-a-provider" as any, "gpt-5", { input_tokens: 100, output_tokens: 100 })).toBe(0);
    expect(estimateCostUsd("anthropic", "model-that-doesnt-exist", { input_tokens: 100, output_tokens: 100 })).toBe(0);
  });
});
