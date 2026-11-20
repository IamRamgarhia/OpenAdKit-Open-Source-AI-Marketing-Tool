/**
 * Release updates (scripts/release-update.cjs) and Claude Desktop
 * registration (scripts/register-mcp.cjs) — the installer-facing helpers.
 * Network calls use an injected fetcher returning real GitHub API shapes.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const ru = require(path.resolve(import.meta.dirname, "../../scripts/release-update.cjs"));
const reg = require(path.resolve(import.meta.dirname, "../../scripts/register-mcp.cjs"));

describe("release-update: versions", () => {
  it("compares semver including pre-releases and a leading v", () => {
    expect(ru.compareVersions("v2.0.0", "1.9.9")).toBe(1);
    expect(ru.compareVersions("2.0.0", "2.0.0")).toBe(0);
    expect(ru.compareVersions("2.0.0-beta.1", "2.0.0")).toBe(-1);
    expect(ru.compareVersions("2.10.0", "2.9.3")).toBe(1);
    expect(ru.compareVersions("garbage", "2.0.0")).toBe(0);
  });

  it("reads the installed version from payload.json before package.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-ver-"));
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "0.0.1" }));
    fs.writeFileSync(path.join(dir, "payload.json"), JSON.stringify({ version: "2.0.0" }));
    expect(ru.installedVersion(dir)).toEqual({ version: "2.0.0", source: "payload.json" });
  });
});

describe("release-update: check()", () => {
  const release = (tag: string, assets: string[]) =>
    async () =>
      Buffer.from(
        JSON.stringify({
          tag_name: tag,
          html_url: `https://github.com/${ru.REPO}/releases/tag/${tag}`,
          body: "What's new…",
          published_at: "2026-11-20T00:00:00Z",
          assets: assets.map((name) => ({ name, size: 5_000_000, browser_download_url: `https://github.com/x/${name}` })),
        }),
      );

  function root(version: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-chk-"));
    fs.writeFileSync(path.join(dir, "payload.json"), JSON.stringify({ version }));
    return dir;
  }

  it("offers one-click apply only to the packaged Windows app", async () => {
    const r = await ru.check({
      projectRoot: root("2.0.0"),
      env: { OPENADKIT_PACKAGED: "windows" },
      fetcher: release("v2.1.0", ["OpenAdKit-Windows-Setup.exe", "SHA256SUMS.txt"]),
    });
    expect(r.update_available).toBe(true);
    expect(r.latest).toBe("2.1.0");
    expect(r.can_apply).toBe(process.platform === "win32");
    expect(r.command).toBeNull();
  });

  it("gives macOS/Linux installs the install command instead", async () => {
    const r = await ru.check({ projectRoot: root("2.0.0"), env: { OPENADKIT_PACKAGED: "unix" }, fetcher: release("v2.1.0", []) });
    expect(r.can_apply).toBe(false);
    expect(r.command).toMatch(/install\.sh \| bash$/);
  });

  it("reports up to date, and network errors without throwing", async () => {
    const same = await ru.check({ projectRoot: root("2.1.0"), env: {}, fetcher: release("v2.1.0", []) });
    expect(same.status).toBe("up_to_date");
    const down = await ru.check({
      projectRoot: root("2.1.0"),
      env: {},
      fetcher: async () => {
        throw new Error("getaddrinfo ENOTFOUND api.github.com");
      },
    });
    expect(down.status).toBe("network_error");
  });
});

describe("release-update: verified Setup download", () => {
  const exe = Buffer.concat([Buffer.from("MZ"), crypto.randomBytes(1024 * 1024 + 10)]);
  const sha = crypto.createHash("sha256").update(exe).digest("hex");

  function fetcherWith(sumsLine: string, body: Buffer) {
    return async (url: string) => (url.endsWith("SHA256SUMS.txt") ? Buffer.from(sumsLine) : body);
  }

  it("writes the Setup and ready.json when the SHA-256 matches", async () => {
    const env = { LOCALAPPDATA: fs.mkdtempSync(path.join(os.tmpdir(), "oak-upd-")) };
    const r = await ru.downloadWindowsSetup({ tag: "v2.1.0", env, fetcher: fetcherWith(`${sha}  OpenAdKit-Windows-Setup.exe\n`, exe) });
    expect(r.sha256).toBe(sha);
    const ready = JSON.parse(fs.readFileSync(path.join(ru.updateDir(env), "ready.json"), "utf8"));
    expect(ready.tag).toBe("v2.1.0");
    expect(fs.readFileSync(ready.path).equals(exe)).toBe(true);
  });

  it("refuses a download whose SHA-256 does not match", async () => {
    const env = { LOCALAPPDATA: fs.mkdtempSync(path.join(os.tmpdir(), "oak-upd-")) };
    await expect(
      ru.downloadWindowsSetup({ tag: "v2.1.0", env, fetcher: fetcherWith(`${"0".repeat(64)}  OpenAdKit-Windows-Setup.exe\n`, exe) }),
    ).rejects.toThrow(/SHA-256/);
    expect(fs.existsSync(path.join(ru.updateDir(env), "ready.json"))).toBe(false);
  });

  it("only downloads from GitHub hosts", async () => {
    await expect(ru.get("https://evil.example/OpenAdKit-Windows-Setup.exe")).rejects.toThrow(/refusing/);
    await expect(ru.get("http://github.com/x")).rejects.toThrow(/refusing/);
  });
});

describe("register-mcp: Claude Desktop config merge", () => {
  const entry = reg.serverEntry("C:/OpenAdKit/node/node.exe", "C:/OpenAdKit/app/mcp/openadkit-mcp.mjs");

  it("adds OpenAdKit and keeps every other server and setting", () => {
    const existing = JSON.stringify({ globalShortcut: "Ctrl+Space", mcpServers: { github: { command: "gh-mcp" } } });
    const out = reg.mergeConfig(existing, entry);
    expect(out.globalShortcut).toBe("Ctrl+Space");
    expect(out.mcpServers.github).toEqual({ command: "gh-mcp" });
    expect(out.mcpServers.openadkit).toEqual(entry);
  });

  it("creates a config when none exists, and removes cleanly", () => {
    expect(reg.mergeConfig("", entry)).toEqual({ mcpServers: { openadkit: entry } });
    const removed = reg.mergeConfig(JSON.stringify({ mcpServers: { openadkit: entry, other: { command: "x" } } }), entry, { remove: true });
    expect(removed.mcpServers).toEqual({ other: { command: "x" } });
  });

  it("never overwrites a config that is not valid JSON", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-claude-"));
    const cfg = path.join(dir, "claude_desktop_config.json");
    fs.writeFileSync(cfg, "{ broken json");
    const script = path.join(dir, "openadkit-mcp.mjs");
    fs.writeFileSync(script, "");
    const code = reg.main(["--config", cfg, "--script", script, "--node", "node"]);
    expect(code).toBe(2);
    expect(fs.readFileSync(cfg, "utf8")).toBe("{ broken json");
  });

  it("writes the merged file and a backup of the original", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-claude-"));
    const cfg = path.join(dir, "claude_desktop_config.json");
    const original = JSON.stringify({ mcpServers: { github: { command: "gh-mcp" } } });
    fs.writeFileSync(cfg, original);
    const script = path.join(dir, "openadkit-mcp.mjs");
    fs.writeFileSync(script, "");
    expect(reg.main(["--config", cfg, "--script", script, "--node", "node"])).toBe(0);
    const merged = JSON.parse(fs.readFileSync(cfg, "utf8"));
    expect(Object.keys(merged.mcpServers).sort()).toEqual(["github", "openadkit"]);
    expect(fs.readFileSync(`${cfg}.openadkit-backup`, "utf8")).toBe(original);
  });
});
