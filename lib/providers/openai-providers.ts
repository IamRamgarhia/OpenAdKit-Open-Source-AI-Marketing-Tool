import { makeOpenAICompatCall, makeOpenAICompatStream, makeOpenAICompatTestKey } from "./openai-compat";
import type { Provider } from "./types";

const openaiCfg = { baseUrl: "https://api.openai.com/v1", testModel: "gpt-4.1-mini" };
const groqCfg = { baseUrl: "https://api.groq.com/openai/v1", testModel: "llama-3.3-70b-versatile" };
const cerebrasCfg = { baseUrl: "https://api.cerebras.ai/v1", testModel: "llama-3.3-70b" };
const togetherCfg = { baseUrl: "https://api.together.xyz/v1", testModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" };
const deepseekCfg = { baseUrl: "https://api.deepseek.com/v1", testModel: "deepseek-chat" };
const mistralCfg = { baseUrl: "https://api.mistral.ai/v1", testModel: "mistral-small-latest" };
const openrouterCfg = {
  baseUrl: "https://openrouter.ai/api/v1",
  testModel: "meta-llama/llama-3.3-70b-instruct:free",
  extraHeaders: { "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://adforge.local", "X-Title": "AdForge" },
};

export const openai: Provider = {
  id: "openai",
  name: "OpenAI",
  category: "paid",
  description: "GPT family. Strongest at structured-output JSON. No free tier — pay-per-use.",
  get_key_url: "https://platform.openai.com/api-keys",
  default_model: "gpt-4.1-mini",
  supports_vision: true,
  models: [
    { id: "gpt-5", label: "GPT-5 — flagship", pricing: { input_per_million_usd: 1.25, output_per_million_usd: 10 }, best_for: "Top-tier reasoning + JSON correctness", supports_vision: true },
    { id: "gpt-5-mini", label: "GPT-5 mini", pricing: { input_per_million_usd: 0.25, output_per_million_usd: 2 }, best_for: "Default cost/quality balance", supports_vision: true },
    { id: "gpt-4.1", label: "GPT-4.1 — proven", pricing: { input_per_million_usd: 2, output_per_million_usd: 8 }, supports_vision: true },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini — cheap fast", pricing: { input_per_million_usd: 0.4, output_per_million_usd: 1.6 }, supports_vision: true },
  ],
  testKey: makeOpenAICompatTestKey(openaiCfg, "openai"),
  call: makeOpenAICompatCall(openaiCfg, "openai"),
  stream: makeOpenAICompatStream(openaiCfg, "openai"),
};

export const groq: Provider = {
  id: "groq",
  name: "Groq",
  category: "free",
  description: "Free tier serving Llama / Mixtral at the fastest tokens-per-second on the market.",
  free_note: "Free tier: ~30 requests/min, ~6,000 tokens/min on Llama 3.3 70B.",
  get_key_url: "https://console.groq.com/keys",
  default_model: "llama-3.3-70b-versatile",
  models: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B — recommended", pricing: { input_per_million_usd: 0.59, output_per_million_usd: 0.79 }, best_for: "Default — generous free tier" },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B — instant", pricing: { input_per_million_usd: 0.05, output_per_million_usd: 0.08 }, best_for: "Hashtags, subjects, short tasks" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", pricing: { input_per_million_usd: 0.24, output_per_million_usd: 0.24 } },
  ],
  testKey: makeOpenAICompatTestKey(groqCfg, "groq"),
  call: makeOpenAICompatCall(groqCfg, "groq"),
  stream: makeOpenAICompatStream(groqCfg, "groq"),
};

export const cerebras: Provider = {
  id: "cerebras",
  name: "Cerebras",
  category: "free",
  description: "Even faster than Groq for Llama 3.3 70B on specialized hardware.",
  free_note: "Free tier: ~30 req/min, ~60k tokens/min on Llama 3.3 70B.",
  get_key_url: "https://cloud.cerebras.ai/",
  default_model: "llama-3.3-70b",
  models: [
    { id: "llama-3.3-70b", label: "Llama 3.3 70B — recommended", pricing: { input_per_million_usd: 0.85, output_per_million_usd: 1.2 }, best_for: "Default — fastest tokens/sec" },
    { id: "llama-3.1-8b", label: "Llama 3.1 8B", pricing: { input_per_million_usd: 0.1, output_per_million_usd: 0.1 } },
  ],
  testKey: makeOpenAICompatTestKey(cerebrasCfg, "cerebras"),
  call: makeOpenAICompatCall(cerebrasCfg, "cerebras"),
  stream: makeOpenAICompatStream(cerebrasCfg, "cerebras"),
};

export const openrouter: Provider = {
  id: "openrouter",
  name: "OpenRouter",
  category: "freemium",
  description: "One key → access to many models including FREE community models. Best for trying multiple models without multiple keys.",
  free_note: "Models tagged ':free' (Llama, Mistral, Qwen, DeepSeek) have generous free quotas.",
  get_key_url: "https://openrouter.ai/keys",
  default_model: "meta-llama/llama-3.3-70b-instruct:free",
  supports_vision: true,
  models: [
    { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B — FREE", pricing: { input_per_million_usd: 0, output_per_million_usd: 0 }, best_for: "Free default" },
    { id: "deepseek/deepseek-chat-v3:free", label: "DeepSeek V3 — FREE", pricing: { input_per_million_usd: 0, output_per_million_usd: 0 } },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", pricing: { input_per_million_usd: 0.3, output_per_million_usd: 2.5 }, supports_vision: true },
    { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", pricing: { input_per_million_usd: 3, output_per_million_usd: 15 }, supports_vision: true },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", pricing: { input_per_million_usd: 0.4, output_per_million_usd: 1.6 }, supports_vision: true },
  ],
  testKey: makeOpenAICompatTestKey(openrouterCfg, "openrouter"),
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
  default_model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  models: [
    { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", pricing: { input_per_million_usd: 0.88, output_per_million_usd: 0.88 } },
    { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", pricing: { input_per_million_usd: 1.25, output_per_million_usd: 1.25 } },
  ],
  testKey: makeOpenAICompatTestKey(togetherCfg, "together"),
  call: makeOpenAICompatCall(togetherCfg, "together"),
  stream: makeOpenAICompatStream(togetherCfg, "together"),
};

export const deepseek: Provider = {
  id: "deepseek",
  name: "DeepSeek",
  category: "paid",
  description: "Cheapest serious reasoning model out there. Pay-per-use, no free tier.",
  get_key_url: "https://platform.deepseek.com/api_keys",
  default_model: "deepseek-chat",
  models: [
    { id: "deepseek-chat", label: "DeepSeek V3", pricing: { input_per_million_usd: 0.27, output_per_million_usd: 1.1 }, best_for: "Cheap, strong at JSON" },
    { id: "deepseek-reasoner", label: "DeepSeek R1 (reasoner)", pricing: { input_per_million_usd: 0.55, output_per_million_usd: 2.19 } },
  ],
  testKey: makeOpenAICompatTestKey(deepseekCfg, "deepseek"),
  call: makeOpenAICompatCall(deepseekCfg, "deepseek"),
  stream: makeOpenAICompatStream(deepseekCfg, "deepseek"),
};

export const mistral: Provider = {
  id: "mistral",
  name: "Mistral",
  category: "paid",
  description: "European AI lab. Strong at multilingual + JSON output. No free tier, but inexpensive.",
  get_key_url: "https://console.mistral.ai/api-keys/",
  default_model: "mistral-large-latest",
  models: [
    { id: "mistral-large-latest", label: "Mistral Large — flagship", pricing: { input_per_million_usd: 2, output_per_million_usd: 6 } },
    { id: "mistral-small-latest", label: "Mistral Small — cheap fast", pricing: { input_per_million_usd: 0.2, output_per_million_usd: 0.6 } },
  ],
  testKey: makeOpenAICompatTestKey(mistralCfg, "mistral"),
  call: makeOpenAICompatCall(mistralCfg, "mistral"),
  stream: makeOpenAICompatStream(mistralCfg, "mistral"),
};
