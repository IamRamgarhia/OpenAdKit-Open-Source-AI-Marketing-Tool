export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "groq"
  | "cerebras"
  | "openrouter"
  | "together"
  | "deepseek"
  | "mistral";

export type ProviderCategory = "free" | "freemium" | "paid";

/**
 * Image part for multimodal messages.
 * media_type is the MIME type (image/png, image/jpeg, image/webp, image/gif).
 * data is base64-encoded raw bytes (no `data:` prefix).
 */
export interface ImagePart {
  type: "image";
  media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string;
}

export interface TextPart {
  type: "text";
  text: string;
}

export type ContentPart = TextPart | ImagePart;

export interface LLMMessage {
  role: "user" | "assistant";
  /**
   * Either a plain text string (most calls) OR an array of parts for multimodal
   * input. Provider adapters translate this into their native format. Providers
   * with supports_vision=false will reject messages containing ImageParts.
   */
  content: string | ContentPart[];
}

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface LLMCallOptions {
  apiKey: string;
  model: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /**
   * Ask the provider to cache the system prompt when it supports prefix
   * caching. OpenAdKit sends the same ~1.1k-token framework stack + full brand
   * brain as the system prompt on every generation, so a cache hit is ~90%
   * cheaper on that prefix. Providers that don't support it ignore the flag.
   *
   * Only safe when the system prompt is stable across calls — which it is here
   * (it's derived from the brand brain, not from per-request content).
   */
  cacheSystem?: boolean;
}

export interface LLMResult {
  text: string;
  usage: LLMUsage | null;
  modelId: string;
}

export interface StreamHandlers {
  onDelta?: (delta: string) => void;
  onUsage?: (usage: LLMUsage) => void;
  onDone?: (full: string) => void;
}

export interface ModelDef {
  id: string;
  label: string;
  pricing: {
    input_per_million_usd: number;
    output_per_million_usd: number;
  };
  context_k?: number;
  best_for?: string;
  /** True if this specific model can accept image inputs. Defaults to the provider-level flag when omitted. */
  supports_vision?: boolean;
}

export interface Provider {
  id: ProviderId;
  name: string;
  category: ProviderCategory;
  description: string;
  free_note?: string;
  get_key_url: string;
  default_model: string;
  models: ModelDef[];
  /** True if at least one model in the provider's catalog can accept images. */
  supports_vision?: boolean;
  /** True if the provider supports explicit system-prompt prefix caching
   *  (honours LLMCallOptions.cacheSystem). Informational — adapters that don't
   *  support it simply ignore the flag. */
  supports_prompt_caching?: boolean;
  testKey: (apiKey: string) => Promise<KeyCheckResult>;
  call: (opts: LLMCallOptions) => Promise<LLMResult>;
  stream: (opts: LLMCallOptions, handlers: StreamHandlers) => Promise<LLMResult>;
}

/**
 * SSE event delimiter.
 *
 * The spec allows CRLF, LF, or CR line endings, and providers differ: Anthropic
 * and the OpenAI-compatible hosts send LF LF, Gemini sends CRLF CRLF. Splitting
 * on a hardcoded "\n\n" silently parsed ZERO events from Gemini — the stream
 * appeared to succeed while returning nothing. Always split with this.
 */
export const SSE_EVENT_DELIMITER = /\r?\n\r?\n/;

/** Machine-readable reason for an LLMError that isn't an HTTP failure. */
export type LLMErrorCode = "truncated" | "refused";

export class LLMError extends Error {
  constructor(message: string, public status?: number, public providerId?: string, public code?: LLMErrorCode) {
    super(message);
    this.name = "LLMError";
  }
}

/** The model hit the output-length cap before finishing. A truncated JSON reply
 *  can never validate, so surfacing it beats a confusing schema failure. */
export function truncatedError(providerId: string): LLMError {
  return new LLMError(
    "The AI's reply was cut off at the length limit before it finished, so the result would be incomplete. Try again, or pick a model with a larger output limit.",
    undefined,
    providerId,
    "truncated"
  );
}

/** The provider's safety system (or the model itself) declined the request. */
export function refusedError(providerId: string, detail?: string | null): LLMError {
  const suffix = detail ? ` (${detail})` : "";
  return new LLMError(
    `The AI provider declined to answer this request${suffix}. Rephrase the brief, or try a different model.`,
    undefined,
    providerId,
    "refused"
  );
}

/**
 * Read an SSE body and hand every parsed `data:` JSON payload to `onEvent`.
 *
 * Handles CRLF/LF delimiters (SSE_EVENT_DELIMITER), flushes the TextDecoder at
 * end-of-stream, and parses a final event that arrives WITHOUT a trailing blank
 * line — previously that last event (often the one carrying finish reason and
 * usage) was silently dropped. Unparseable lines are skipped; an LLMError thrown
 * by `onEvent` propagates.
 */
export async function readSseJson(body: ReadableStream<Uint8Array>, onEvent: (evt: any) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (ev: string) => {
    const dataLines = ev
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""));
    for (const raw of dataLines) {
      const line = raw.trim();
      if (!line || line === "[DONE]") continue;
      let evt: unknown;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      onEvent(evt);
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(SSE_EVENT_DELIMITER);
      buffer = events.pop() ?? "";
      for (const ev of events) handle(ev);
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const ev of buffer.split(SSE_EVENT_DELIMITER)) handle(ev);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }
}

/**
 * Outcome of a "Save + Verify" key check.
 *
 * `ok` and `authenticated` are deliberately separate. The previous API was a
 * bare boolean, which conflated "this key is wrong" with every other reason a
 * request can fail — so a 429 (which PROVES the key authenticated) was reported
 * as "rejected that key", and a user on a free tier would delete a perfectly
 * good key. A model-404 caused by our own stale catalog read the same way.
 *
 * Rule for callers: SAVE the key whenever `authenticated` is true, even if
 * `ok` is false. Only an auth failure means the key itself is bad.
 */
export interface KeyCheckResult {
  /** The key works and a real completion came back. */
  ok: boolean;
  /** The key itself is valid — the request got past authentication. */
  authenticated: boolean;
  /** HTTP status, when the failure came from the provider rather than the network. */
  status?: number;
  /** User-facing explanation. Always populated. */
  message: string;
  /** Model the check was performed against, for display. */
  modelId?: string;
}

/**
 * Turn a failed key-check into a KeyCheckResult, distinguishing "bad key" from
 * everything else. Shared by every provider adapter so the classification is
 * consistent.
 */
/**
 * Providers disagree wildly on the status code for a bad key. Google's Gemini
 * API returns **HTTP 400** ("API key not valid"), not 401 — so status alone
 * would classify a plainly invalid Gemini key as "key appears valid, saved",
 * the exact opposite of the truth. Match the message first, then fall back to
 * status.
 */
const AUTH_FAILURE_TEXT =
  /api[ _-]?key not valid|invalid[ _-]?api[ _-]?key|api[ _-]?key.*(invalid|expired|revoked)|incorrect api key|unauthorized|unauthenticated|authentication[ _-]?(failed|error)|permission[ _-]?denied|invalid[ _-]?authentication|no api key/i;

export function classifyKeyCheckError(err: unknown, providerName: string, modelId: string): KeyCheckResult {
  const status = err instanceof LLMError ? err.status : undefined;
  // Key checks send a tiny max_tokens on purpose; running out of it means a
  // real completion came back, so the key works.
  if (err instanceof LLMError && (err.code === "truncated" || err.code === "refused")) {
    return { ok: true, authenticated: true, modelId, message: "Verified — key works." };
  }
  const raw = err instanceof Error && err.message ? err.message : "Unknown error";
  // Providers often end messages with a period; we append our own.
  const detail = raw.replace(/\.\s*$/, "");

  // Message-based auth detection runs BEFORE status, because a provider that
  // reports auth failures as 400 would otherwise be misread as "key is fine".
  if (AUTH_FAILURE_TEXT.test(raw)) {
    return {
      ok: false,
      authenticated: false,
      status,
      modelId,
      message: `${providerName} rejected this key: ${detail}. Check you copied it whole, and that it's a ${providerName} key.`,
    };
  }

  if (status === 401 || status === 403) {
    return { ok: false, authenticated: false, status, modelId, message: `${providerName} rejected this key. Check you copied it whole, and that it's for ${providerName} (not another provider).` };
  }
  if (status === 429) {
    // Authenticated, just throttled. The key is good — keep it.
    return { ok: true, authenticated: true, status, modelId, message: `Key works — ${providerName} is rate-limiting right now, so generation may need a moment. Saved.` };
  }
  if (status === 404) {
    // Our catalog names a model this provider no longer serves. Not the user's fault.
    return { ok: false, authenticated: true, status, modelId, message: `Key looks valid, but ${providerName} doesn't recognise the model "${modelId}". That's an OpenAdKit catalog problem, not your key — saved anyway. Try another model.` };
  }
  if (status && status >= 500) {
    return { ok: false, authenticated: true, status, modelId, message: `${providerName} returned a server error (${status}). Nothing wrong with your key — saved. Try again shortly.` };
  }
  if (status === 402) {
    return { ok: false, authenticated: true, status, modelId, message: `Key is valid but ${providerName} reports no credit/quota on the account. Saved — top up to use it.` };
  }
  if (status === 400) {
    // Ambiguous: usually a malformed request on our side, but some providers
    // use 400 for auth too (caught above by text). Don't claim the key is good.
    return {
      ok: false,
      authenticated: false,
      status,
      modelId,
      message: `${providerName} rejected the request: ${detail}. The key was NOT saved — double-check it, or try a different model.`,
    };
  }
  if (status) {
    // Unknown status. Honest wording: not rejected outright, but unproven.
    return {
      ok: false,
      authenticated: true,
      status,
      modelId,
      message: `${providerName} returned HTTP ${status}: ${detail}. The key wasn't rejected, so it's saved — confirm by running a generation.`,
    };
  }
  // No status = never reached the provider (offline, DNS, CORS, blocked).
  return { ok: false, authenticated: false, modelId, message: `Couldn't reach ${providerName} — ${detail}. Check your connection; the key wasn't verified.` };
}
