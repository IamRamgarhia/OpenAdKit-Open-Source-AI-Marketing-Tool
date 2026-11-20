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
import { BRANDS, INPUTS } from "./fixtures";
import { checkOutput } from "./checks";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  if (process.argv[2] === "--mcp-host") {
    const { runMcpHost } = await import("./mcp-host");
    await runMcpHost(process.argv.slice(3));
    return;
  }
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
