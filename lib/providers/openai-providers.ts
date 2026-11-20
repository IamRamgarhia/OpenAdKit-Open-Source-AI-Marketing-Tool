import { makeOpenAICompatCall, makeOpenAICompatStream, makeOpenAICompatTestKey } from "./openai-compat";
import type { Provider } from "./types";

/**
 * MODEL CATALOGS — verified against each provider's own docs on 2026-08-01.
 *
 * Every catalog here except Anthropic's had drifted, and two providers were
 * completely unusable because the model used for BOTH `default_model` and
 * `testModel` had been decommissioned:
 *
 *   - Cerebras shipped `llama-3.3-70b`; Cerebras now serves gpt-oss / gemma-4 /
 *     glm. "Save + Verify" called a dead model, so it rejected VALID keys —
 *     there was no way to add a Cerebras key at all.
 *   - OpenRouter shipped `meta-llama/llama-3.3-70b-instruct:free`, which has
 *     been withdrawn from OpenRouter's catalog. Same failure.
 *
 * `testModel` must therefore be a cheap model the provider definitely still
 * serves — it is the gate on the entire onboarding flow.
 */

/** Reasoning tokens are billed and counted against max_completion_tokens, so a
 *  3k cap on a reasoning model can be spent entirely on reasoning and return an
 *  empty / cut-off reply. Leave room on top of the requested answer size. */
const OPENAI_REASONING_HEADROOM = 4096;

// gpt-5 / o-series reject `max_tokens` (require `max_completion_tokens`) and reject
// non-default `temperature` with HTTP 400. They also reason before answering:
// ask for "low" effort (accepted by every gpt-5.x and o-series model) and leave
// headroom so the reasoning can't eat the answer.
export function openaiBodyTransform(body: any) {
  if (/^(gpt-5|o\d)/i.test(body.model)) {
    if ("max_tokens" in body) {
      body.max_completion_tokens = body.max_tokens + OPENAI_REASONING_HEADROOM;
      delete body.max_tokens;
    }
    delete body.temperature;
    if (!body.reasoning_effort) body.reasoning_effort = "low";
  }
  return body;
}

const openaiCfg = {
  baseUrl: "https://api.openai.com/v1",
  testModel: "gpt-5.6-luna",
  bodyTransform: openaiBodyTransform,
};
const groqCfg = { baseUrl: "https://api.groq.com/openai/v1", testModel: "llama-3.1-8b-instant" };
// Cerebras silently ignores `stream_options` — leaving it on returns null usage. (Audit #24.)
const cerebrasCfg = { baseUrl: "https://api.cerebras.ai/v1", testModel: "gpt-oss-120b", supportsStreamUsage: false };
// Together has reported inconsistent acceptance — safer to omit. (Audit #7.)
const togetherCfg = { baseUrl: "https://api.together.xyz/v1", testModel: "openai/gpt-oss-20b", supportsStreamUsage: false };
// DeepSeek V4 supports a thinking mode; 2K default truncates mid-thought. (Audit #60.)
const deepseekCfg = { baseUrl: "https://api.deepseek.com/v1", testModel: "deepseek-v4-flash", defaultMaxTokens: 8192 };
// Mistral returns HTTP 422 on `stream_options.include_usage`. (Audit #7.)
const mistralCfg = { baseUrl: "https://api.mistral.ai/v1", testModel: "mistral-small-4-0-26-03", supportsStreamUsage: false };
const openrouterCfg = {
  baseUrl: "https://openrouter.ai/api/v1",
  testModel: "google/gemma-4-31b-it:free",
  extraHeaders: { "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://openadkit.local", "X-Title": "OpenAdKit" },
};

export const openai: Provider = {
  id: "openai",
  name: "OpenAI",
  category: "paid",
  description: "GPT family. Strongest at structured-output JSON. No free tier — pay-per-use.",
  get_key_url: "https://platform.openai.com/api-keys",
  default_model: "gpt-5.6-terra",
  supports_vision: true,
  models: [
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol — flagship", pricing: { input_per_million_usd: 5, output_per_million_usd: 30 }, best_for: "Hardest reasoning + JSON correctness", supports_vision: true },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra — balanced (recommended)", pricing: { input_per_million_usd: 2, output_per_million_usd: 12 }, best_for: "Default for ad copy + optimization", supports_vision: true },
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna — cheap + fast", pricing: { input_per_million_usd: 0.2, output_per_million_usd: 1.2 }, best_for: "High-volume hashtags / subject lines", supports_vision: true },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", pricing: { input_per_million_usd: 0.75, output_per_million_usd: 4.5 }, supports_vision: true },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini (legacy)", pricing: { input_per_million_usd: 0.4, output_per_million_usd: 1.6 }, supports_vision: true },
  ],
  testKey: makeOpenAICompatTestKey(openaiCfg, "openai", "OpenAI"),
  call: makeOpenAICompatCall(openaiCfg, "openai"),
  stream: makeOpenAICompatStream(openaiCfg, "openai"),
};

export const groq: Provider = {
  id: "groq",
  name: "Groq",
  category: "free",
  description: "Free tier serving Llama / Mixtral at the fastest tokens-per-second on the market.",
  free_note: "Free tier: ~30 requests/min, ~6,000 tokens/min. Plenty for everyday use.",
  get_key_url: "https://console.groq.com/keys",
  default_model: "openai/gpt-oss-120b",
  models: [
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B — recommended", pricing: { input_per_million_usd: 0.15, output_per_million_usd: 0.6 }, best_for: "Default — stronger AND cheaper than Llama 3.3 70B" },
    { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B — fastest", pricing: { input_per_million_usd: 0.075, output_per_million_usd: 0.3 }, best_for: "Hashtags, subjects, short tasks" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", pricing: { input_per_million_usd: 0.59, output_per_million_usd: 0.79 } },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B — instant", pricing: { input_per_million_usd: 0.05, output_per_million_usd: 0.08 } },
    // `mixtral-8x7b-32768` removed — decommissioned by Groq; it 404'd on use.
  ],
  testKey: makeOpenAICompatTestKey(groqCfg, "groq", "Groq"),
  call: makeOpenAICompatCall(groqCfg, "groq"),
  stream: makeOpenAICompatStream(groqCfg, "groq"),
};

export const cerebras: Provider = {
  id: "cerebras",
  name: "Cerebras",
  category: "free",
  description: "Fastest tokens-per-second on the market, on specialized hardware.",
  free_note: "Free tier available; rate-limited but usable for everyday generation.",
  get_key_url: "https://cloud.cerebras.ai/",
  // Was `llama-3.3-70b` — Cerebras no longer serves any Llama model, so both
  // the default AND the key-verification call 404'd. The provider was
  // impossible to configure.
  default_model: "gpt-oss-120b",
  models: [
    // Pricing mirrors the published gpt-oss rate other hosts quote; Cerebras
    // does not publish a per-model table, so treat these as approximate.
    { id: "gpt-oss-120b", label: "GPT-OSS 120B — recommended", pricing: { input_per_million_usd: 0.15, output_per_million_usd: 0.6 }, best_for: "Default — fastest tokens/sec" },
    { id: "gemma-4-31b", label: "Gemma 4 31B (preview)", pricing: { input_per_million_usd: 0.1, output_per_million_usd: 0.34 } },
  ],
  testKey: makeOpenAICompatTestKey(cerebrasCfg, "cerebras", "Cerebras"),
  call: makeOpenAICompatCall(cerebrasCfg, "cerebras"),
  stream: makeOpenAICompatStream(cerebrasCfg, "cerebras"),
};

export const openrouter: Provider = {
  id: "openrouter",
  name: "OpenRouter",
  category: "freemium",
  description: "One key → access to many models including FREE community models. Best for trying multiple models without multiple keys.",
  free_note: "Models tagged ':free' have generous free quotas — the fastest way to run OpenAdKit at $0.",
  get_key_url: "https://openrouter.ai/keys",
  // Was `meta-llama/llama-3.3-70b-instruct:free`, withdrawn from OpenRouter's
  // catalog — it took the key-verification call down with it.
  default_model: "google/gemma-4-31b-it:free",
  supports_vision: true,
  models: [
    { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B — FREE", pricing: { input_per_million_usd: 0, output_per_million_usd: 0 }, best_for: "Free default" },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B — FREE", pricing: { input_per_million_usd: 0, output_per_million_usd: 0 } },
    { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash", pricing: { input_per_million_usd: 1.5, output_per_million_usd: 7.5 }, supports_vision: true },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", pricing: { input_per_million_usd: 2, output_per_million_usd: 10 }, supports_vision: true },
    { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", pricing: { input_per_million_usd: 0.1, output_per_million_usd: 0.6 }, supports_vision: true },
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B — cheap", pricing: { input_per_million_usd: 0.04, output_per_million_usd: 0.17 } },
  ],
  testKey: makeOpenAICompatTestKey(openrouterCfg, "openrouter", "OpenRouter"),
  call: makeOpenAICompatCall(openrouterCfg, "openrouter"),
  stream: makeOpenAICompatStream(openrouterCfg, "openrouter"),
};

export const together: Provider = {
  id: "together",
  name: "Together AI",
  category: "freemium",
  description: "Hosts hundreds of open-source models. Pay-per-use; some free models available.",
  free_note: "Some models have free quotas via the dashboard. Most are pay-per-use at cheap rates.",
  get_key_url: "https://api.together.ai/settings/api-keys",
  default_model: "openai/gpt-oss-120b",
  models: [
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B — recommended", pricing: { input_per_million_usd: 0.15, output_per_million_usd: 0.6 }, best_for: "Default — best value here" },
    { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B — cheapest", pricing: { input_per_million_usd: 0.05, output_per_million_usd: 0.2 } },
    { id: "Qwen/Qwen3.7-Plus", label: "Qwen 3.7 Plus", pricing: { input_per_million_usd: 0.32, output_per_million_usd: 1.28 } },
    { id: "deepseek-ai/DeepSeek-V4-Pro", label: "DeepSeek V4 Pro", pricing: { input_per_million_usd: 1.74, output_per_million_usd: 3.48 } },
    { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo (legacy)", pricing: { input_per_million_usd: 1.04, output_per_million_usd: 1.04 } },
  ],
  testKey: makeOpenAICompatTestKey(togetherCfg, "together", "Together AI"),
  call: makeOpenAICompatCall(togetherCfg, "together"),
  stream: makeOpenAICompatStream(togetherCfg, "together"),
};

export const deepseek: Provider = {
  id: "deepseek",
  name: "DeepSeek",
  category: "paid",
  description: "Cheapest serious reasoning model out there. Pay-per-use, no free tier.",
  get_key_url: "https://platform.deepseek.com/api_keys",
  default_model: "deepseek-v4-flash",
  models: [
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash — recommended", pricing: { input_per_million_usd: 0.14, output_per_million_usd: 0.28 }, context_k: 1000, best_for: "Cheap, strong at JSON" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro — strongest", pricing: { input_per_million_usd: 0.435, output_per_million_usd: 0.87 }, context_k: 1000 },
  ],
  testKey: makeOpenAICompatTestKey(deepseekCfg, "deepseek", "DeepSeek"),
  call: makeOpenAICompatCall(deepseekCfg, "deepseek"),
  stream: makeOpenAICompatStream(deepseekCfg, "deepseek"),
};

export const mistral: Provider = {
  id: "mistral",
  name: "Mistral",
  category: "paid",
  description: "European AI lab. Strong at multilingual + JSON output. No free tier, but inexpensive.",
  get_key_url: "https://console.mistral.ai/api-keys/",
  // Explicit dated IDs rather than the `-latest` aliases: Mistral's current
  // model list publishes these, and a silently-repointed alias would change
  // both behaviour and cost under the user without warning.
  default_model: "mistral-medium-3-5-26-04",
  models: [
    { id: "mistral-medium-3-5-26-04", label: "Mistral Medium 3.5 — recommended", pricing: { input_per_million_usd: 1.5, output_per_million_usd: 7.5 }, best_for: "Default balance" },
    { id: "mistral-large-3-25-12", label: "Mistral Large 3 — flagship", pricing: { input_per_million_usd: 2, output_per_million_usd: 6 } },
    { id: "mistral-small-4-0-26-03", label: "Mistral Small 4 — cheap fast", pricing: { input_per_million_usd: 0.15, output_per_million_usd: 0.6 } },
    { id: "ministral-3-8b-25-12", label: "Ministral 3 8B — cheapest", pricing: { input_per_million_usd: 0.15, output_per_million_usd: 0.15 } },
  ],
  testKey: makeOpenAICompatTestKey(mistralCfg, "mistral", "Mistral"),
  call: makeOpenAICompatCall(mistralCfg, "mistral"),
  stream: makeOpenAICompatStream(mistralCfg, "mistral"),
};
