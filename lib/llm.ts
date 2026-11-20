import {
  getProvider,
  tryParseJson as _tryParseJson,
  estimateCostUsd as _estimateCostUsd,
  type LLMCallOptions,
  type LLMMessage,
  type LLMResult,
  type StreamHandlers,
  type Provider,
} from "./providers";
import { LLMError } from "./providers";
import { getActiveProviderId, getActiveModelId, getProviderKey } from "./settings";

export { LLMError } from "./providers";
export type { LLMCallOptions, LLMResult, LLMUsage, LLMMessage, StreamHandlers } from "./providers";
import type { KeyCheckResult } from "./providers/types";
export type { KeyCheckResult } from "./providers/types";

export function getActiveProvider(): Provider | null {
  const id = getActiveProviderId();
  return getProvider(id);
}

interface RunOptions {
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Override the resolved provider (for things like onboarding key tests) */
  providerOverride?: Provider;
  modelOverride?: string;
  apiKeyOverride?: string;
  /**
   * Request system-prompt prefix caching. Defaults to true: OpenAdKit's system
   * prompt is the brand brain + framework stack, which is byte-identical across
   * every generation for a given brand — an ideal (and large) cache prefix.
   * Providers without caching support ignore it.
   */
  cacheSystem?: boolean;
}

function resolve(opts: RunOptions): { provider: Provider; apiKey: string; model: string } {
  const provider = opts.providerOverride ?? getActiveProvider();
  if (!provider) throw new LLMError("No active provider configured. Pick one in /setup or /settings.", undefined, "openadkit");
  const apiKey = opts.apiKeyOverride ?? getProviderKey(provider.id);
  if (!apiKey) throw new LLMError(`No API key for ${provider.name}. Add one in /settings.`, undefined, provider.id);
  const model = opts.modelOverride ?? getActiveModelId(provider.id) ?? provider.default_model;
  return { provider, apiKey, model };
}

import { recordRequest, recordFailedAttempt } from "./quota-tracker";
import { assertWithinBudget } from "./budget";

/** Did this failure come back FROM the provider (so it consumed quota)? HTTP
 *  errors (incl. 429) and truncated/refused completions did; network errors and
 *  aborts never reached it. */
function reachedProvider(err: unknown): boolean {
  return err instanceof LLMError && (err.status !== undefined || err.code !== undefined);
}

/**
 * Every LLM request in the app funnels through llmCall / llmStream, so the
 * monthly-budget hard stop is enforced HERE rather than at each UI entry point
 * (several callers never checked it). Throws BudgetExceededError — the type the
 * UI already renders — only when the user enabled the hard stop.
 */
async function guard<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
  await assertWithinBudget();
  try {
    const res = await fn();
    recordRequest(providerId);
    return res;
  } catch (err) {
    if (reachedProvider(err)) recordFailedAttempt(providerId);
    throw err;
  }
}

export async function llmCall(opts: RunOptions): Promise<LLMResult & { providerId: string }> {
  const { provider, apiKey, model } = resolve(opts);
  const res = await guard(provider.id, () =>
    provider.call({
      apiKey,
      model,
      system: opts.system,
      messages: opts.messages,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      signal: opts.signal,
      cacheSystem: opts.cacheSystem ?? true,
    })
  );
  return { ...res, providerId: provider.id };
}

export async function llmStream(opts: RunOptions, handlers: StreamHandlers): Promise<LLMResult & { providerId: string }> {
  const { provider, apiKey, model } = resolve(opts);
  const res = await guard(provider.id, () =>
    provider.stream(
      {
        apiKey,
        model,
        system: opts.system,
        messages: opts.messages,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        signal: opts.signal,
        cacheSystem: opts.cacheSystem ?? true,
      },
      handlers
    )
  );
  return { ...res, providerId: provider.id };
}

export function estimateCostUsd(
  providerIdOrModelId: string | undefined,
  modelIdOrUsage: string | { input_tokens?: number; output_tokens?: number } | null,
  usage?: { input_tokens?: number; output_tokens?: number } | null
): number {
  // New signature: (providerId, modelId, usage). If providerId is undefined (some
  // legacy shims drop it), fall back to the active provider rather than throwing.
  if (typeof modelIdOrUsage === "string") {
    const pid = providerIdOrModelId || getActiveProviderId() || "";
    return _estimateCostUsd(pid, modelIdOrUsage, usage ?? null);
  }
  // Legacy signature: (modelId, usage) — infer provider from the active one.
  const pid = getActiveProviderId() ?? "";
  return _estimateCostUsd(pid, providerIdOrModelId ?? "", modelIdOrUsage);
}

export function tryParseJson<T = unknown>(text: string): T | null {
  return _tryParseJson<T>(text);
}

// Backward-compatibility shims so old callers still work while we migrate.
export const ClaudeError = LLMError;
export type ClaudeMessage = { role: "user" | "assistant"; content: string };
export type ClaudeUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
export type ClaudeResult = LLMResult & { providerId?: string };

interface LegacyOpts {
  apiKey: string;
  model?: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export async function callClaude(opts: LegacyOpts): Promise<ClaudeResult> {
  return llmCall({
    system: opts.system,
    messages: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    signal: opts.signal,
    apiKeyOverride: opts.apiKey,
    modelOverride: opts.model,
  });
}

export async function streamClaude(opts: LegacyOpts, handlers: StreamHandlers = {}): Promise<ClaudeResult> {
  return llmStream(
    {
      system: opts.system,
      messages: opts.messages,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      signal: opts.signal,
      apiKeyOverride: opts.apiKey,
      modelOverride: opts.model,
    },
    handlers
  );
}

/**
 * Verify a key against the provider and return WHY it failed, not just whether.
 *
 * Prefer this over testApiKey(). The boolean version cannot distinguish "wrong
 * key" from "rate limited" / "provider down" / "our catalog names a dead
 * model" — and treating all of those as "invalid key" leads users to delete
 * keys that work.
 */
export async function verifyApiKey(apiKey: string, providerId?: string): Promise<KeyCheckResult> {
  const provider = providerId ? getProvider(providerId) : getActiveProvider();
  if (!provider) {
    return { ok: false, authenticated: false, message: "No provider selected." };
  }
  if (!apiKey.trim()) {
    return { ok: false, authenticated: false, message: "Paste a key first." };
  }
  return provider.testKey(apiKey);
}

/** @deprecated Boolean shim for legacy callers — use verifyApiKey() so the
 *  reason for a failure survives. */
export async function testApiKey(apiKey: string, providerId?: string): Promise<boolean> {
  const res = await verifyApiKey(apiKey, providerId);
  return res.ok;
}
