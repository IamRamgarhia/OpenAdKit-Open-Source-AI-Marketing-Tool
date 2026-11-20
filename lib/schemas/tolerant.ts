/**
 * Shared leniency helpers for LLM-output schemas.
 *
 * Models routinely emit `null` for "not applicable" — and several prompt
 * templates explicitly tell them to ("trimmed_alt": "string or null",
 * "lead_form": null). Zod's `.optional()` / `.partial()` accept `undefined`
 * but reject `null`, so a model that followed the prompt exactly tripped a
 * schema retry (or a hard failure). Every generator schema is therefore
 * wrapped in `tolerant()`, which drops null-valued object keys before
 * validation — a null field is treated exactly like an absent one.
 */
import { z, type ZodTypeAny } from "zod";

/** Recursively remove object keys whose value is null. Array elements are
 *  kept (a null inside an array is a real shape problem the schema should
 *  see), but objects inside arrays are cleaned too. */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

/** Wrap a schema so null-valued keys are treated as absent. */
export function tolerant<S extends ZodTypeAny>(schema: S) {
  return z.preprocess(stripNulls, schema);
}

/**
 * A number the model wrote. Models sometimes quote numbers ("42", "1,200",
 * "12%") — accept those when the whole string is numeric after stripping
 * thousands separators / currency / percent, and reject anything else (unlike
 * bare z.coerce.number(), which turns "" into 0 and "n/a" into NaN).
 */
export const ModelNumber = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const cleaned = v.replace(/[,\s$%]/g, "");
  if (cleaned === "") return v;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : v;
}, z.number());
