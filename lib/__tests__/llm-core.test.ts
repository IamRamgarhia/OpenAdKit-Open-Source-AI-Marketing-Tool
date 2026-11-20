/**
 * lib/llm.ts entry points: central budget hard-stop and quota recording for
 * failed attempts.
 *
 * The provider here is a stub Provider object whose call/stream either throw
 * an HTTP-shaped LLMError or return a fixed literal — it exercises llm.ts's
 * bookkeeping, not any model's behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installBrowserShim, removeBrowserShim } from "./helpers/browser-shim";

vi.mock("../budget", async () => {
  const actual = await vi.importActual<typeof import("../budget")>("../budget");
  return { ...actual, assertWithinBudget: vi.fn() };
});

import { assertWithinBudget, BudgetExceededError, budgetStatusFrom } from "../budget";
import { llmCall, llmStream, LLMError } from "../llm";
import { getQuotaSnapshot } from "../quota-tracker";
import type { Provider } from "../providers/types";

const mockBudget = vi.mocked(assertWithinBudget);

function stubProvider(behaviour: { call?: () => Promise<any>; stream?: () => Promise<any> }): Provider {
  return {
    id: "groq",
    name: "Stub",
    category: "free",
    description: "",
    get_key_url: "https://example.com",
    default_model: "m",
    models: [{ id: "m", label: "m", pricing: { input_per_million_usd: 0, output_per_million_usd: 0 } }],
    testKey: async () => ({ ok: true, authenticated: true, message: "" }),
    call: vi.fn(behaviour.call ?? (async () => ({ text: "ok", usage: null, modelId: "m" }))),
    stream: vi.fn(behaviour.stream ?? (async () => ({ text: "ok", usage: null, modelId: "m" }))),
  };
}

const run = (p: Provider) => ({ providerOverride: p, apiKeyOverride: "k", modelOverride: "m", messages: [{ role: "user" as const, content: "x" }] });

beforeEach(() => {
  installBrowserShim();
  mockBudget.mockReset();
  mockBudget.mockResolvedValue(budgetStatusFrom([], { limitUsd: 0 }));
});
afterEach(() => removeBrowserShim());

describe("central budget hard-stop", () => {
  it("llmCall refuses with BudgetExceededError before contacting the provider", async () => {
    const blocked = budgetStatusFrom([{ cost_usd: 10, created_at: Date.now() }], { limitUsd: 5, hardStop: true });
    mockBudget.mockRejectedValue(new BudgetExceededError(blocked));
    const p = stubProvider({});
    await expect(llmCall(run(p))).rejects.toBeInstanceOf(BudgetExceededError);
    expect(p.call).not.toHaveBeenCalled();
  });

  it("llmStream refuses too", async () => {
    const blocked = budgetStatusFrom([{ cost_usd: 10, created_at: Date.now() }], { limitUsd: 5, hardStop: true });
    mockBudget.mockRejectedValue(new BudgetExceededError(blocked));
    const p = stubProvider({});
    await expect(llmStream(run(p), {})).rejects.toBeInstanceOf(BudgetExceededError);
    expect(p.stream).not.toHaveBeenCalled();
  });

  it("calls through when within budget", async () => {
    const p = stubProvider({});
    const r = await llmCall(run(p));
    expect(r.text).toBe("ok");
    expect(mockBudget).toHaveBeenCalledTimes(1);
  });
});

describe("quota recording", () => {
  it("records a successful call", async () => {
    await llmCall(run(stubProvider({})));
    expect(getQuotaSnapshot("groq")?.minute_used).toBe(1);
  });

  it("records a 429 attempt (it counts against the provider's RPM)", async () => {
    const p = stubProvider({ call: async () => { throw new LLMError("Rate limit", 429, "groq"); } });
    await expect(llmCall(run(p))).rejects.toBeInstanceOf(LLMError);
    expect(getQuotaSnapshot("groq")?.minute_used).toBe(1);
  });

  it("records a failed stream attempt that reached the provider", async () => {
    const p = stubProvider({ stream: async () => { throw new LLMError("cut off", undefined, "groq", "truncated"); } });
    await expect(llmStream(run(p), {})).rejects.toBeInstanceOf(LLMError);
    expect(getQuotaSnapshot("groq")?.minute_used).toBe(1);
  });

  it("does not record a network failure that never reached the provider", async () => {
    const p = stubProvider({ call: async () => { throw new TypeError("Failed to fetch"); } });
    await expect(llmCall(run(p))).rejects.toBeInstanceOf(TypeError);
    expect(getQuotaSnapshot("groq")?.minute_used).toBe(0);
  });
});

describe("resolve errors", () => {
  it("uses the product id, not the old 'ados' codename, when no provider is configured", async () => {
    const err = await llmCall({ messages: [{ role: "user", content: "x" }] }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.providerId).toBe("openadkit");
  });
});
