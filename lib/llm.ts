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
}

function resolve(opts: RunOptions): { provider: Provider; apiKey: string; model: string } {
  const provider = opts.providerOverride ?? getActiveProvider();
  if (!provider) throw new LLMError("No active provider configured. Pick one in /setup or /settings.", undefined, "ados");
  const apiKey = opts.apiKeyOverride ?? getProviderKey(provider.id);
  if (!apiKey) throw new LLMError(`No API key for ${provider.name}. Add one in /settings.`, undefined, provider.id);
  const model = opts.modelOverride ?? getActiveModelId(provider.id) ?? provider.default_model;
  return { provider, apiKey, model };
}

export async function llmCall(opts: RunOptions): Promise<LLMResult & { providerId: string }> {
  const { provider, apiKey, model } = resolve(opts);
  const res = await provider.call({
    apiKey,
    model,
    system: opts.system,
    messages: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    signal: opts.signal,
  });
  return { ...res, providerId: provider.id };
}

export async function llmStream(opts: RunOptions, handlers: StreamHandlers): Promise<LLMResult & { providerId: string }> {
  const { provider, apiKey, model } = resolve(opts);
  const res = await provider.stream(
    {
      apiKey,
      model,
      system: opts.system,
      messages: opts.messages,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      signal: opts.signal,
    },
    handlers
  );
  return { ...res, providerId: provider.id };
}

export function estimateCostUsd(
  providerIdOrModelId: string,
  modelIdOrUsage: string | { input_tokens?: number; output_tokens?: number } | null,
  usage?: { input_tokens?: number; output_tokens?: number } | null
): number {
  // New signature: (providerId, modelId, usage)
  if (typeof modelIdOrUsage === "string") {
    return _estimateCostUsd(providerIdOrModelId, modelIdOrUsage, usage ?? null);
  }
  // Legacy signature: (modelId, usage) — infer provider from the active one.
  const pid = getActiveProviderId() ?? "";
  return _estimateCostUsd(pid, providerIdOrModelId, modelIdOrUsage);
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

export async function testApiKey(apiKey: string, providerId?: string): Promise<boolean> {
  const provider = providerId ? getProvider(providerId) : getActiveProvider();
  if (!provider) return false;
  return provider.testKey(apiKey);
}
