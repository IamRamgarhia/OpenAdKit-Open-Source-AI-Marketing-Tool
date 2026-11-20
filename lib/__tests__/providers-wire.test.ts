/**
 * Provider wire-format tests: request bodies per model, stop/finish-reason
 * surfacing, and SSE stream termination.
 *
 * `fetch` is replaced with a recorder that returns literal fixture payloads
 * shaped like the real provider responses (Anthropic Messages SSE, Gemini
 * streamGenerateContent?alt=sse, OpenAI chat.completions chunks). Nothing here
 * pretends to be live model output — the fixtures exercise our parsing only.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { anthropic, buildAnthropicBody, CLAUDE_MODEL_CAPS } from "../providers/anthropic";
import { google, buildGeminiBody } from "../providers/google";
import { openai, groq } from "../providers/openai-providers";
import { LLMError, classifyKeyCheckError } from "../providers/types";
import { PROVIDER_BY_ID } from "../providers";

interface Captured {
  url: string;
  init: RequestInit;
  body: any;
}

function sseResponse(text: string, chunkSize = 7): Response {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(make: () => Response): Captured[] {
  const calls: Captured[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: init?.body ? JSON.parse(String(init.body)) : null });
    return make();
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const base = { apiKey: "k", messages: [{ role: "user" as const, content: "hi" }], maxTokens: 3000 };

// ---------------------------------------------------------------------------
// Anthropic request body per model (bug: regexes matched -5-5 models)
// ---------------------------------------------------------------------------
describe("Anthropic buildAnthropicBody per model", () => {
  it("Opus 5.5: never sends thinking:disabled or temperature (both 400)", () => {
    const b = buildAnthropicBody({ ...base, model: "claude-opus-5-5" }, false);
    expect(b.thinking).toBeUndefined();
    expect(b.temperature).toBeUndefined();
    expect((b.output_config as any)?.effort).toBe("low");
    // thinking can't be turned off, so leave room for it on top of the answer
    expect(b.max_tokens as number).toBeGreaterThan(3000);
  });

  it("Sonnet 5.5: turns thinking off with between_tools, never disabled; no temperature", () => {
    const b = buildAnthropicBody({ ...base, model: "claude-sonnet-5-5" }, false);
    expect(b.thinking).toEqual({ type: "between_tools" });
    expect(b.temperature).toBeUndefined();
    expect(b.max_tokens).toBe(3000);
  });

  it("Haiku 5.5: no non-default temperature; thinking disabled (allowed at default effort)", () => {
    const b = buildAnthropicBody({ ...base, model: "claude-haiku-5-5", temperature: 0.7 }, false);
    expect(b.temperature).toBeUndefined();
    expect(b.thinking).toEqual({ type: "disabled" });
  });

  it("Fable 5.2: omits thinking entirely (always on) and temperature", () => {
    const b = buildAnthropicBody({ ...base, model: "claude-fable-5-2" }, false);
    expect(b.thinking).toBeUndefined();
    expect(b.temperature).toBeUndefined();
    expect((b.output_config as any)?.effort).toBe("low");
  });

  it("Opus 5 and Sonnet 5: thinking disabled, no temperature", () => {
    for (const model of ["claude-opus-5", "claude-sonnet-5"]) {
      const b = buildAnthropicBody({ ...base, model }, false);
      expect(b.thinking, model).toEqual({ type: "disabled" });
      expect(b.temperature, model).toBeUndefined();
    }
  });

  it("Opus 4.7: no temperature, no thinking field", () => {
    const b = buildAnthropicBody({ ...base, model: "claude-opus-4-7" }, false);
    expect(b.temperature).toBeUndefined();
    expect(b.thinking).toBeUndefined();
  });

  it("Sonnet 4.6 / Haiku 4.5 / Opus 4.6: temperature still allowed, no thinking", () => {
    for (const model of ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-6"]) {
      const b = buildAnthropicBody({ ...base, model, temperature: 0.4 }, false);
      expect(b.temperature, model).toBe(0.4);
      expect(b.thinking, model).toBeUndefined();
    }
  });

  it("unknown future Claude model: conservative body (no temperature, no thinking)", () => {
    const b = buildAnthropicBody({ ...base, model: "claude-opus-9" }, false);
    expect(b.temperature).toBeUndefined();
    expect(b.thinking).toBeUndefined();
  });

  it("opts the refusal-classifier models into server-side fallbacks", () => {
    for (const model of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"]) {
      const b = buildAnthropicBody({ ...base, model }, false);
      expect(b.fallbacks, model).toBe("default");
    }
    expect(buildAnthropicBody({ ...base, model: "claude-haiku-5-5" }, false).fallbacks).toBeUndefined();
  });

  it("sends the fallback beta header only when fallbacks are in the body", async () => {
    const calls = stubFetch(() => jsonResponse({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }));
    await anthropic.call({ ...base, model: "claude-opus-5-5" });
    await anthropic.call({ ...base, model: "claude-haiku-5-5" });
    expect((calls[0].init.headers as any)["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    expect((calls[1].init.headers as any)["anthropic-beta"]).toBeUndefined();
  });

  it("has a capability row for every catalog model", () => {
    for (const m of PROVIDER_BY_ID.anthropic.models) {
      expect(CLAUDE_MODEL_CAPS[m.id], m.id).toBeDefined();
    }
  });
});

describe("Anthropic catalog", () => {
  const ids = PROVIDER_BY_ID.anthropic.models.map((m) => m.id);
  it("lists the current generation and defaults to Sonnet 5.5", () => {
    for (const id of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"]) {
      expect(ids).toContain(id);
    }
    expect(PROVIDER_BY_ID.anthropic.default_model).toBe("claude-sonnet-5-5");
  });

  it("prices models at the published per-MTok rates", () => {
    const price = (id: string) => PROVIDER_BY_ID.anthropic.models.find((m) => m.id === id)!.pricing;
    expect(price("claude-opus-5-5")).toEqual({ input_per_million_usd: 4, output_per_million_usd: 20 });
    expect(price("claude-sonnet-5-5")).toEqual({ input_per_million_usd: 2, output_per_million_usd: 10 });
    expect(price("claude-haiku-5-5")).toEqual({ input_per_million_usd: 0.1, output_per_million_usd: 0.5 });
    expect(price("claude-fable-5-2")).toEqual({ input_per_million_usd: 8, output_per_million_usd: 40 });
    expect(price("claude-sonnet-5")).toEqual({ input_per_million_usd: 2, output_per_million_usd: 10 });
  });

  it("verifies keys against Haiku 5.5", async () => {
    const calls = stubFetch(() =>
      jsonResponse({ content: [{ type: "text", text: "po" }], stop_reason: "max_tokens", usage: { input_tokens: 5, output_tokens: 4 } })
    );
    const r = await anthropic.testKey("sk-ant-x");
    expect(calls[0].body.model).toBe("claude-haiku-5-5");
    // A 4-token ping naturally stops on max_tokens — that is still a working key.
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Truncation / refusal surfacing
// ---------------------------------------------------------------------------
describe("Anthropic stop_reason surfacing", () => {
  it("non-streaming max_tokens raises a truncation LLMError", async () => {
    stubFetch(() => jsonResponse({ content: [{ type: "text", text: '{"a":' }], stop_reason: "max_tokens" }));
    const err = await anthropic.call({ ...base, model: "claude-sonnet-5-5" }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("truncated");
    expect(err.message).toMatch(/cut off|length limit/i);
  });

  it("non-streaming refusal raises a refusal LLMError", async () => {
    stubFetch(() =>
      jsonResponse({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: null } })
    );
    const err = await anthropic.call({ ...base, model: "claude-opus-5-5" }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("refused");
    expect(err.message).toMatch(/declined/i);
  });

  it("streaming max_tokens in message_delta raises truncation", async () => {
    const sse =
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":1}}}\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"{\\"a\\":"}}\n\n' +
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"max_tokens"},"usage":{"output_tokens":3000}}\n\n' +
      'event: message_stop\ndata: {"type":"message_stop"}\n\n';
    stubFetch(() => sseResponse(sse));
    const err = await anthropic.stream({ ...base, model: "claude-sonnet-5-5" }, {}).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("truncated");
  });

  it("streaming refusal raises refusal", async () => {
    const sse =
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}\n\n' +
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"refusal","stop_details":{"type":"refusal","category":"bio"}},"usage":{"output_tokens":0}}\n\n';
    stubFetch(() => sseResponse(sse));
    const err = await anthropic.stream({ ...base, model: "claude-opus-5-5" }, {}).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("refused");
  });

  it("truncated LLMError counts as a working key in key checks", () => {
    const r = classifyKeyCheckError(new LLMError("cut off", undefined, "anthropic", "truncated"), "Anthropic", "m");
    expect(r.ok).toBe(true);
    expect(r.authenticated).toBe(true);
  });
});

describe("OpenAI-compatible finish_reason surfacing", () => {
  it("non-streaming finish_reason=length raises truncation", async () => {
    stubFetch(() =>
      jsonResponse({ choices: [{ message: { content: '{"a":' }, finish_reason: "length" }], usage: { prompt_tokens: 1, completion_tokens: 2 } })
    );
    const err = await groq.call({ ...base, model: "llama-3.3-70b-versatile" }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("truncated");
  });

  it("non-streaming finish_reason=content_filter raises refusal", async () => {
    stubFetch(() => jsonResponse({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }));
    const err = await groq.call({ ...base, model: "llama-3.3-70b-versatile" }).catch((e) => e);
    expect(err.code).toBe("refused");
  });

  it("streaming finish_reason=length raises truncation", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"{\\"a\\":"},"finish_reason":null}]}\n\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n' +
      "data: [DONE]\n\n";
    stubFetch(() => sseResponse(sse));
    const err = await groq.stream({ ...base, model: "llama-3.3-70b-versatile" }, {}).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("truncated");
  });

  it("finish_reason=stop is a normal completion", async () => {
    stubFetch(() => jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
    const r = await groq.call({ ...base, model: "llama-3.3-70b-versatile" });
    expect(r.text).toBe("ok");
  });
});

describe("Gemini finishReason surfacing", () => {
  it("non-streaming MAX_TOKENS raises truncation", async () => {
    stubFetch(() =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"a":' }], role: "model" }, finishReason: "MAX_TOKENS" }] })
    );
    const err = await google.call({ ...base, model: "gemini-3.6-flash" }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("truncated");
  });

  it("streaming MAX_TOKENS raises truncation", async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"{\\"a\\":"}],"role":"model"}}]}\r\n\r\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"1"}],"role":"model"},"finishReason":"MAX_TOKENS"}],"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":5}}\r\n\r\n';
    stubFetch(() => sseResponse(sse));
    const err = await google.stream({ ...base, model: "gemini-3.6-flash" }, {}).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.code).toBe("truncated");
  });

  it("non-streaming SAFETY raises refusal", async () => {
    stubFetch(() => jsonResponse({ candidates: [{ finishReason: "SAFETY" }] }));
    const err = await google.call({ ...base, model: "gemini-3.6-flash" }).catch((e) => e);
    expect(err.code).toBe("refused");
  });
});

// ---------------------------------------------------------------------------
// SSE: final event without trailing blank line must not be dropped
// ---------------------------------------------------------------------------
describe("SSE final event without trailing blank line", () => {
  it("Anthropic keeps the last delta", async () => {
    const sse =
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":1}}}\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}';
    stubFetch(() => sseResponse(sse));
    const r = await anthropic.stream({ ...base, model: "claude-sonnet-5-5" }, {});
    expect(r.text).toBe("Hello world");
  });

  it("Gemini keeps the last chunk and its usage", async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}],"role":"model"}}]}\r\n\r\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"world"}],"role":"model"},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":2}}';
    stubFetch(() => sseResponse(sse));
    const r = await google.stream({ ...base, model: "gemini-3.6-flash" }, {});
    expect(r.text).toBe("Hello world");
    expect(r.usage).toEqual({ input_tokens: 3, output_tokens: 2 });
  });

  it("OpenAI-compatible keeps the last delta and usage", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2}}';
    stubFetch(() => sseResponse(sse));
    const r = await groq.stream({ ...base, model: "llama-3.3-70b-versatile" }, {});
    expect(r.text).toBe("Hello world");
    expect(r.usage).toEqual({ input_tokens: 4, output_tokens: 2 });
  });

  it("flushes a multi-byte character split across the final chunk boundary", async () => {
    // "é" is 2 bytes in UTF-8; a 1-byte chunk size splits it.
    const sse = 'data: {"choices":[{"delta":{"content":"café"},"finish_reason":"stop"}]}';
    stubFetch(() => sseResponse(sse, 1));
    const r = await groq.stream({ ...base, model: "llama-3.3-70b-versatile" }, {});
    expect(r.text).toBe("café");
  });
});

// ---------------------------------------------------------------------------
// Thinking budgets (Gemini) and reasoning effort (OpenAI)
// ---------------------------------------------------------------------------
describe("Gemini thinking config", () => {
  it("disables thinking on 2.5 Flash", () => {
    const b = buildGeminiBody({ ...base, model: "gemini-2.5-flash" });
    expect(b.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(b.generationConfig.maxOutputTokens).toBe(3000);
  });

  it("uses the minimum budget on 2.5 Pro (cannot disable) and adds headroom", () => {
    const b = buildGeminiBody({ ...base, model: "gemini-2.5-pro" });
    expect(b.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 128 });
    expect(b.generationConfig.maxOutputTokens).toBeGreaterThan(3000);
  });

  it("uses a low thinking level on Gemini 3.x and adds headroom", () => {
    const b = buildGeminiBody({ ...base, model: "gemini-3.6-flash" });
    expect(b.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(b.generationConfig.maxOutputTokens).toBeGreaterThan(3000);
  });
});

describe("OpenAI reasoning models", () => {
  it("sets low reasoning effort and leaves room in max_completion_tokens", async () => {
    const calls = stubFetch(() => jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
    await openai.call({ ...base, model: "gpt-5.6-terra" });
    const b = calls[0].body;
    expect(b.reasoning_effort).toBe("low");
    expect(b.max_tokens).toBeUndefined();
    expect(b.temperature).toBeUndefined();
    expect(b.max_completion_tokens).toBeGreaterThan(3000);
  });

  it("leaves non-reasoning models alone", async () => {
    const calls = stubFetch(() => jsonResponse({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
    await openai.call({ ...base, model: "gpt-4.1-mini" });
    const b = calls[0].body;
    expect(b.reasoning_effort).toBeUndefined();
    expect(b.max_tokens).toBe(3000);
  });
});
