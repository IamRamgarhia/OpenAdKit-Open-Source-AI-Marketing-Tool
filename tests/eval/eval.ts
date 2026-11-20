/**
 * Real-output evaluation: runs every OpenAdKit AI tool against a real provider
 * with realistic briefs, then applies objective checks to what came back.
 *
 *   npm run eval            (reads the key from .env.test.local)
 *
 * Writes test-results/eval/<timestamp>/report.json + one file per tool so a
 * human (or reviewer) can read the actual copy and score it. Nothing here is
 * mocked: if no key is configured it refuses to run.
 */
import fs from "node:fs";
import path from "node:path";
import { AI_TOOLS, type AiTool } from "../../lib/tools/registry";
import { generate, resolveProvider, type GenerateResult } from "../../mcp/runtime";
import { normalizeBrandBrain, type BrandBrain } from "../../lib/brand-brain";
import { BANNED_WORDS } from "../../lib/prompts/common-rules";
import { BRANDS, INPUTS } from "./fixtures";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

/** Every string anywhere in the output, with its JSON path. */
function strings(value: unknown, at = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path: at, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k));
  return [];
}

/** Platform character limits, by JSON path pattern. */
const LIMITS: { tool: RegExp; path: RegExp; max: number; label: string }[] = [
  { tool: /google_search/, path: /headlines\[\d+\]\.text$/, max: 30, label: "RSA headline ≤30" },
  { tool: /google_search/, path: /descriptions\[\d+\]\.text$/, max: 90, label: "RSA description ≤90" },
  { tool: /pmax/, path: /^headlines\[\d+\]\.text$/, max: 30, label: "PMax headline ≤30" },
  { tool: /pmax/, path: /long_headlines\[\d+\]\.text$/, max: 90, label: "PMax long headline ≤90" },
  { tool: /pmax/, path: /descriptions\[\d+\]\.text$/, max: 90, label: "PMax description ≤90" },
  { tool: /meta_ads/, path: /\.headline$/, max: 40, label: "Meta headline ≤40" },
  { tool: /email_subject/, path: /\.subject$/, max: 60, label: "Subject ≤60" },
  { tool: /x_twitter/, path: /\.(text|tweet|copy)$/, max: 280, label: "Post ≤280" },
];

function checkOutput(tool: AiTool, data: unknown, input: Record<string, unknown>, brand: BrandBrain | null): Check[] {
  const all = strings(data);
  const text = all.map((s) => s.text).join("\n");
  const checks: Check[] = [];

  for (const lim of LIMITS.filter((l) => l.tool.test(tool.name))) {
    const over = all.filter((s) => lim.path.test(s.path) && [...s.text].length > lim.max);
    const total = all.filter((s) => lim.path.test(s.path)).length;
    checks.push({
      name: lim.label,
      pass: total > 0 && over.length === 0,
      detail: total === 0 ? "no fields found" : over.length ? over.map((o) => `${o.path} (${[...o.text].length})`).join(", ") : `${total} ok`,
    });
  }

  const banned = [...BANNED_WORDS.vague_verbs, ...BANNED_WORDS.superlatives_without_proof].filter((w) =>
    new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text),
  );
  checks.push({ name: "no banned hype words", pass: banned.length === 0, detail: banned.join(", ") || undefined });

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

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.test.local"));
  const resolved = resolveProvider();
  if (!resolved) {
    console.error("No AI key found. Put one in .env.test.local (GOOGLE_API_KEY=..., GROQ_API_KEY=..., ANTHROPIC_API_KEY=...).");
    process.exit(2);
  }
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const tools = AI_TOOLS.filter((t) => !only.length || only.some((o) => t.name.includes(o)));
  const outDir = path.join("test-results", "eval", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Evaluating ${tools.length} tools with ${resolved.provider.id}/${resolved.model}\n`);
  const report: unknown[] = [];
  let totalCost = 0;

  for (const tool of tools) {
    const fx = INPUTS[tool.name];
    if (!fx) {
      console.log(`- ${tool.name}: no fixture, skipped`);
      continue;
    }
    const brand = fx.brand ? normalizeBrandBrain(BRANDS[fx.brand]) : null;
    const started = Date.now();
    let result: GenerateResult | null = null;
    let error: string | null = null;
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      try {
        result = await generate(tool, fx.input, resolved, { brand });
      } catch (e) {
        error = (e as Error).message;
        if (/429|rate|quota/i.test(error)) await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
        else break;
      }
    }
    const ms = Date.now() - started;
    const checks = result ? checkOutput(tool, result.data, fx.input, brand) : [];
    const passed = checks.filter((c) => c.pass).length;
    totalCost += result?.cost_usd ?? 0;
    const row = {
      tool: tool.name,
      brand: fx.brand ?? null,
      ok: Boolean(result),
      error: result ? null : error,
      attempts: result?.attempts ?? null,
      seconds: +(ms / 1000).toFixed(1),
      tokens: result?.usage ?? null,
      cost_usd: result?.cost_usd ?? null,
      checks,
      score_checks: checks.length ? `${passed}/${checks.length}` : "-",
    };
    report.push(row);
    fs.writeFileSync(path.join(outDir, `${tool.name}.json`), JSON.stringify({ input: fx.input, brand: fx.brand, ...row, output: result?.data ?? null }, null, 2));
    const failed = checks.filter((c) => !c.pass).map((c) => `${c.name}${c.detail ? ` [${c.detail}]` : ""}`);
    console.log(
      `${result ? "✓" : "✗"} ${tool.name.padEnd(36)} ${String(row.seconds).padStart(5)}s  attempts=${row.attempts ?? "-"}  checks ${row.score_checks}` +
        (failed.length ? `\n    ✗ ${failed.join("\n    ✗ ")}` : "") +
        (error && !result ? `\n    error: ${error.slice(0, 300)}` : ""),
    );
  }
  fs.writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify({ provider: resolved.provider.id, model: resolved.model, total_cost_usd: totalCost, results: report }, null, 2),
  );
  console.log(`\nReport: ${outDir}/report.json   total cost ≈ $${totalCost.toFixed(4)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
