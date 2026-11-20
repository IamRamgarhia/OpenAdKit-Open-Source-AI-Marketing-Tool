import type { InputField } from "./generator-config";

/**
 * Form-hydration helpers for GeneratorShell. Pure, so they're unit-tested.
 */

function acceptsValue(field: InputField, val: unknown): boolean {
  // Image fields hold an ImagePart object — never hydrate them from a URL or
  // a saved ad (images aren't persisted).
  if (field.kind === "image") return false;
  if (val === null || val === undefined || val === "") return false;
  if (typeof val !== "string" && typeof val !== "number") return false;
  // A select can only take one of its own options; anything else renders a
  // blank dropdown and silently changes nothing.
  if (field.kind === "select" && field.options?.length) {
    return field.options.some((o) => o.value === String(val));
  }
  return true;
}

/**
 * Apply URL query params on top of a smart-filled input. Only fields whose
 * names appear in the generator's config get overridden, so pass-through
 * params like `ad_id` / `brand_id` never pollute (or get persisted with) the
 * form state. `?carry=0` skips overrides entirely (force-reset).
 */
export function applyQueryOverrides<I extends Record<string, unknown>>(
  current: I,
  searchParams: URLSearchParams | { get(k: string): string | null; entries(): IterableIterator<[string, string]> } | null,
  fields: InputField[]
): I {
  if (!searchParams) return current;
  if (searchParams.get("carry") === "0") return current;
  const byName = new Map(fields.map((f) => [f.name, f]));
  const next: Record<string, unknown> = { ...current };
  for (const [key, val] of searchParams.entries()) {
    const field = byName.get(key);
    if (!field || field.kind === "image" || !val) continue;
    next[key] = val;
  }
  return next as I;
}

/**
 * Prefill a generator form from a saved ad's `input` blob (the `?ad_id=`
 * deep link from "Apply rewrite as a new variant" / other next steps).
 * Copies only fields this generator declares, skips internal `__` keys and
 * values a select can't represent. Returns the new input + how many fields
 * changed so the UI can say so.
 */
export function prefillFromSavedInput<I extends Record<string, unknown>>(
  current: I,
  saved: Record<string, unknown> | null | undefined,
  fields: InputField[]
): { input: I; filled: number } {
  if (!saved || typeof saved !== "object") return { input: current, filled: 0 };
  const next: Record<string, unknown> = { ...current };
  let filled = 0;
  for (const f of fields) {
    if (f.name.startsWith("__")) continue;
    const v = saved[f.name];
    if (!acceptsValue(f, v)) continue;
    if (next[f.name] !== v) filled++;
    next[f.name] = v;
  }
  return { input: next as I, filled };
}

/** Strip internal `__`-prefixed keys (transient routing hints) before persisting. */
export function persistableInput(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([k]) => !k.startsWith("__")));
}
