import { LLMError, classifyKeyCheckError, readSseJson, refusedError, truncatedError, type KeyCheckResult, type LLMCallOptions, type LLMResult, type LLMUsage, type Provider, type StreamHandlers } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Extra maxOutputTokens for models whose thinking can't be switched off, so
 *  thinking tokens don't eat the JSON answer. */
const THINKING_HEADROOM = 4096;

/**
 * Gemini thinking models spend `maxOutputTokens` on thinking FIRST, so a
 * 3k-token budget on a short structured-copy request could come back empty or
 * cut off mid-JSON. Keep thinking minimal and leave room where it can't be off.
 *  - 2.5 Flash / Flash-Lite: thinkingBudget 0 disables thinking.
 *  - 2.5 Pro: cannot disable; 128 is the minimum budget.
 *  - Gemini 3.x: thinkingLevel replaces budgets; "low" is the cheapest level
 *    every 3.x model accepts.
 */
function thinkingFor(model: string): { config?: Record<string, unknown>; headroom: number } {
  if (/^gemini-2\.5-flash/.test(model)) return { config: { thinkingBudget: 0 }, headroom: 0 };
  if (/^gemini-2\.5-pro/.test(model)) return { config: { thinkingBudget: 128 }, headroom: THINKING_HEADROOM };
  if (/^gemini-3/.test(model)) return { config: { thinkingLevel: "low" }, headroom: THINKING_HEADROOM };
  return { headroom: 0 };
}

export function buildGeminiBody(opts: LLMCallOptions) {
  const contents = opts.messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") return { role, parts: [{ text: m.content }] };
    return {
      role,
      parts: m.content.map((p) =>
        p.type === "text"
          ? { text: p.text }
          : { inlineData: { mimeType: p.media_type, data: p.data } }
      ),
    };
  });
  const thinking = thinkingFor(opts.model);
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: (opts.maxTokens ?? 2048) + thinking.headroom,
    temperature: opts.temperature ?? 0.7,
  };
  if (thinking.config) generationConfig.thinkingConfig = thinking.config;
  const body: any = { contents, generationConfig };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }
  return body;
}

const REFUSAL_FINISH = new Set(["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]);

/** Throw when a candidate's finishReason means the text is incomplete/blocked. */
function checkFinish(evt: any): void {
  const blockReason = evt?.promptFeedback?.blockReason;
  if (blockReason) throw refusedError("google", `Gemini safety filter: ${blockReason}`);
  const finishReason = evt?.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") throw truncatedError("google");
  if (typeof finishReason === "string" && REFUSAL_FINISH.has(finishReason)) {
    throw refusedError("google", `Gemini stopped: ${finishReason}`);
  }
}

async function readError(res: Response): Promise<LLMError> {
  // Read the body ONCE — we need it both for the retry delay and for the
  // message, and Response bodies can only be consumed a single time.
  let body: any = null;
  try {
    body = await res.clone().json();
  } catch {
    /* non-JSON error body */
  }

  // 429 retry tracking: Gemini puts retryDelay in error.details[].retryDelay
  // (e.g. "15.66s"). We also accept the Retry-After header as a fallback.
  let retryPrefix = "";
  if (res.status === 429) {
    const details: any[] = body?.error?.details ?? [];
    const retryInfo = details.find((d) => typeof d?.retryDelay === "string");
    const delayStr = retryInfo?.retryDelay ?? res.headers.get("retry-after") ?? "60s";
    const seconds = parseFloat(String(delayStr).replace(/s$/, "")) || 60;
    // Surface the wait to the USER, not just to the quota tracker. Gemini was
    // the only provider that recorded the retry delay internally and then threw
    // it away — so a rate-limited Gemini user saw a bare quota message with no
    // indication of how long to wait, while Anthropic/OpenAI users got one.
    retryPrefix = `Rate limit — retry in ${Math.ceil(seconds)}s. `;
    try {
      const { recordRateLimitHit } = await import("../quota-tracker");
      recordRateLimitHit("google", seconds);
    } catch {}
  }

  const detail = body?.error?.message ?? res.statusText;
  return new LLMError(retryPrefix + detail, res.status, "google");
}

function usageFrom(body: any): LLMUsage | null {
  if (!body?.usageMetadata) return null;
  return {
    input_tokens: body.usageMetadata.promptTokenCount ?? 0,
    // 2.5 models bill thinking tokens separately; include them so output isn't undercounted.
    output_tokens: (body.usageMetadata.candidatesTokenCount ?? 0) + (body.usageMetadata.thoughtsTokenCount ?? 0),
  };
}

async function call(opts: LLMCallOptions): Promise<LLMResult> {
  const url = `${API_BASE}/models/${opts.model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(buildGeminiBody(opts)),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  const body = await res.json();
  checkFinish(body);
  const text = (body?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => !p?.thought)
    .map((p: any) => p?.text ?? "")
    .join("");
  return { text, usage: usageFrom(body), modelId: opts.model };
}

async function stream(opts: LLMCallOptions, handlers: StreamHandlers): Promise<LLMResult> {
  const url = `${API_BASE}/models/${opts.model}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(buildGeminiBody(opts)),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new LLMError("Streaming response missing body", undefined, "google");

  let full = "";
  let usage: LLMUsage | null = null;
  // Gemini terminates SSE events with CRLF CRLF; readSseJson handles both
  // delimiters and the final un-terminated event.
  await readSseJson(res.body, (evt) => {
    // Surface mid-stream failures instead of returning a truncated result.
    if (evt?.error) {
      throw new LLMError(evt.error?.message ?? "stream error", undefined, "google");
    }
    const parts = evt?.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const p of parts) {
        // Skip thought summaries if a model ever returns them.
        if (typeof p?.text === "string" && p.text && !p.thought) {
          full += p.text;
          handlers.onDelta?.(p.text);
        }
      }
    }
    const u = usageFrom(evt);
    if (u) {
      usage = u;
      handlers.onUsage?.(u);
    }
    checkFinish(evt);
  });
  handlers.onDone?.(full);
  return { text: full, usage, modelId: opts.model };
}

const TEST_MODEL = "gemini-3.5-flash-lite";
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
    return classifyKeyCheckError(e, "Google Gemini", TEST_MODEL);
  }
}

// Catalog verified against ai.google.dev/gemini-api/docs/pricing on 2026-08-01.
// The app previously shipped Gemini 2.5 as "recommended" and 2.0 Flash Lite as
// "cheapest" — two generations behind, and 2.0 Flash Lite had been withdrawn
// from the API entirely, so selecting it produced a 404 on every call.
export const google: Provider = {
  id: "google",
  name: "Google Gemini",
  category: "freemium",
  description: "Strong at multimodal + long-context. Generous free tier across the Gemini 3 family.",
  free_note: "Free tier (AI Studio key): rate-limited but genuinely usable on the Flash + Flash-Lite models.",
  get_key_url: "https://aistudio.google.com/app/apikey",
  default_model: "gemini-3.6-flash",
  supports_vision: true,
  models: [
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash — recommended (free tier)", pricing: { input_per_million_usd: 1.5, output_per_million_usd: 7.5 }, context_k: 1000, best_for: "Default — newest Flash, free tier", supports_vision: true },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite — cheapest (free tier)", pricing: { input_per_million_usd: 0.3, output_per_million_usd: 2.5 }, best_for: "High-volume hashtags / subject lines", supports_vision: true },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", pricing: { input_per_million_usd: 1.5, output_per_million_usd: 9 }, supports_vision: true },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite — budget", pricing: { input_per_million_usd: 0.25, output_per_million_usd: 1.5 }, supports_vision: true },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro — long-context (legacy)", pricing: { input_per_million_usd: 1.25, output_per_million_usd: 10 }, best_for: "Long teardowns", supports_vision: true },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (legacy)", pricing: { input_per_million_usd: 0.3, output_per_million_usd: 2.5 }, supports_vision: true },
  ],
  testKey,
  call,
  stream,
};
