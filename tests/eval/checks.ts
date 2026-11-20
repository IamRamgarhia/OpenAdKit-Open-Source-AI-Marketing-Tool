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

  const banned = [...BANNED_WORDS.vague_verbs, ...BANNED_WORDS.superlatives_without_proof].filter((w) =>
    new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text),
  );
  // Only generated ad copy: optimizers quote the user's original ad and use
  // ordinary words like "leading" in analysis.
  if (tool.category === "generate") {
    checks.push({ name: "no banned hype words", pass: banned.length === 0, detail: banned.join(", ") || undefined });
  }

  // Fabrication guard: percentages / "x% more" claims / star ratings that
  // appear in the copy but nowhere in the brief or brand.
  const source = JSON.stringify(input) + JSON.stringify(brand ?? {});
  const claims = [...new Set(text.match(/\b\d{1,3}(?:\.\d+)?\s?%|\b\d(?:\.\d)?\s?stars?\b|\b\d{2,}(?:,\d{3})*\+?\s(?:customers|clients|users|reviews|patients)\b/gi) ?? [])];
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

