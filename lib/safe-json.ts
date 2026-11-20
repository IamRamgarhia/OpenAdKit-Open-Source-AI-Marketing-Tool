/**
 * Defensive accessors for model JSON that has NO schema (research/compare,
 * reel-teardown, strategy, launch-guide, launch-wizard phases). A model can
 * return a string where we expect a list, null where we expect an object, a
 * number as a string… and one `.map` on a non-array white-screens the page.
 */

/** The value if it's an array, else []. */
export function arr<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** A list of display strings: arrays keep their primitive items, a lone string becomes [string]. */
export function strList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((x) => x !== null && x !== undefined && typeof x !== "object")
      .map((x) => String(x))
      .filter(Boolean);
  }
  if (typeof v === "string" && v.trim()) return [v];
  if (typeof v === "number" && Number.isFinite(v)) return [String(v)];
  return [];
}

/** Join a list-ish value for display. */
export function joinList(v: unknown, sep = " · "): string {
  return strList(v).join(sep);
}

/** The value if it's a plain object, else {}. */
export function obj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}

/** Entries of a plain object whose values are themselves objects. */
export function objEntries(v: unknown): [string, Record<string, any>][] {
  return Object.entries(obj(v)).filter(([, x]) => x && typeof x === "object" && !Array.isArray(x)) as [string, Record<string, any>][];
}

/** Printable scalar (string/number) or "". */
export function txt(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Finite number or the fallback (accepts numeric strings like "1,200"). */
export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v.replace(/[,$%\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
