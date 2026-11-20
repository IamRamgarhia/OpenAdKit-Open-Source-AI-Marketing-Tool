/**
 * MCP server, end to end over stdio — the same way Claude Desktop, Claude Code
 * and Cursor run it. Spawns the bundled server (mcp/dist/openadkit-mcp.mjs)
 * with the official MCP SDK client and exercises the real protocol.
 *
 * No AI keys are passed, so tools run in prompt mode; generate mode against a
 * real provider is covered by tests/live-mcp.spec.ts when a key is present.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AI_TOOLS } from "@/lib/tools/registry";
import { KEY_ENV } from "@/mcp/runtime";

const ROOT = path.resolve(__dirname, "..", "..");
const BUNDLE = path.join(ROOT, "mcp", "dist", "openadkit-mcp.mjs");

// A realistic saved client, shaped exactly like the app's snapshot.json.
const BRAND = {
  id: "b-sunrise-dental",
  name: "Sunrise Dental",
  business_name: "Sunrise Dental Clinic",
  industry: "Healthcare / dental",
  website_url: "https://example.com/sunrise-dental",
  tone: "Warm, reassuring, plain-spoken",
  products: ["Teeth whitening", "Invisalign", "Emergency dental care"],
  audience_who: "Working adults 25-45 in Pune who avoid the dentist",
  created_at: 1760000000000,
  updated_at: 1760000000000,
};

let dataDir: string;
let client: Client;

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  for (const { vars } of KEY_ENV) for (const v of vars) delete env[v];
  delete env.OPENADKIT_PROVIDER;
  env.OPENADKIT_DATA_DIR = dataDir;
  return env;
}

function parse(result: unknown): any {
  const r = result as { content: { type: string; text: string }[] };
  return JSON.parse(r.content[0].text);
}

beforeAll(async () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-mcp.cjs")], { stdio: "pipe" });
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-mcp-"));
  fs.writeFileSync(
    path.join(dataDir, "snapshot.json"),
    JSON.stringify({
      version: 5,
      exported_at: Date.now(),
      brains: [BRAND, { ...BRAND, id: "b-gone", business_name: "Deleted Co", deleted_at: 1 }],
      ads: [],
      tombstones: [],
    }),
  );
  client = new Client({ name: "openadkit-test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [BUNDLE], env: cleanEnv(), stderr: "pipe" }));
}, 60_000);

afterAll(async () => {
  await client?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("OpenAdKit MCP server (stdio)", () => {
  it("identifies itself and lists every AI tool plus the helper tools", async () => {
    expect(client.getServerVersion()?.name).toBe("openadkit");
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const t of AI_TOOLS) expect(names).toContain(t.name);
    for (const t of ["list_brands", "get_brand", "validate_output", "openadkit_status"]) expect(names).toContain(t);
    const meta = tools.find((t) => t.name === "generate_meta_ads")!;
    expect(meta.inputSchema.required).toEqual(expect.arrayContaining(["objective", "format", "product", "offer", "cta"]));
    expect(Object.keys(meta.inputSchema.properties ?? {})).toEqual(expect.arrayContaining(["brand", "language", "mode"]));
  });

  it("reports prompt mode when no AI key is configured", async () => {
    const status = parse(await client.callTool({ name: "openadkit_status", arguments: {} }));
    expect(status.mode).toBe("prompt");
    expect(status.provider).toBeNull();
    expect(status.saved_brands).toBe(1);
    expect(status.tools).toBe(AI_TOOLS.length);
  });

  it("lists saved brands from the app's snapshot, skipping deleted ones", async () => {
    const { brands } = parse(await client.callTool({ name: "list_brands", arguments: {} }));
    expect(brands).toEqual([
      { id: BRAND.id, business_name: BRAND.business_name, industry: BRAND.industry, website: BRAND.website_url },
    ]);
    const full = parse(await client.callTool({ name: "get_brand", arguments: { brand: "sunrise dental clinic" } }));
    expect(full.products).toEqual(BRAND.products);
  });

  it("returns the exact prompt, brand context and output schema in prompt mode", async () => {
    const res = parse(
      await client.callTool({
        name: "generate_google_search_ads",
        arguments: { goal: "Leads", product: "Teeth whitening", keyword: "teeth whitening pune", brand: BRAND.id },
      }),
    );
    expect(res.mode).toBe("prompt");
    expect(res.system).toContain("Sunrise Dental Clinic");
    expect(res.user).toContain("teeth whitening pune");
    expect(res.output_schema?.type).toBe("object");
    expect(res.output_schema?.properties).toHaveProperty("headlines");
  });

  it("validates host-written output and returns precise fixes when it is wrong", async () => {
    const good = {
      variants: [
        {
          label: "A",
          angle: "Pain-free",
          primary_text: "Whiter teeth in one visit, no sensitivity.",
          headline: "Book your whitening",
          description: "Pune clinic, same-week slots",
          cta_button: "Book now",
        },
      ],
    };
    const ok = parse(await client.callTool({ name: "validate_output", arguments: { tool: "generate_meta_ads", output: good } }));
    expect(ok.valid).toBe(true);

    const bad = await client.callTool({
      name: "validate_output",
      arguments: { tool: "generate_meta_ads", output: JSON.stringify({ variants: [] }) },
    });
    expect(bad.isError).toBe(true);
    expect(parse(bad).fix_these.join(" ")).toMatch(/variants/);
  });

  it("errors clearly on an unknown brand and on generate mode without a key", async () => {
    const unknown = await client.callTool({
      name: "generate_hashtags",
      arguments: { title: "Diwali sale", platform: "instagram", language: "English", brand: "no-such-brand" },
    });
    expect(unknown.isError).toBe(true);
    const noKey = await client.callTool({
      name: "generate_hashtags",
      arguments: { title: "Diwali sale", platform: "instagram", language: "English", mode: "generate" },
    });
    expect(noKey.isError).toBe(true);
    expect((noKey.content as { text: string }[])[0].text).toMatch(/needs an AI key/);
  });

  it("rejects inputs that violate the tool's schema at the protocol level", async () => {
    const res = await client.callTool({
      name: "generate_tiktok_ads",
      arguments: { product: "x", audience: "y", format: "not-a-format", vibe: "z" },
    });
    expect(res.isError).toBe(true);
  });
});

describe("OpenAdKit MCP server — numbers come from code, not the model", () => {
  it("returns the two-proportion sample size computed in code for A/B plans", async () => {
    const res = parse(
      await client.callTool({
        name: "optimize_ab_test",
        arguments: {
          platform: "Meta",
          current_ad: "Control ad",
          hypothesis_to_test: "Price anchor in headline",
          baseline_rate_pct: "10",
          mde_pct: "20",
          daily_visitors_per_variant: "500",
        },
      }),
    );
    // 10% -> 12% at 95% confidence / 80% power needs 3,841 per variant.
    expect(res.computed_in_code.perVariant).toBe(3841);
    expect(res.computed_in_code.days).toBe(8);
  });
});

describe("OpenAdKit MCP server — platform character limits", () => {
  const rsa = (headline: string) => ({
    headlines: [{ text: headline, chars: [...headline].length, angle: "keyword", status: "ok" }],
    descriptions: [{ text: "Gentle whitening with a written quote first.", chars: 44, angle: "benefit_proof", status: "ok" }],
  });

  it("rejects a schema-valid Google headline that is over 30 characters", async () => {
    const res = await client.callTool({
      name: "validate_output",
      arguments: { tool: "generate_google_search_ads", output: rsa("Know Your Price Before We Start") },
    });
    expect(res.isError).toBe(true);
    expect(parse(res).fix_these[0]).toMatch(/headlines\[0\]\.text: Google headline \(30\).*31 characters/);
  });

  it("accepts an over-limit field when a fitting trimmed_alt is supplied", async () => {
    const out = rsa("Know Your Price Before We Start");
    (out.headlines[0] as Record<string, unknown>).trimmed_alt = "Know the Price Before We Start";
    const res = await client.callTool({ name: "validate_output", arguments: { tool: "generate_google_search_ads", output: out } });
    expect(parse(res).valid).toBe(true);
  });
});
