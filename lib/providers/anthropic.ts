import { LLMError, classifyKeyCheckError, readSseJson, refusedError, truncatedError, type KeyCheckResult, type LLMCallOptions, type LLMMessage, type LLMResult, type LLMUsage, type Provider, type StreamHandlers } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

function headers(apiKey: string, body?: Record<string, unknown>): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (body && "fallbacks" in body) h["anthropic-beta"] = FALLBACK_BETA;
  return h;
}

/**
 * Per-model request-surface rules. Explicit rows instead of regexes: a prefix
 * pattern like `^claude-opus-5` also matched `claude-opus-5-5`, which then got
 * `thinking: {type: "disabled"}` — a 400 on Opus 5.5. Source: the Claude API
 * reference (thinking & sampling table), reviewed 2026-11.
 *
 *  - sampling: "allowed" → send `temperature`; "omit" → the model rejects
 *    `temperature`/`top_p`/`top_k` (or any non-default value) with a 400.
 *  - thinking: how to keep thinking from eating `max_tokens` (OpenAdKit asks
 *    for short structured copy; max_tokens caps thinking + text together):
 *      "omit"          → off by default on this model; send nothing.
 *      "disabled"      → on by default; `{type:"disabled"}` is accepted.
 *      "between_tools" → `disabled` is a 400; `between_tools` turns it off.
 *      "always_on"     → cannot be turned off (disabled + budget_tokens 400);
 *                        lower `effort` and leave headroom in max_tokens.
 *  - fallbacks: model runs refusal classifiers; opt into server-side fallback
 *    so a false-positive decline is re-run on a fallback model in-call.
 */
export interface ClaudeModelCaps {
  sampling: "allowed" | "omit";
  thinking: "omit" | "disabled" | "between_tools" | "always_on";
  fallbacks?: boolean;
}

export const CLAUDE_MODEL_CAPS: Record<string, ClaudeModelCaps> = {
  "claude-fable-5-2": { sampling: "omit", thinking: "always_on", fallbacks: true },
  "claude-fable-5-1": { sampling: "omit", thinking: "always_on", fallbacks: true },
  "claude-fable-5": { sampling: "omit", thinking: "always_on" },
  "claude-opus-5-5": { sampling: "omit", thinking: "always_on", fallbacks: true },
  "claude-opus-5": { sampling: "omit", thinking: "disabled", fallbacks: true },
  "claude-opus-4-8": { sampling: "omit", thinking: "omit" },
  "claude-opus-4-7": { sampling: "omit", thinking: "omit" },
  "claude-opus-4-6": { sampling: "allowed", thinking: "omit" },
  "claude-sonnet-5-5": { sampling: "omit", thinking: "between_tools", fallbacks: true },
  "claude-sonnet-5": { sampling: "omit", thinking: "disabled" },
  "claude-sonnet-4-6": { sampling: "allowed", thinking: "omit" },
  "claude-haiku-5-5": { sampling: "omit", thinking: "disabled" },
  "claude-haiku-4-5": { sampling: "allowed", thinking: "omit" },
};

/** Unknown (newer) models: every Claude release since Opus 4.7 rejects sampling
 *  params, and omitting `thinking` is accepted everywhere — the safe default. */
const UNKNOWN_MODEL_CAPS: ClaudeModelCaps = { sampling: "omit", thinking: "omit" };

export function claudeCaps(model: string): ClaudeModelCaps {
  return CLAUDE_MODEL_CAPS[model] ?? UNKNOWN_MODEL_CAPS;
}

/** Extra max_tokens for models whose thinking can't be turned off, so the
 *  reasoning doesn't truncate the JSON answer. Capped to stay well inside the
 *  non-streaming request limits. */
const ALWAYS_ON_THINKING_HEADROOM = 6000;
const MAX_TOKENS_CEILING = 16000;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Build the `system` field. When caching is requested and the prompt is long
 *  enough to actually cache (the API silently no-ops below ~512-1024 tokens),
 *  emit the block form with a cache_control breakpoint. OpenAdKit's system
 *  prompt is the brand brain + framework stack — stable across every call for
 *  a given brand, so it's an ideal cache prefix. */
function buildSystem(opts: LLMCallOptions) {
  if (!opts.system) return undefined;
  // ~4 chars/token: only bother past ~600 tokens so we never pay the 1.25x
  // cache-write premium on a prefix too short to be cached.
  if (!opts.cacheSystem || opts.system.length < 2400) return opts.system;
  return [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }];
}

export function buildAnthropicBody(opts: LLMCallOptions, stream: boolean): Record<string, unknown> {
  const caps = claudeCaps(opts.model);
  const requested = opts.maxTokens ?? 2048;
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: requested,
    system: buildSystem(opts),
    messages: toAnthropicMessages(opts.messages),
  };
  if (stream) body.stream = true;
  if (caps.sampling === "allowed") {
    body.temperature = opts.temperature ?? 0.7;
  }
  switch (caps.thinking) {
    case "disabled":
      body.thinking = { type: "disabled" };
      break;
    case "between_tools":
      body.thinking = { type: "between_tools" };
      break;
    case "always_on":
      // Thinking can't be disabled: keep it shallow and give it room so the
      // answer itself isn't cut off.
      body.output_config = { effort: "low" };
      body.max_tokens = Math.max(requested, Math.min(MAX_TOKENS_CEILING, requested + ALWAYS_ON_THINKING_HEADROOM));
      break;
    case "omit":
      break;
  }
  if (caps.fallbacks) body.fallbacks = "default";
  return body;
}

/** Throw on a stop reason that means the text is not a complete answer. */
function checkStopReason(stopReason: unknown, stopDetails: any): void {
  if (stopReason === "max_tokens" || stopReason === "model_context_window_exceeded") {
    throw truncatedError("anthropic");
  }
  if (stopReason === "refusal") {
    throw refusedError("anthropic", typeof stopDetails?.category === "string" ? `category: ${stopDetails.category}` : null);
  }
}

/** Translate OpenAdKit's neutral LLMMessage[] into Anthropic's wire format,
 *  handling both plain text and multimodal (text + image) content. */
function toAnthropicMessages(messages: LLMMessage[]) {
  return messages.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: m.content.map((part) =>
        part.type === "text"
          ? { type: "text", text: part.text }
          : {
              type: "image",
              source: { type: "base64", media_type: part.media_type, data: part.data },
            }
      ),
    };
  });
}

async function readError(res: Response): Promise<LLMError> {
  // 429 Retry-After surfacing — Anthropic uses standard Retry-After plus the
  // `anthropic-ratelimit-*-reset` family. We pick whichever is shortest.
  // (Audit finding #61.)
  const ra = res.headers.get("retry-after");
  const retryPrefix = res.status === 429 && ra ? `Rate limit — retry in ${ra}s. ` : res.status === 429 ? "Rate limit hit. " : "";
  if (res.status === 429) {
    const seconds = Number(ra) || 60;
    try {
      const { recordRateLimitHit } = await import("../quota-tracker");
      recordRateLimitHit("anthropic", seconds);
    } catch {}
  }
  try {
    const body = await res.json();
    return new LLMError(retryPrefix + (body?.error?.message ?? res.statusText), res.status, "anthropic");
  } catch {
    return new LLMError(retryPrefix + res.statusText, res.status, "anthropic");
  }
}

async function call(opts: LLMCallOptions): Promise<LLMResult> {
  const reqBody = buildAnthropicBody(opts, false);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(opts.apiKey, reqBody),
    body: JSON.stringify(reqBody),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  const body = await res.json();
  checkStopReason(body?.stop_reason, body?.stop_details);
  const text = (body?.content ?? [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("");
  return { text, usage: body?.usage ?? null, modelId: opts.model };
}

async function stream(opts: LLMCallOptions, handlers: StreamHandlers): Promise<LLMResult> {
  const reqBody = buildAnthropicBody(opts, true);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(opts.apiKey, reqBody),
    body: JSON.stringify(reqBody),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new LLMError("Streaming response missing body", undefined, "anthropic");
  let full = "";
  let usage: LLMUsage | null = null;
  let stopReason: unknown = null;
  let stopDetails: any = null;
  await readSseJson(res.body, (evt) => {
    if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
      full += evt.delta.text;
      handlers.onDelta?.(evt.delta.text);
    } else if (evt.type === "message_delta") {
      if (evt.delta?.stop_reason) {
        stopReason = evt.delta.stop_reason;
        stopDetails = evt.delta.stop_details ?? evt.stop_details ?? null;
      }
      if (evt.usage) {
        const merged: LLMUsage = { ...(usage ?? { input_tokens: 0, output_tokens: 0 }), ...evt.usage };
        usage = merged;
        handlers.onUsage?.(merged);
      }
    } else if (evt.type === "message_start" && evt.message?.usage) {
      usage = evt.message.usage;
    } else if (evt.type === "error") {
      throw new LLMError(evt.error?.message ?? "stream error", undefined, "anthropic");
    }
  });
  checkStopReason(stopReason, stopDetails);
  handlers.onDone?.(full);
  return { text: full, usage, modelId: opts.model };
}

const TEST_MODEL = "claude-haiku-5-5"; // cheapest current model
async function testKey(apiKey: string): Promise<KeyCheckResult> {
  try {
    await call({
      apiKey,
      model: TEST_MODEL,
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 4,
    });
    return { ok: true, authenticated: true, modelId: TEST_MODEL, message: "Verified — key works." };
  } catch (e) {
    return classifyKeyCheckError(e, "Anthropic", TEST_MODEL);
  }
}

// Pricing is USD per million tokens, from platform.claude.com/docs/en/pricing.
// Reviewed 2026-11-20 (Claude API model table). lib/__tests__/providers-catalog.test.ts
// asserts the catalog stays internally consistent and providers-wire.test.ts
// pins the current rates; re-check the published prices whenever a model is
// added (Opus 4.7 shipped listed at 15/75 here for months when the real rate
// was 5/25, and Sonnet 5 sat at 3/15 when it is 2/10).
// Every id here needs a row in CLAUDE_MODEL_CAPS.
export const anthropic: Provider = {
  id: "anthropic",
  name: "Anthropic Claude",
  category: "paid",
  description: "The model OpenAdKit was originally built for. Strongest at long-context reasoning + safety. No free tier; pay-per-use.",
  get_key_url: "https://console.anthropic.com/settings/keys",
  default_model: "claude-sonnet-5-5",
  supports_vision: true,
  supports_prompt_caching: true,
  models: [
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5 — balanced (recommended)", pricing: { input_per_million_usd: 2, output_per_million_usd: 10 }, context_k: 1000, best_for: "Default for ad copy + optimization", supports_vision: true },
    { id: "claude-opus-5-5", label: "Opus 5.5 — deepest reasoning", pricing: { input_per_million_usd: 4, output_per_million_usd: 20 }, context_k: 1000, best_for: "Complex audits, multi-step reasoning, long teardowns", supports_vision: true },
    { id: "claude-haiku-5-5", label: "Haiku 5.5 — fastest & cheapest", pricing: { input_per_million_usd: 0.1, output_per_million_usd: 0.5 }, context_k: 1000, best_for: "High-volume hashtag/subject generation", supports_vision: true },
    { id: "claude-fable-5-2", label: "Fable 5.2 — most capable (premium)", pricing: { input_per_million_usd: 8, output_per_million_usd: 40 }, context_k: 1000, best_for: "Hardest strategy work where cost matters less", supports_vision: true },
    { id: "claude-opus-5", label: "Opus 5 — previous flagship", pricing: { input_per_million_usd: 5, output_per_million_usd: 25 }, context_k: 1000, supports_vision: true },
    { id: "claude-sonnet-5", label: "Sonnet 5 — previous balanced", pricing: { input_per_million_usd: 2, output_per_million_usd: 10 }, context_k: 1000, supports_vision: true },
    { id: "claude-opus-4-7", label: "Opus 4.7", pricing: { input_per_million_usd: 5, output_per_million_usd: 25 }, context_k: 1000, supports_vision: true },
    { id: "claude-opus-4-6", label: "Opus 4.6", pricing: { input_per_million_usd: 5, output_per_million_usd: 25 }, context_k: 1000, supports_vision: true },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", pricing: { input_per_million_usd: 3, output_per_million_usd: 15 }, context_k: 1000, supports_vision: true },
    { id: "claude-haiku-4-5", label: "Haiku 4.5 — legacy cheap", pricing: { input_per_million_usd: 1, output_per_million_usd: 5 }, context_k: 200, supports_vision: true },
  ],
  testKey,
  call,
  stream,
};
