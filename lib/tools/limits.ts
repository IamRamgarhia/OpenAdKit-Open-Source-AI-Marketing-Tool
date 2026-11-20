/**
 * Hard platform character limits, checked on generated output. The schema
 * only checks shape; a 31-character Google headline is valid JSON but gets
 * rejected by Google Ads. Used by the MCP validate_output tool, the MCP
 * generate path (an over-limit reply triggers the corrective retry), and the
 * output eval.
 *
 * A field over its limit is acceptable only when the model also returned a
 * `trimmed_alt` (or `<field>_trimmed_alt`) that fits — that's what every
 * prompt's self-validation step asks for.
 */
export interface FieldLimit {
  /** Tool-name pattern. */
  tool: RegExp;
  /** JSON path pattern, e.g. headlines[3].text */
  path: RegExp;
  max: number;
  label: string;
}

export const FIELD_LIMITS: FieldLimit[] = [
  { tool: /^generate_google_search_ads$/, path: /^headlines\[\d+\]\.text$/, max: 30, label: "Google headline (30)" },
  { tool: /^generate_google_search_ads$/, path: /^descriptions\[\d+\]\.text$/, max: 90, label: "Google description (90)" },
  { tool: /^generate_google_search_ads$/, path: /^sitelinks\[\d+\]\.title$/, max: 25, label: "Sitelink title (25)" },
  { tool: /^generate_google_search_ads$/, path: /^sitelinks\[\d+\]\.desc[12]$/, max: 35, label: "Sitelink description (35)" },
  { tool: /^generate_google_search_ads$/, path: /^callouts\[\d+\]$/, max: 25, label: "Callout (25)" },
  { tool: /^generate_google_search_ads$/, path: /^structured_snippets\.values\[\d+\]$/, max: 25, label: "Snippet value (25)" },
  { tool: /^generate_google_search_ads$/, path: /^display_paths\.path[12]$/, max: 15, label: "Display path (15)" },
  { tool: /^generate_google_pmax_assets$/, path: /^headlines\[\d+\]\.text$/, max: 30, label: "PMax headline (30)" },
  { tool: /^generate_google_pmax_assets$/, path: /^long_headlines\[\d+\]\.text$/, max: 90, label: "PMax long headline (90)" },
  { tool: /^generate_google_pmax_assets$/, path: /^descriptions\[\d+\]\.text$/, max: 90, label: "PMax description (90)" },
  { tool: /^generate_display_ads$/, path: /(^|\.)headlines\[\d+\](\.text)?$/, max: 30, label: "Display headline (30)" },
  { tool: /^generate_meta_ads$/, path: /^variants\[\d+\]\.headline$/, max: 40, label: "Meta headline (40)" },
  { tool: /^generate_linkedin_ads$/, path: /^variants\[\d+\]\.intro_text$/, max: 600, label: "LinkedIn intro (600)" },
  { tool: /^generate_linkedin_ads$/, path: /^variants\[\d+\]\.headline$/, max: 200, label: "LinkedIn headline (200)" },
];

/** Every string in a value, with its JSON path. */
export function stringLeaves(value: unknown, at = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path: at, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => stringLeaves(v, `${at}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => stringLeaves(v, at ? `${at}.${k}` : k));
  return [];
}

const chars = (s: string) => [...s].length;

function get(root: unknown, path: string): unknown {
  const parts = path.match(/[^.[\]]+/g) ?? [];
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** A shorter alternative the model supplied next to an over-limit field. */
function trimmedAlt(root: unknown, path: string): string | null {
  const m = path.match(/^(.*?)(?:\.)?([^.[\]]+)$/);
  if (!m) return null;
  const [, parent, field] = m;
  const candidates = field === "text" ? [`${parent}.trimmed_alt`] : [`${parent}.${field}_trimmed_alt`, `${parent}.trimmed_alt`];
  for (const c of candidates) {
    const v = get(root, c.replace(/^\./, ""));
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export interface LimitViolation {
  path: string;
  label: string;
  max: number;
  length: number;
  text: string;
}

/** Fields over their platform limit with no fitting trimmed_alt. */
export function limitViolations(toolName: string, data: unknown): LimitViolation[] {
  const rules = FIELD_LIMITS.filter((r) => r.tool.test(toolName));
  if (!rules.length) return [];
  const out: LimitViolation[] = [];
  for (const leaf of stringLeaves(data)) {
    const rule = rules.find((r) => r.path.test(leaf.path));
    if (!rule || chars(leaf.text) <= rule.max) continue;
    const alt = trimmedAlt(data, leaf.path);
    if (alt && chars(alt) <= rule.max) continue;
    out.push({ path: leaf.path, label: rule.label, max: rule.max, length: chars(leaf.text), text: leaf.text });
  }
  return out;
}

/** Number of fields a tool's limits apply to (for "n checked" reporting). */
export function limitedFieldCount(toolName: string, data: unknown): number {
  const rules = FIELD_LIMITS.filter((r) => r.tool.test(toolName));
  return stringLeaves(data).filter((l) => rules.some((r) => r.path.test(l.path))).length;
}
