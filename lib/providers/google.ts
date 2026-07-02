import { LLMError, type LLMCallOptions, type LLMResult, type LLMUsage, type Provider, type StreamHandlers } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function toGeminiBody(opts: LLMCallOptions) {
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
  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }
  return body;
}

async function readError(res: Response): Promise<LLMError> {
  // 429 retry tracking: Gemini puts retryDelay in error.details[].retryDelay
  // (e.g. "15.66s"). We also accept the Retry-After header as a fallback.
  if (res.status === 429) {
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      // Find the RetryInfo entry in the details array
      const details: any[] = body?.error?.details ?? [];
      const retryInfo = details.find((d) => typeof d?.retryDelay === "string");
      const delayStr = retryInfo?.retryDelay ?? res.headers.get("retry-after") ?? "60s";
      const seconds = parseFloat(String(delayStr).replace(/s$/, "")) || 60;
      const { recordRateLimitHit } = await import("../quota-tracker");
      recordRateLimitHit("google", seconds);
    } catch {}
  }
  try {
    const body = await res.json();
    return new LLMError(body?.error?.message ?? res.statusText, res.status, "google");
  } catch {
    return new LLMError(res.statusText, res.status, "google");
  }
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
    body: JSON.stringify(toGeminiBody(opts)),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  const body = await res.json();
  const text = (body?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .join("");
  return { text, usage: usageFrom(body), modelId: opts.model };
}

async function stream(opts: LLMCallOptions, handlers: StreamHandlers): Promise<LLMResult> {
  const url = `${API_BASE}/models/${opts.model}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(toGeminiBody(opts)),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new LLMError("Streaming response missing body", undefined, "google");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let usage: LLMUsage | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const dataLines = ev.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, ""));
        for (const raw of dataLines) {
          const line = raw.trim();
          if (!line || line === "[DONE]") continue;
          try {
            const evt = JSON.parse(line);
            // Surface mid-stream failures instead of returning a truncated result.
            if (evt?.error) {
              throw new LLMError(evt.error?.message ?? "stream error", undefined, "google");
            }
            const blockReason = evt?.promptFeedback?.blockReason;
            if (blockReason) {
              throw new LLMError(`Blocked by Gemini safety filter: ${blockReason}`, undefined, "google");
            }
            const finishReason = evt?.candidates?.[0]?.finishReason;
            if (finishReason === "SAFETY" || finishReason === "RECITATION") {
              throw new LLMError(`Generation stopped: ${finishReason}`, undefined, "google");
            }
            const parts = evt?.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const p of parts) {
                if (typeof p?.text === "string" && p.text) {
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
          } catch (err) {
            if (err instanceof LLMError) throw err;
          }
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  handlers.onDone?.(full);
  return { text: full, usage, modelId: opts.model };
}

async function testKey(apiKey: string): Promise<boolean> {
  try {
    await call({
      apiKey,
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 4,
    });
    return true;
  } catch {
    return false;
  }
}

export const google: Provider = {
  id: "google",
  name: "Google Gemini",
  category: "freemium",
  description: "Strong at multimodal + long-context. Generous free tier on Gemini 2.5 Flash.",
  free_note: "Free tier (AI Studio key): ~15 RPM on Gemini 2.5 Flash; ~5 RPM on Pro. Plenty for most users.",
  get_key_url: "https://aistudio.google.com/app/apikey",
  default_model: "gemini-2.5-flash",
  supports_vision: true,
  models: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — recommended (free tier)", pricing: { input_per_million_usd: 0.3, output_per_million_usd: 2.5 }, best_for: "Default — strong on free tier", supports_vision: true },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro — strongest", pricing: { input_per_million_usd: 1.25, output_per_million_usd: 10 }, best_for: "Long-context teardowns, complex reasoning", supports_vision: true },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite — cheapest", pricing: { input_per_million_usd: 0.075, output_per_million_usd: 0.3 }, supports_vision: true },
  ],
  testKey,
  call,
  stream,
};
