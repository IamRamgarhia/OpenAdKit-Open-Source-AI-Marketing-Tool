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
import { DISPLAY_SIZES } from "../prompts/display-ads";

export interface FieldLimit {
  /** Tool-name pattern. */
  tool: RegExp;
  /** JSON path pattern, e.g. headlines[3].text */
  path: RegExp;
  /** Fixed limit, or one that depends on a sibling field (display sizes). */
  max: number | ((root: unknown, path: string) => number);
  label: string;
  /** How the platform counts characters (default: code points). */
  measure?: (s: string) => number;
}

/** X counts every link as 23 characters (t.co wrapping), whatever its length. */
export function xWeightedLength(s: string): number {
  return [...s.replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "x".repeat(23))].length;
}

const sizeKey = (s: unknown) => String(s ?? "").replace(/\s/g, "").replace(/[x×X*]/g, "×");

/** Per-size display limit, read from the creative's own `size` field. */
function displayLimit(kind: "h_max" | "d_max", fallback: number) {
  return (root: unknown, path: string): number => {
    const size = get(root, path.replace(/\.[^.]+$/, ".size"));
    const row = DISPLAY_SIZES.find((d) => d.ratio === sizeKey(size));
    return row ? row[kind] : fallback;
  };
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
  // Display: each banner size has its own headline / description cap.
  { tool: /^generate_display_ads$/, path: /^creatives\[\d+\]\.short_headline$/, max: displayLimit("h_max", 30), label: "Display headline for this size" },
  { tool: /^generate_display_ads$/, path: /^creatives\[\d+\]\.description$/, max: displayLimit("d_max", 90), label: "Display description for this size" },
  { tool: /^generate_display_ads$/, path: /^creatives\[\d+\]\.cta_button$/, max: 12, label: "Display CTA button (12)" },
  { tool: /^generate_display_ads$/, path: /^responsive_display_assets\.short_headlines\[\d+\]$/, max: 30, label: "Responsive display short headline (30)" },
  { tool: /^generate_display_ads$/, path: /^responsive_display_assets\.long_headline$/, max: 90, label: "Responsive display long headline (90)" },
  { tool: /^generate_display_ads$/, path: /^responsive_display_assets\.descriptions\[\d+\]$/, max: 90, label: "Responsive display description (90)" },
  { tool: /^generate_display_ads$/, path: /^responsive_display_assets\.business_name$/, max: 25, label: "Business name (25)" },
  // X: 280 weighted characters, links count as 23.
  { tool: /^generate_x_twitter_ads$/, path: /^(tweets|thread)\[\d+\]\.text$/, max: 280, label: "X post (280, links = 23)", measure: xWeightedLength },
  { tool: /^generate_x_twitter_ads$/, path: /^website_card_title$/, max: 70, label: "X website card headline (70)" },
  // TikTok
  { tool: /^generate_tiktok_ads$/, path: /^scripts\[\d+\]\.caption$/, max: 100, label: "TikTok caption (100)" },
  { tool: /^generate_tiktok_spark_ads$/, path: /^adaptation_copy\.caption_variants\[\d+\]$/, max: 100, label: "TikTok caption (100)" },
  { tool: /^generate_tiktok_hashtag_challenge$/, path: /^discover_page\.challenge_name$/, max: 24, label: "Challenge name (24)" },
  { tool: /^generate_tiktok_hashtag_challenge$/, path: /^discover_page\.description$/, max: 80, label: "Challenge description (80)" },
  // Google Shopping
  { tool: /^generate_google_shopping_feed$/, path: /^title\.text$/, max: 150, label: "Shopping title (150)" },
  { tool: /^generate_google_shopping_feed$/, path: /^highlights\[\d+\]$/, max: 60, label: "Product highlight (60)" },
  // Campaign kit
  { tool: /^generate_campaign_kit$/, path: /^google_rsa\.headlines\[\d+\]$/, max: 30, label: "Google headline (30)" },
  { tool: /^generate_campaign_kit$/, path: /^google_rsa\.descriptions\[\d+\]$/, max: 90, label: "Google description (90)" },
  { tool: /^generate_campaign_kit$/, path: /^meta_feed\.headlines\[\d+\]$/, max: 40, label: "Meta headline (40)" },
  { tool: /^generate_campaign_kit$/, path: /^twitter\[\d+\]$/, max: 280, label: "X post (280, links = 23)", measure: xWeightedLength },
  // Quality Score fixer emits RSA-ready headlines.
  { tool: /^optimize_quality_score$/, path: /^improved_headlines\[\d+\]\.text$/, max: 30, label: "Google headline (30)" },
  // YouTube discovery / in-feed headline.
  { tool: /^generate_youtube_ads$/, path: /^headlines\[\d+\]$/, max: 100, label: "YouTube in-feed headline (100)" },
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
    if (!rule) continue;
    const max = typeof rule.max === "function" ? rule.max(data, leaf.path) : rule.max;
    const measure = rule.measure ?? chars;
    const length = measure(leaf.text);
    if (length <= max) continue;
    const alt = trimmedAlt(data, leaf.path);
    if (alt && measure(alt) <= max) continue;
    const label = typeof rule.max === "function" ? `${rule.label} (${max})` : rule.label;
    out.push({ path: leaf.path, label, max, length, text: leaf.text });
  }
  return out;
}

/** Number of fields a tool's limits apply to (for "n checked" reporting). */
export function limitedFieldCount(toolName: string, data: unknown): number {
  const rules = FIELD_LIMITS.filter((r) => r.tool.test(toolName));
  return stringLeaves(data).filter((l) => rules.some((r) => r.path.test(l.path))).length;
}
