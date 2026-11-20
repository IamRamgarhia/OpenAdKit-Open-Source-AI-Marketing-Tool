/** Objective checks applied to real tool output (eval + MCP host runs). */
import type { AiTool } from "../../lib/tools/registry";
import type { BrandBrain } from "../../lib/brand-brain";
import { BANNED_WORDS } from "../../lib/prompts/common-rules";
import { limitViolations, limitedFieldCount, stringLeaves as strings } from "../../lib/tools/limits";

export interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

/** Keys of the model's own working (strategy, notes, image/video prompts) —
 *  not copy a reader of the ad sees. */
const NON_COPY_KEY =
  /^(notes?|.*_notes|strategy|rationale|.*_rationale|reasons?|.*_reason|reasoning|why.*|observation|evidence|analysis|summary|diagnosis.*|self_check|audience_hint|best_placement_recommendation|policy_warnings|tweaks.*|creator_brief|visual.*|image.*|prompts?|.*_prompts?|negative_prompt|params|b_roll|shot_breakdown|production_notes|layout.*|composition|safe_zone.*)$/i;

/** Keys describing layout / visuals / generation prompts, where "20% of
 *  frame" or "logo at 15% width" is a spec, not a claim. */
const LAYOUT_KEY =
  /^(visual.*|image.*|prompts?|.*_prompts?|negative_prompt|params|b_roll|shot_breakdown|production_notes|layout.*|composition|safe_zone.*|.*_brief)$/i;

const keys = (path: string) => path.split(/[.[\]]+/).filter((s) => s && !/^\d+$/.test(s));

/** True when a JSON path points at ad copy rather than notes / visuals / prompts. */
export function isCopyPath(path: string): boolean {
  return !keys(path).some((k) => NON_COPY_KEY.test(k));
}

const isLayoutPath = (path: string) => keys(path).some((k) => LAYOUT_KEY.test(k));

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Banned hype words used as standalone words. Hyphenated compounds
 *  ("best-before", "best-performing") are ordinary language, not hype. */
export function bannedWordsIn(text: string): string[] {
  return [...BANNED_WORDS.vague_verbs, ...BANNED_WORDS.superlatives_without_proof].filter((w) =>
    new RegExp(`(?<![\\w-])${escape(w)}(?![\\w-])`, "i").test(text),
  );
}

export function checkOutput(tool: AiTool, data: unknown, input: Record<string, unknown>, brand: BrandBrain | null): Check[] {
  const all = strings(data);
  const text = all.map((s) => s.text).join("\n");
  const checks: Check[] = [];

  const limited = limitedFieldCount(tool.name, data);
  if (limited) {
    const over = limitViolations(tool.name, data);
    checks.push({
      name: "platform character limits",
      pass: over.length === 0,
      detail: over.length ? over.map((o) => `${o.path} ${o.length}/${o.max}`).join(", ") : `${limited} fields ok`,
    });
  }

  // Only generated ad copy: optimizers quote the user's original ad and use
  // ordinary words like "leading" in analysis; generators' rationale / notes /
  // image prompts aren't copy either.
  if (tool.category === "generate") {
    const copy = all.filter((s) => isCopyPath(s.path)).map((s) => s.text).join("\n");
    const banned = bannedWordsIn(copy);
    checks.push({ name: "no banned hype words", pass: banned.length === 0, detail: banned.join(", ") || undefined });
  }

  // Fabrication guard: percentages / "x% more" claims / star ratings that
  // appear in the output but nowhere in the brief or brand. Layout / visual /
  // prompt fields are specs ("overlay < 20% of frame"), not claims.
  const source = JSON.stringify(input) + JSON.stringify(brand ?? {});
  const claimText = all.filter((s) => !isLayoutPath(s.path)).map((s) => s.text).join("\n");
  const claims = [...new Set(claimText.match(/\b\d{1,3}(?:\.\d+)?\s?%|\b\d(?:\.\d)?\s?stars?\b|\b\d{2,}(?:,\d{3})*\+?\s(?:customers|clients|users|reviews|patients)\b/gi) ?? [])];
  const invented = claims.filter((c) => !source.includes(c.replace(/\s/g, "")) && !source.includes(c));
  if (tool.category === "generate") {
    checks.push({
      name: "no invented stats in copy",
      pass: invented.length === 0,
      detail: invented.length ? invented.slice(0, 6).join(", ") : undefined,
    });
  }

  if (brand?.business_name && tool.category === "generate") {
    const short = brand.business_name.split(/\s+/)[0];
    checks.push({
      name: "uses the brand",
      pass: new RegExp(short, "i").test(text),
      detail: short,
    });
  }
  checks.push({ name: "non-trivial output", pass: text.length > 200, detail: `${text.length} chars` });
  return checks;
}
