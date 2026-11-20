import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GENERATOR_DEFAULTS, resolveMaxTokens, schemaForCampaignType, DEFAULT_MAX_TOKENS } from "../generator-registry";

const APP_DIR = path.resolve(__dirname, "..", "..", "app");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : d.name === "page.tsx" ? [path.join(dir, d.name)] : []
  );
}

describe("generator registry mirrors each GeneratorShell page config", () => {
  const pages = walk(APP_DIR).filter((f) => fs.readFileSync(f, "utf8").includes("<GeneratorShell config={config}"));

  it("finds the generator pages", () => {
    expect(pages.length).toBeGreaterThan(25);
  });

  for (const file of pages) {
    const rel = path.relative(APP_DIR, file);
    it(rel, () => {
      const src = fs.readFileSync(file, "utf8");
      const ct = src.match(/campaign_type:\s*"([^"]+)"/)?.[1];
      const mt = Number(src.match(/maxTokens:\s*([\d_]+)/)?.[1]?.replace(/_/g, ""));
      expect(ct, `${rel} has no campaign_type`).toBeTruthy();
      const entry = GENERATOR_DEFAULTS[ct!];
      expect(entry, `"${ct}" missing from GENERATOR_DEFAULTS`).toBeTruthy();
      expect(entry.maxTokens, `${rel} maxTokens drifted`).toBe(mt);
      const schemaName = src.match(/schema:\s*([A-Za-z]+Schema)/)?.[1];
      if (schemaName) expect(entry.schema, `${rel} uses ${schemaName} but registry has none`).toBeTruthy();
    });
  }
});

describe("resolveMaxTokens", () => {
  it("prefers the value saved on the ad", () => {
    expect(resolveMaxTokens(6123, "Feed")).toBe(6123);
  });
  it("falls back to the tool default by campaign_type", () => {
    expect(resolveMaxTokens(undefined, "Reel Ideas")).toBe(7000);
    expect(resolveMaxTokens("nope", "Content Calendar")).toBe(6500);
  });
  it("falls back to a generous default for unknown types", () => {
    expect(resolveMaxTokens(null, "Mystery")).toBe(DEFAULT_MAX_TOKENS);
  });
  it("schemaForCampaignType", () => {
    expect(schemaForCampaignType("Feed")).toBeTruthy();
    expect(schemaForCampaignType("Report")).toBeUndefined();
  });
});
