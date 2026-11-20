/**
 * MCP host-mode evaluation: drives the bundled MCP server over stdio exactly
 * like Claude Desktop does, with NO AI key, so every tool runs in prompt mode.
 *
 *   node scripts/eval.cjs --mcp-host prompts <outDir> [tool...]
 *       → writes <tool>.prompt.json (system, user, output_schema) per tool
 *   (the host model — e.g. Claude — writes <tool>.output.json for each)
 *   node scripts/eval.cjs --mcp-host check <outDir>
 *       → validate_output via MCP + the objective checks, report.json
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AI_TOOL_BY_NAME } from "../../lib/tools/registry";
import { normalizeBrandBrain } from "../../lib/brand-brain";
import { KEY_ENV } from "../../mcp/runtime";
import { BRANDS, INPUTS } from "./fixtures";
import { checkOutput } from "./checks";

const ROOT = process.cwd();
const BUNDLE = path.join(ROOT, "mcp", "dist", "openadkit-mcp.mjs");

async function connect(dataDir: string): Promise<Client> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  for (const { vars } of KEY_ENV) for (const v of vars) delete env[v];
  env.OPENADKIT_DATA_DIR = dataDir;
  const client = new Client({ name: "openadkit-host-eval", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [BUNDLE], env, stderr: "pipe" }));
  return client;
}

function seedDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-host-eval-"));
  fs.writeFileSync(
    path.join(dir, "snapshot.json"),
    JSON.stringify({ version: 5, exported_at: Date.now(), brains: Object.values(BRANDS), ads: [], tombstones: [] }),
  );
  return dir;
}

const body = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0].text);

export async function runMcpHost(args: string[]) {
  const [step, outDir, ...only] = args;
  fs.mkdirSync(outDir, { recursive: true });
  const dataDir = seedDataDir();
  const client = await connect(dataDir);
  try {
    if (step === "prompts") {
      for (const [name, fx] of Object.entries(INPUTS)) {
        if (only.length && !only.includes(name)) continue;
        const res = body(
          await client.callTool({ name, arguments: { ...fx.input, ...(fx.brand ? { client: String(BRANDS[fx.brand].id) } : {}) } }),
        );
        if (res.mode !== "prompt") throw new Error(`${name}: expected prompt mode, got ${res.mode}`);
        fs.writeFileSync(path.join(outDir, `${name}.prompt.json`), JSON.stringify(res, null, 2));
        console.log(`prompt  ${name}  system ${res.system.length} chars, user ${res.user.length} chars`);
      }
      return;
    }
    if (step === "check") {
      const report = [];
      for (const file of fs.readdirSync(outDir).filter((f) => f.endsWith(".output.json"))) {
        const name = file.replace(/\.output\.json$/, "");
        const tool = AI_TOOL_BY_NAME[name];
        const fx = INPUTS[name];
        const output = JSON.parse(fs.readFileSync(path.join(outDir, file), "utf8"));
        const v = await client.callTool({ name: "validate_output", arguments: { tool: name, output } });
        const valid = !v.isError;
        const brand = fx.brand ? normalizeBrandBrain(BRANDS[fx.brand]) : null;
        const checks = checkOutput(tool, output, fx.input, brand);
        const failed = checks.filter((c) => !c.pass);
        report.push({ tool: name, schema_valid: valid, issues: valid ? [] : body(v).fix_these, checks });
        console.log(
          `${valid ? "✓" : "✗"} ${name.padEnd(32)} schema ${valid ? "valid" : "INVALID"}  checks ${checks.length - failed.length}/${checks.length}` +
            (failed.length ? `\n    ✗ ${failed.map((c) => `${c.name}${c.detail ? ` [${c.detail}]` : ""}`).join("\n    ✗ ")}` : "") +
            (valid ? "" : `\n    ${body(v).fix_these.join("\n    ")}`),
        );
      }
      fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
      return;
    }
    throw new Error("usage: --mcp-host prompts|check <outDir> [tool...]");
  } finally {
    await client.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
