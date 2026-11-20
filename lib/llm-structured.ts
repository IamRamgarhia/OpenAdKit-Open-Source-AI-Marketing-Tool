/**
 * Schema-validated LLM output.
 *
 * Why this exists: every generator today calls `llmCall` then `tryParseJson`
 * then blindly trusts whatever shape comes back. When a provider returns
 * malformed JSON (Gemini is the worst offender), or returns a string where the
 * UI expects an array, the UI either crashes or silently shows wrong data. The
 * user's #1 complaint: "no false results."
 *
 * This helper wraps a single llmCall with:
 *  1. A Zod schema that defines the expected shape.
 *  2. Tolerant JSON extraction (already in tryParseJson).
 *  3. Schema validation.
 *  4. One automatic retry: if the parse fails, we re-prompt the SAME provider
 *     with the validation errors and ask it to fix the JSON. Costs one extra
 *     LLM round-trip but eliminates almost all "model returned wrong shape"
 *     failures.
 *
 * If both attempts fail, throws a typed StructuredLlmError so the caller can
 * surface a useful message (instead of a generic "JSON parse error" or — worse
 * — rendering undefined.map() and crashing the page).
 */
import { z, type ZodTypeAny } from "zod";
import { llmCall } from "@/lib/llm";
import { tryParseJson, estimateCostUsd } from "@/lib/providers";
import type { LLMUsage, LLMMessage, Provider } from "@/lib/providers/types";
import { stripNulls } from "@/lib/schemas/tolerant";

// Mirrors lib/llm.ts RunOptions — kept local because that type isn't exported.
interface BaseLlmOpts {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  providerOverride?: Provider;
  modelOverride?: string;
  apiKeyOverride?: string;
}

export class StructuredLlmError extends Error {
  readonly raw: string;
  readonly zodIssues: z.ZodIssue[] | null;
  readonly providerId: string;
  readonly modelId: string;
  readonly attempts: number;
  constructor(opts: {
    message: string;
    raw: string;
    zodIssues: z.ZodIssue[] | null;
    providerId: string;
    modelId: string;
    attempts: number;
  }) {
    super(opts.message);
    this.name = "StructuredLlmError";
    this.raw = opts.raw;
    this.zodIssues = opts.zodIssues;
    this.providerId = opts.providerId;
    this.modelId = opts.modelId;
    this.attempts = opts.attempts;
  }
}

export interface StructuredResult<T> {
  data: T;
  raw: string;
  providerId: string;
  modelId: string;
  usage: LLMUsage | null;
  costUsd: number;
  attempts: number;
  /**
   * True when the first parse failed and we recovered via the retry round-trip.
   * The UI can use this to show a small "AI auto-corrected" badge so the user
   * knows the result is valid but came from a second attempt.
   */
  recovered: boolean;
}

interface StructuredOptions<S extends ZodTypeAny> extends BaseLlmOpts {
  /** The Zod schema the returned JSON must satisfy. */
  schema: S;
  /** Prompt to send. Should already instruct the model to reply with JSON. */
  prompt: string;
  /**
   * Optional system instruction. If omitted, a generic
   * "Reply with ONLY a JSON object matching the schema" line is prepended.
   */
  system?: string;
  /** How many total attempts (initial + retries). Default: 2. Min: 1. Max: 3. */
  maxAttempts?: number;
}

function summarizeIssues(issues: z.ZodIssue[]): string {
  return issues
    .slice(0, 8)
    .map((i) => `- ${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("\n");
}

/** Validate a parsed candidate, treating null-valued keys as absent. Prompts
 *  (and models unprompted) use `null` for "not applicable"; optional Zod fields
 *  reject it, which used to burn a retry on almost every run. */
function safeParseLlm<S extends ZodTypeAny>(schema: S, candidate: unknown) {
  return schema.safeParse(stripNulls(candidate));
}

/**
 * Append the corrective turn. If the previous reply was empty, we must NOT
 * send `{role:"assistant", content:""}` — Anthropic rejects empty assistant
 * content with a 400. Fold the hint into the last user turn instead so roles
 * keep alternating for providers that require it.
 */
function appendCorrection(messages: LLMMessage[], previousReply: string, hint: string): void {
  const prev = previousReply.slice(0, 8000);
  if (prev.trim()) {
    messages.push({ role: "assistant", content: prev });
    messages.push({ role: "user", content: hint });
    return;
  }
  const emptyHint = `Your previous reply was empty. ${hint}`;
  const last = messages[messages.length - 1];
  if (last && last.role === "user") {
    const content =
      typeof last.content === "string"
        ? `${last.content}

${emptyHint}`
        : [...last.content, { type: "text" as const, text: emptyHint }];
    messages[messages.length - 1] = { role: "user", content };
  } else {
    messages.push({ role: "user", content: emptyHint });
  }
}

const JSON_HINT =
  "Reply with ONLY a valid JSON value matching the requested shape. " +
  "No prose, no markdown, no commentary, no code fences. " +
  "If a field is unknown, return an empty string or empty array — never invent data.";

export async function llmCallStructured<S extends ZodTypeAny>(
  opts: StructuredOptions<S>
): Promise<StructuredResult<z.infer<S>>> {
  const maxAttempts = Math.max(1, Math.min(3, opts.maxAttempts ?? 2));
  const system = opts.system ? `${opts.system}\n\n${JSON_HINT}` : JSON_HINT;
  const messages: LLMMessage[] = [{ role: "user", content: opts.prompt }];

  let lastRaw = "";
  let lastIssues: z.ZodIssue[] | null = null;
  let lastProviderId = "";
  let lastModelId = "";
  let totalCost = 0;
  let totalUsage: LLMUsage | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await llmCall({
      system,
      messages,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      signal: opts.signal,
      providerOverride: opts.providerOverride,
      modelOverride: opts.modelOverride,
      apiKeyOverride: opts.apiKeyOverride,
    });
    lastProviderId = res.providerId;
    lastModelId = res.modelId;
    if (res.usage) {
      const prevIn: number = totalUsage ? totalUsage.input_tokens : 0;
      const prevOut: number = totalUsage ? totalUsage.output_tokens : 0;
      const nextUsage: LLMUsage = {
        input_tokens: prevIn + (res.usage.input_tokens ?? 0),
        output_tokens: prevOut + (res.usage.output_tokens ?? 0),
      };
      totalUsage = nextUsage;
    }
    totalCost += estimateCostUsd(res.providerId, res.modelId, res.usage);
    lastRaw = res.text ?? "";

    const candidate = tryParseJson<unknown>(lastRaw);
    if (candidate !== null) {
      const parsed = safeParseLlm(opts.schema, candidate);
      if (parsed.success) {
        return {
          data: parsed.data,
          raw: lastRaw,
          providerId: res.providerId,
          modelId: res.modelId,
          usage: totalUsage,
          costUsd: totalCost,
          attempts: attempt,
          recovered: attempt > 1,
        };
      }
      lastIssues = parsed.error.issues;
    } else {
      lastIssues = null;
    }

    // Build the corrective re-prompt so the next loop iteration self-heals.
    if (attempt < maxAttempts) {
      const fixHint = lastIssues
        ? `Your previous reply did not match the required JSON shape. Fix these issues and return ONLY the corrected JSON:\n\n${summarizeIssues(
            lastIssues
          )}`
        : "Your previous reply was not valid JSON. Return ONLY a valid JSON value matching the requested shape — no prose, no markdown, no code fences.";
      appendCorrection(messages, lastRaw, fixHint);
    }
  }

  throw new StructuredLlmError({
    message: lastIssues
      ? `Model returned a shape that does not match the schema after ${maxAttempts} attempts.`
      : `Model returned non-JSON after ${maxAttempts} attempts.`,
    raw: lastRaw,
    zodIssues: lastIssues,
    providerId: lastProviderId,
    modelId: lastModelId,
    attempts: maxAttempts,
  });
}

/**
 * Lightweight one-shot validator for cases where the caller already has a
 * raw LLM response in hand (e.g. legacy streaming code paths). Returns
 * { ok: true, data } or { ok: false, issues } — never throws.
 */
export function validateLlmJson<S extends ZodTypeAny>(
  raw: string,
  schema: S
): { ok: true; data: z.infer<S> } | { ok: false; issues: z.ZodIssue[] | null; raw: string } {
  const candidate = tryParseJson<unknown>(raw);
  if (candidate === null) return { ok: false, issues: null, raw };
  const parsed = safeParseLlm(schema, candidate);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, issues: parsed.error.issues, raw };
}

/**
 * Helper for non-GeneratorShell pages (suggestions, competitors teardown,
 * BrandBrainForm extraction) that stream the first attempt for UX, then need
 * the same retry-on-schema-fail behavior as the shell. Wraps:
 *  1. validateLlmJson on the streamed response
 *  2. If invalid, one non-streaming corrective round-trip
 *  3. Returns { data, recovered, costUsd, usage } or throws StructuredLlmError
 *
 * Usage:
 *   const streamRes = await llmStream(...)
 *   const v = await validateOrRetry({
 *     schema, raw: streamRes.text || stream.text,
 *     system, originalPrompt,
 *     signal: controller.signal,
 *   });
 *   // v.data is schema-valid; v.recovered tells you if it took a retry.
 */
export async function validateOrRetry<S extends ZodTypeAny>(opts: {
  schema: S;
  raw: string;
  system?: string;
  originalPrompt: string;
  signal?: AbortSignal;
  providerOverride?: Provider;
  modelOverride?: string;
  apiKeyOverride?: string;
  maxTokens?: number;
}): Promise<{
  data: z.infer<S>;
  raw: string;
  recovered: boolean;
  costUsd: number;
  usage: LLMUsage | null;
  providerId: string;
  modelId: string;
}> {
  const first = validateLlmJson(opts.raw, opts.schema);
  if (first.ok) {
    return {
      data: first.data,
      raw: opts.raw,
      recovered: false,
      costUsd: 0,
      usage: null,
      providerId: "",
      modelId: "",
    };
  }
  // Build corrective re-prompt.
  const fixHint = first.issues
    ? `Your previous reply did not match the required JSON shape. Fix these issues and return ONLY the corrected JSON — no prose, no markdown, no code fences:\n\n${summarizeIssues(
        first.issues
      )}`
    : "Your previous reply was not valid JSON. Return ONLY a valid JSON value matching the requested shape — no prose, no markdown, no code fences.";
  const retryMessages: LLMMessage[] = [{ role: "user", content: opts.originalPrompt }];
  appendCorrection(retryMessages, opts.raw || "", fixHint);
  const retry = await llmCall({
    system: opts.system,
    messages: retryMessages,
    maxTokens: opts.maxTokens ?? 3000,
    temperature: 0.2,
    signal: opts.signal,
    providerOverride: opts.providerOverride,
    modelOverride: opts.modelOverride,
    apiKeyOverride: opts.apiKeyOverride,
  });
  const second = validateLlmJson(retry.text ?? "", opts.schema);
  if (!second.ok) {
    throw new StructuredLlmError({
      message: second.issues
        ? "Model returned a shape that does not match the schema after a correction pass."
        : "Model returned non-JSON after a correction pass.",
      raw: retry.text ?? "",
      zodIssues: second.issues,
      providerId: retry.providerId,
      modelId: retry.modelId,
      attempts: 2,
    });
  }
  return {
    data: second.data,
    raw: retry.text ?? "",
    recovered: true,
    costUsd: estimateCostUsd(retry.providerId, retry.modelId, retry.usage),
    usage: retry.usage,
    providerId: retry.providerId,
    modelId: retry.modelId,
  };
}
