/**
 * Node-side runtime for the OpenAdKit MCP server: which AI provider to use,
 * where the user's saved brands live, and how a tool call is executed.
 *
 * Two modes, chosen per call:
 *   - "generate": a provider key is configured (env var) → OpenAdKit calls the
 *     provider itself, validates the JSON against the tool's schema, retries
 *     once with the validation errors, and returns the validated result.
 *   - "prompt": no key (or mode:"prompt" requested) → returns the exact system
 *     prompt, user prompt and JSON Schema so the host model (e.g. Claude in
 *     Claude Desktop) writes the result itself, then checks it with the
 *     validate_output tool. No key, no cost beyond the host's own usage.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { PROVIDER_BY_ID, getProvider, findModel, estimateCostUsd, tryParseJson } from "../lib/providers";
import type { LLMMessage, LLMUsage, Provider } from "../lib/providers/types";
import { buildBrandSystemPrompt, normalizeBrandBrain, type BrandBrain } from "../lib/brand-brain";
import { stripNulls } from "../lib/schemas/tolerant";
import type { AiTool } from "../lib/tools/registry";
import { limitViolations } from "../lib/tools/limits";

/** Env vars checked, in order, when OPENADKIT_PROVIDER is not set. */
export const KEY_ENV: { provider: string; vars: string[] }[] = [
  { provider: "anthropic", vars: ["ANTHROPIC_API_KEY"] },
  { provider: "openai", vars: ["OPENAI_API_KEY"] },
  { provider: "google", vars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"] },
  { provider: "groq", vars: ["GROQ_API_KEY"] },
  { provider: "cerebras", vars: ["CEREBRAS_API_KEY"] },
  { provider: "openrouter", vars: ["OPENROUTER_API_KEY"] },
  { provider: "together", vars: ["TOGETHER_API_KEY"] },
  { provider: "deepseek", vars: ["DEEPSEEK_API_KEY"] },
  { provider: "mistral", vars: ["MISTRAL_API_KEY"] },
];

export interface ResolvedProvider {
  provider: Provider;
  apiKey: string;
  model: string;
}

/** Pick the provider + key from the environment, or null for prompt mode. */
export function resolveProvider(env: NodeJS.ProcessEnv = process.env): ResolvedProvider | null {
  const wanted = env.OPENADKIT_PROVIDER?.trim().toLowerCase();
  const order = wanted ? KEY_ENV.filter((k) => k.provider === wanted) : KEY_ENV;
  if (wanted && !order.length) {
    throw new Error(
      `OPENADKIT_PROVIDER="${wanted}" is not a known provider. Use one of: ${Object.keys(PROVIDER_BY_ID).join(", ")}.`,
    );
  }
  for (const k of order) {
    const key = k.vars.map((v) => env[v]?.trim()).find(Boolean);
    if (!key) continue;
    const provider = getProvider(k.provider);
    if (!provider) continue;
    const model = env.OPENADKIT_MODEL?.trim() || provider.default_model;
    return { provider, apiKey: key, model };
  }
  return null;
}

/** Same folder the local-sync sidecar writes snapshot.json to. */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.OPENADKIT_DATA_DIR || env.ADFORGE_DATA_DIR;
  if (override) return override;
  const home = os.homedir();
  if (process.platform === "win32") return path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "OpenAdKit");
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "OpenAdKit");
  return path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "openadkit");
}

export interface Snapshot {
  exported_at?: number;
  brains?: unknown[];
  ads?: unknown[];
  campaigns?: unknown[];
  tombstones?: { table?: string; id?: string }[];
}

/** Read the snapshot the web app syncs to disk. Missing file → empty. */
export function readSnapshot(env: NodeJS.ProcessEnv = process.env): { path: string; snapshot: Snapshot | null } {
  const file = path.join(dataDir(env), "snapshot.json");
  try {
    return { path: file, snapshot: JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot };
  } catch {
    return { path: file, snapshot: null };
  }
}

/** Saved client brands (soft-deleted and tombstoned ones excluded). */
export function listBrands(env: NodeJS.ProcessEnv = process.env): BrandBrain[] {
  const { snapshot } = readSnapshot(env);
  if (!snapshot?.brains) return [];
  const dead = new Set(
    (snapshot.tombstones ?? []).filter((t) => !t.table || t.table === "brains").map((t) => String(t.id)),
  );
  return snapshot.brains
    .filter((b) => b && typeof b === "object" && !(b as { deleted_at?: unknown }).deleted_at)
    .map((b) => normalizeBrandBrain(b))
    .filter((b) => !dead.has(b.id));
}

export function findBrand(idOrName: string, env: NodeJS.ProcessEnv = process.env): BrandBrain | null {
  const needle = idOrName.trim().toLowerCase();
  const all = listBrands(env);
  return (
    all.find((b) => b.id === idOrName) ??
    all.find((b) => (b.business_name || "").toLowerCase() === needle) ??
    all.find((b) => (b.name || "").toLowerCase() === needle) ??
    null
  );
}

export interface RunOptions {
  brand?: BrandBrain | null;
  language?: string;
  toneOverride?: string;
}

export function buildMessages(tool: AiTool, input: Record<string, unknown>, opts: RunOptions) {
  const system = buildBrandSystemPrompt(opts.brand ?? null, {
    language: opts.language,
    tone_override: opts.toneOverride,
    skip_framework_stack: tool.skipFrameworkStack,
  });
  const prompt = tool.buildPrompt(input);
  return { system, prompt };
}

/** JSON Schema of what the tool must return (for prompt mode). */
export function outputJsonSchema(tool: AiTool): unknown {
  try {
    return z.toJSONSchema(tool.schema, { io: "input", unrepresentable: "any" });
  } catch {
    return null;
  }
}

export type ValidationResult =
  | { ok: true; data: unknown }
  | { ok: false; issues: string[] };

/** Parse (string or object) and validate against the tool's schema. */
export function validateOutput(tool: AiTool, raw: unknown): ValidationResult {
  const value = typeof raw === "string" ? tryParseJson(raw) : raw;
  if (value === null || value === undefined) {
    return { ok: false, issues: ["Not valid JSON. Return only the JSON value, without prose or code fences."] };
  }
  const parsed = tool.schema.safeParse(stripNulls(value));
  if (parsed.success) {
    // Valid shape, but the ad platforms also enforce character limits.
    const over = limitViolations(tool.name, parsed.data);
    if (!over.length) return { ok: true, data: parsed.data };
    return {
      ok: false,
      issues: over
        .slice(0, 12)
        .map((v) => `${v.path}: ${v.label} — "${v.text}" is ${v.length} characters. Shorten it to ${v.max} or fewer, or add a trimmed_alt that fits.`),
    };
  }
  return {
    ok: false,
    issues: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`),
  };
}

export interface GenerateResult {
  data: unknown;
  provider: string;
  model: string;
  attempts: number;
  usage: LLMUsage;
  cost_usd: number | null;
}

/** Call the provider, validate, retry once with the validation errors. */
export async function generate(
  tool: AiTool,
  input: Record<string, unknown>,
  resolved: ResolvedProvider,
  opts: RunOptions,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const { system, prompt } = buildMessages(tool, input, opts);
  const messages: LLMMessage[] = [{ role: "user", content: prompt }];
  const usage: LLMUsage = { input_tokens: 0, output_tokens: 0 };
  let lastIssues: string[] = [];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await resolved.provider.call({
      apiKey: resolved.apiKey,
      model: resolved.model,
      system,
      messages,
      maxTokens: tool.maxTokens,
      temperature: attempt === 1 ? tool.temperature : 0.2,
      cacheSystem: true,
      signal,
    });
    if (res.usage) {
      usage.input_tokens += res.usage.input_tokens;
      usage.output_tokens += res.usage.output_tokens;
    }
    const check = validateOutput(tool, res.text);
    if (check.ok) {
      const model = findModel(resolved.provider.id, res.modelId || resolved.model);
      return {
        data: check.data,
        provider: resolved.provider.id,
        model: res.modelId || resolved.model,
        attempts: attempt,
        usage,
        cost_usd: model ? estimateCostUsd(resolved.provider.id, res.modelId || resolved.model, usage) : null,
      };
    }
    lastIssues = check.issues;
    if (attempt < maxAttempts) {
      const hint =
        "Your previous reply did not match the required JSON shape. Fix these issues and return ONLY the corrected JSON:\n" +
        check.issues.map((i) => `- ${i}`).join("\n");
      if (res.text.trim()) {
        messages.push({ role: "assistant", content: res.text.slice(0, 8000) });
        messages.push({ role: "user", content: hint });
      } else {
        messages[0] = { role: "user", content: `${prompt}\n\nYour previous reply was empty. ${hint}` };
      }
    }
  }
  throw new Error(
    `The model's reply did not match ${tool.name}'s output shape after ${maxAttempts} attempts:\n` +
      lastIssues.map((i) => `- ${i}`).join("\n"),
  );
}
