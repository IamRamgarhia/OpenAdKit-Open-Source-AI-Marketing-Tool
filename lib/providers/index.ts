import { anthropic } from "./anthropic";
import { google } from "./google";
import { openai, groq, cerebras, openrouter, together, deepseek, mistral } from "./openai-providers";
import type { Provider, ProviderId } from "./types";

export const PROVIDERS: Provider[] = [
  // Free tier featured first
  groq,
  cerebras,
  openrouter,
  google,
  // Freemium
  together,
  // Paid premium
  anthropic,
  openai,
  deepseek,
  mistral,
];

export const PROVIDER_BY_ID: Record<string, Provider> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p])
);

export function getProvider(id: string | null | undefined): Provider | null {
  if (!id) return null;
  return PROVIDER_BY_ID[id] ?? null;
}

export function findModel(providerId: string | null, modelId: string | null) {
  const p = getProvider(providerId);
  if (!p || !modelId) return null;
  return p.models.find((m) => m.id === modelId) ?? null;
}

export function estimateCostUsd(providerId: string, modelId: string, usage: { input_tokens?: number; output_tokens?: number } | null): number {
  if (!usage) return 0;
  const m = findModel(providerId, modelId);
  if (!m) return 0;
  return (
    ((usage.input_tokens ?? 0) * m.pricing.input_per_million_usd +
      (usage.output_tokens ?? 0) * m.pricing.output_per_million_usd) /
    1_000_000
  );
}

export function tryParseJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1)) as T;
      } catch {}
    }
    // Top-level array fallback: recover when the payload is a JSON array
    // wrapped in prose (e.g. a bare list of hashtags/subjects).
    const firstArr = candidate.indexOf("[");
    const lastArr = candidate.lastIndexOf("]");
    if (firstArr >= 0 && lastArr > firstArr) {
      try {
        return JSON.parse(candidate.slice(firstArr, lastArr + 1)) as T;
      } catch {}
    }
    return null;
  }
}

export type { Provider, ProviderId, ModelDef, LLMCallOptions, LLMResult, LLMUsage, LLMMessage, StreamHandlers } from "./types";
export { LLMError } from "./types";
