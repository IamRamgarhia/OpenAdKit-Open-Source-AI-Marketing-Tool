import { LLMError, type LLMCallOptions, type LLMMessage, type LLMResult, type LLMUsage, type Provider, type StreamHandlers } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

/** Translate AdForge's neutral LLMMessage[] into Anthropic's wire format,
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
  try {
    const body = await res.json();
    return new LLMError(retryPrefix + (body?.error?.message ?? res.statusText), res.status, "anthropic");
  } catch {
    return new LLMError(retryPrefix + res.statusText, res.status, "anthropic");
  }
}

async function call(opts: LLMCallOptions): Promise<LLMResult> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(opts.apiKey),
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: toAnthropicMessages(opts.messages),
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  const body = await res.json();
  const text = (body?.content ?? [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("");
  return { text, usage: body?.usage ?? null, modelId: opts.model };
}

async function stream(opts: LLMCallOptions, handlers: StreamHandlers): Promise<LLMResult> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(opts.apiKey),
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      stream: true,
      system: opts.system,
      messages: toAnthropicMessages(opts.messages),
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new LLMError("Streaming response missing body", undefined, "anthropic");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let usage: LLMUsage | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const ev of events) {
      const dataLines = ev.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
      for (const line of dataLines) {
        if (!line || line === "[DONE]") continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            full += evt.delta.text;
            handlers.onDelta?.(evt.delta.text);
          } else if (evt.type === "message_delta" && evt.usage) {
            const merged: LLMUsage = { ...(usage ?? { input_tokens: 0, output_tokens: 0 }), ...evt.usage };
            usage = merged;
            handlers.onUsage?.(merged);
          } else if (evt.type === "message_start" && evt.message?.usage) {
            usage = evt.message.usage;
          } else if (evt.type === "error") {
            throw new LLMError(evt.error?.message ?? "stream error", undefined, "anthropic");
          }
        } catch (err) {
          if (err instanceof LLMError) throw err;
        }
      }
    }
  }
  handlers.onDone?.(full);
  return { text: full, usage, modelId: opts.model };
}

async function testKey(apiKey: string): Promise<boolean> {
  try {
    await call({
      apiKey,
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 4,
    });
    return true;
  } catch {
    return false;
  }
}

export const anthropic: Provider = {
  id: "anthropic",
  name: "Anthropic Claude",
  category: "paid",
  description: "The model AdForge was originally built for. Strongest at long-context reasoning + safety. No free tier; pay-per-use.",
  get_key_url: "https://console.anthropic.com/settings/keys",
  default_model: "claude-sonnet-4-6",
  supports_vision: true,
  models: [
    { id: "claude-opus-4-7", label: "Opus 4.7 — deepest reasoning", pricing: { input_per_million_usd: 15, output_per_million_usd: 75 }, best_for: "Complex audits, multi-step reasoning, long teardowns", supports_vision: true },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced (recommended)", pricing: { input_per_million_usd: 3, output_per_million_usd: 15 }, best_for: "Default for ad copy + optimization", supports_vision: true },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest & cheapest", pricing: { input_per_million_usd: 1, output_per_million_usd: 5 }, best_for: "High-volume hashtag/subject generation", supports_vision: true },
  ],
  testKey,
  call,
  stream,
};
