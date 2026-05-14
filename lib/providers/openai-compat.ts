import { LLMError, type LLMCallOptions, type LLMResult, type LLMUsage, type StreamHandlers } from "./types";

export interface OpenAICompatConfig {
  baseUrl: string;
  extraHeaders?: Record<string, string>;
  bodyTransform?: (body: any) => any;
  testModel: string;
  /** Some OpenAI-compatible providers reject `stream_options.include_usage` with
   *  HTTP 422 (Mistral) or silently ignore it (Cerebras). When false, this field
   *  is omitted from streaming requests for this provider. Default: true. */
  supportsStreamUsage?: boolean;
  /** Per-provider default max_tokens override — needed for reasoning models
   *  (DeepSeek reasoner) that legitimately produce 16K+ token outputs. */
  defaultMaxTokens?: number;
}

function headers(apiKey: string, extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(extra ?? {}),
  };
}

async function readError(res: Response, providerId: string): Promise<LLMError> {
  // Surface Retry-After to the user for 429s — free-tier rate limits on Groq /
  // Cerebras / OpenRouter are common and a clear "retry in Ns" beats an opaque
  // "Rate limit exceeded". (Audit finding #61.)
  const retryAfter = res.headers.get("retry-after");
  const retryPrefix = res.status === 429 && retryAfter
    ? `Rate limit — retry in ${retryAfter}s. `
    : res.status === 429
      ? "Rate limit hit. "
      : "";
  try {
    const body = await res.json();
    return new LLMError(retryPrefix + (body?.error?.message ?? body?.message ?? res.statusText), res.status, providerId);
  } catch {
    return new LLMError(retryPrefix + res.statusText, res.status, providerId);
  }
}

function toMessages(opts: LLMCallOptions) {
  const messages: { role: string; content: any }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  for (const m of opts.messages) {
    if (typeof m.content === "string") {
      messages.push({ role: m.role, content: m.content });
    } else {
      // OpenAI vision format: content is an array of { type: "text", text } | { type: "image_url", image_url: { url } }
      const parts = m.content.map((p) => {
        if (p.type === "text") return { type: "text", text: p.text };
        return {
          type: "image_url",
          image_url: { url: `data:${p.media_type};base64,${p.data}` },
        };
      });
      messages.push({ role: m.role, content: parts });
    }
  }
  return messages;
}

export function makeOpenAICompatCall(cfg: OpenAICompatConfig, providerId: string) {
  return async function call(opts: LLMCallOptions): Promise<LLMResult> {
    const url = `${cfg.baseUrl}/chat/completions`;
    let body: any = {
      model: opts.model,
      messages: toMessages(opts),
      max_tokens: opts.maxTokens ?? cfg.defaultMaxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
    };
    if (cfg.bodyTransform) body = cfg.bodyTransform(body);
    const res = await fetch(url, {
      method: "POST",
      headers: headers(opts.apiKey, cfg.extraHeaders),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) throw await readError(res, providerId);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    const usage: LLMUsage | null = json?.usage
      ? {
          input_tokens: json.usage.prompt_tokens ?? 0,
          output_tokens: json.usage.completion_tokens ?? 0,
        }
      : null;
    return { text, usage, modelId: opts.model };
  };
}

export function makeOpenAICompatStream(cfg: OpenAICompatConfig, providerId: string) {
  return async function stream(opts: LLMCallOptions, handlers: StreamHandlers): Promise<LLMResult> {
    const url = `${cfg.baseUrl}/chat/completions`;
    let body: any = {
      model: opts.model,
      messages: toMessages(opts),
      max_tokens: opts.maxTokens ?? cfg.defaultMaxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    };
    // Mistral 422s on `stream_options`; opt-in per provider. (Audit finding #7.)
    if (cfg.supportsStreamUsage !== false) {
      body.stream_options = { include_usage: true };
    }
    if (cfg.bodyTransform) body = cfg.bodyTransform(body);
    const res = await fetch(url, {
      method: "POST",
      headers: headers(opts.apiKey, cfg.extraHeaders),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) throw await readError(res, providerId);
    if (!res.body) throw new LLMError("Streaming response missing body", undefined, providerId);

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
            const delta = evt?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              full += delta;
              handlers.onDelta?.(delta);
            }
            if (evt?.usage) {
              usage = {
                input_tokens: evt.usage.prompt_tokens ?? 0,
                output_tokens: evt.usage.completion_tokens ?? 0,
              };
              handlers.onUsage?.(usage);
            }
          } catch {}
        }
      }
    }
    handlers.onDone?.(full);
    return { text: full, usage, modelId: opts.model };
  };
}

export function makeOpenAICompatTestKey(cfg: OpenAICompatConfig, providerId: string) {
  const call = makeOpenAICompatCall(cfg, providerId);
  return async function testKey(apiKey: string): Promise<boolean> {
    try {
      await call({
        apiKey,
        model: cfg.testModel,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 4,
      });
      return true;
    } catch {
      return false;
    }
  };
}
