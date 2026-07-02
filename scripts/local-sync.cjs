#!/usr/bin/env node
/**
 * OpenAdKit local-sync + launcher sidecar.
 *
 * Tiny Node HTTP server (zero npm dependencies — only Node stdlib) that does two jobs:
 *
 *   1. Folder-portable data persistence:
 *      GET  /snapshot      → returns data/snapshot.json (or {} if missing)
 *      POST /snapshot      → writes data/snapshot.json
 *
 *   2. Process manager + control-panel launcher:
 *      GET  /              → serves public/launcher.html (the control panel)
 *      GET  /status        → { web: 'down'|'starting'|'up', sync: 'up', web_port, sync_port }
 *      POST /web/start     → spawns `next dev` as a child process
 *      POST /web/stop      → kills the Next child process
 *      POST /web/restart   → stop, wait, start
 *      GET  /config        → returns current PORT + ADFORGE_SYNC_PORT from .env.local
 *      POST /config        → updates .env.local (port + sync port)
 *      GET  /health        → liveness probe
 *
 * Bound to 127.0.0.1 only — never network-reachable.
 *
 * Run:   node scripts/local-sync.cjs
 * Stop:  Ctrl+C
 */

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const dns = require("dns");
const { spawn } = require("child_process");

// Fallback port: 41574 is in IANA's "registered but rarely used" range.
// Nothing well-known binds there, so collision-free for users with many local
// dev servers. The launcher's resolve-ports.cjs always sets this via env var
// before exec; this default only fires if you start the sidecar by hand.
const PORT = Number(process.env.ADFORGE_SYNC_PORT || process.env.ADOS_SYNC_PORT || 41574);
const PROJECT_ROOT = path.resolve(__dirname, "..");
// Per-user data dir: snapshots + lock file live in the OS's user-level
// config dir (%APPDATA%\OpenAdKit on Windows, ~/Library/Application Support
// /OpenAdKit on macOS, ~/.config/openadkit on Linux). This means upgrading
// OpenAdKit — even re-cloning into a new folder — never loses the user's
// saved snapshot. Aligns with native-app conventions.
//
// First boot migrates any legacy ./data/snapshot.json from the install
// folder into the new location so existing users don't lose state.
function resolveUserDataDir() {
  // Allow override via env for testing / unusual setups.
  if (process.env.ADFORGE_DATA_DIR) return process.env.ADFORGE_DATA_DIR;
  const plat = process.platform;
  const home = os.homedir();
  if (plat === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "OpenAdKit");
  }
  if (plat === "darwin") {
    return path.join(home, "Library", "Application Support", "OpenAdKit");
  }
  // Linux + others: XDG_CONFIG_HOME or fallback to ~/.config
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "openadkit");
}

const DATA_DIR = resolveUserDataDir();
const LEGACY_DATA_DIR = path.join(PROJECT_ROOT, "data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "snapshot.json");

// Pre-rebrand per-user dirs (when the tool was called AdForge). Existing users
// have their snapshot here from the previous version — migrate it forward so
// the rename is transparent.
function resolveLegacyBrandDataDirs() {
  const home = os.homedir();
  const plat = process.platform;
  const out = [];
  if (plat === "win32") {
    out.push(path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "AdForge"));
  } else if (plat === "darwin") {
    out.push(path.join(home, "Library", "Application Support", "AdForge"));
  } else {
    out.push(path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "adforge"));
  }
  return out;
}

// One-time migration: if the user has a legacy ./data/snapshot.json from a
// previous OpenAdKit version AND no new-location snapshot yet, move it.
// Also migrates from the pre-rebrand AdForge per-user data dir.
function migrateLegacyDataDirOnce() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SNAPSHOT_PATH)) {
      const candidates = [
        path.join(LEGACY_DATA_DIR, "snapshot.json"),
        ...resolveLegacyBrandDataDirs().map((d) => path.join(d, "snapshot.json")),
      ];
      for (const legacy of candidates) {
        if (fs.existsSync(legacy)) {
          fs.copyFileSync(legacy, SNAPSHOT_PATH);
          console.log(`[openadkit] migrated legacy snapshot ${legacy} → ${SNAPSHOT_PATH}`);
          break;
        }
      }
    }
  } catch (e) {
    console.warn(`[openadkit] data-dir migration failed (non-fatal): ${e?.message ?? e}`);
  }
}
migrateLegacyDataDirOnce();
const LAUNCHER_HTML = path.join(PROJECT_ROOT, "public", "launcher.html");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const MAX_BODY = 25 * 1024 * 1024;

// --- State ---
let webChild = null;
let webStatus = "down"; // 'down' | 'starting' | 'up' | 'stopping'
let webPort = 41573; // overwritten from .env.local right below (high-range default avoids collision with other dev servers)
let webStartedAt = 0;
let webLastLog = "";

// --- Update state (auto-update from GitHub) ---
// See "Update rules" in README. Single in-flight job at a time.
let updateState = {
  status: "idle", // 'idle' | 'checking' | 'available' | 'applying' | 'done' | 'error'
  current_sha: null,
  latest_sha: null,
  latest_commit_message: null,
  latest_commit_date: null,
  branch: null,
  dirty: false,
  log: [], // ring buffer of step events
  started_at: 0,
  finished_at: 0,
  error: null,
};
function appendUpdateLog(line) {
  const t = new Date().toISOString();
  updateState.log.push(`[${t}] ${line}`);
  if (updateState.log.length > 200) updateState.log.shift();
  console.log(`[openadkit:update] ${line}`);
}
const GH_REPO = "IamRamgarhia/AdForge"; // public, no auth required

// --- Helpers ---
function envPort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : fallback;
}

function readEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) return { PORT: "41573", ADFORGE_SYNC_PORT: String(PORT) };
  const out = {};
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return { PORT: out.PORT || "41573", ADFORGE_SYNC_PORT: out.ADFORGE_SYNC_PORT || String(PORT) };
}

function writeEnvLocal(updates) {
  const current = readEnvLocal();
  const next = { ...current, ...updates };
  // Preserve every other key the user added (API keys, ADFORGE_NO_AUTOSTART,
  // feature flags, …) — only PORT / ADFORGE_SYNC_PORT are managed here. The old
  // implementation rewrote the whole file with just those two keys, silently
  // deleting everything else. (Audit finding.)
  let lines = fs.existsSync(ENV_LOCAL)
    ? fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)
    : ["# OpenAdKit configuration (managed by the launcher)"];
  const setKey = (key, value) => {
    const idx = lines.findIndex((l) => {
      const t = l.trim();
      return !t.startsWith("#") && t.slice(0, t.indexOf("=")).trim() === key;
    });
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  };
  setKey("PORT", next.PORT);
  setKey("ADFORGE_SYNC_PORT", next.ADFORGE_SYNC_PORT);
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  fs.writeFileSync(ENV_LOCAL, lines.join("\n") + "\n", "utf8");
  return next;
}

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) await fsp.mkdir(DATA_DIR, { recursive: true });
}

// CSRF guard: only respond to known-good local origins. A malicious page in
// any browser tab could otherwise POST to 127.0.0.1:<port>/update/apply (runs
// git pull + npm install), /snapshot (writes user data), /quit, etc. — the
// 127.0.0.1 binding blocks remote network but not same-machine browser tabs.
// (Audit finding #14.)
function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return false;
    // Web port is whatever .env.local says; sidecar port is PORT. Accept either,
    // and a small range around them in case ports were auto-shifted.
    const p = Number(u.port);
    if (!Number.isFinite(p)) return false;
    return (
      p === webPort ||
      p === PORT ||
      // Tolerate the conventional defaults in case ports get shifted.
      (p >= 3000 && p <= 3030)
    );
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  // Unknown origins: deliberately do NOT set Access-Control-Allow-Origin.
  // The browser will block the response from the calling script.
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// SSRF guard: refuse to fetch private / loopback / link-local addresses
// either on the initial URL or on any redirect target. (Audit finding #13.)
function isPrivateOrLoopbackHost(hostname) {
  if (!hostname) return true;
  // URL.hostname returns IPv6 literals wrapped in brackets ("[::1]") — strip
  // them so the IPv6 checks below actually match (previously they never did,
  // so every IPv6 loopback/link-local address bypassed the guard). (Audit.)
  let h = String(hostname).toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (h === "localhost" || h === "ip6-localhost" || h === "ip6-loopback") return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1) — unwrap to the
  // embedded IPv4 and re-check so a mapped loopback/metadata address is caught.
  const mapped = h.match(/^::ffff:(.+)$/i);
  if (mapped) {
    const inner = mapped[1];
    if (inner.includes(".")) {
      h = inner;
    } else {
      const parts = inner.split(":");
      if (parts.length === 2) {
        const hi = parseInt(parts[0], 16);
        const lo = parseInt(parts[1], 16);
        if (Number.isFinite(hi) && Number.isFinite(lo)) {
          h = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
        }
      }
    }
  }
  // IPv4 loopback / private RFC1918 / link-local
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^0\./.test(h)) return true;
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h === "::") return true;
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function tryProbeWeb(port, cb) {
  let done = false;
  const finish = (alive) => {
    if (done) return;
    done = true;
    cb(Boolean(alive));
  };
  const req = http.request(
    { host: "127.0.0.1", port, path: "/", method: "GET", timeout: 1500 },
    (resp) => {
      resp.resume();
      finish(resp.statusCode && resp.statusCode < 500);
    }
  );
  req.on("error", () => finish(false));
  req.on("timeout", () => { try { req.destroy(); } catch {} finish(false); });
  req.on("close", () => finish(false));
  req.end();
}

function startWeb() {
  if (webChild && !webChild.killed) {
    return { ok: false, error: "already running" };
  }
  const env = readEnvLocal();
  webPort = Number(env.PORT) || 41573;
  webStatus = "starting";
  webStartedAt = Date.now();
  webLastLog = "";

  const isWin = process.platform === "win32";
  const npx = isWin ? "npx.cmd" : "npx";
  webChild = spawn(npx, ["next", "dev", "-p", String(webPort)], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(webPort) },
    shell: isWin,
    stdio: ["ignore", "pipe", "pipe"],
  });

  webChild.stdout.on("data", (b) => {
    const s = b.toString();
    process.stdout.write(`[next] ${s}`);
    webLastLog = s.trim().split("\n").slice(-3).join("\n");
  });
  webChild.stderr.on("data", (b) => {
    const s = b.toString();
    process.stderr.write(`[next-err] ${s}`);
    webLastLog = s.trim().split("\n").slice(-3).join("\n");
  });
  webChild.on("exit", (code) => {
    console.log(`[openadkit] next dev exited with code ${code}`);
    webChild = null;
    webStatus = "down";
  });

  // Poll for "up"
  const tick = () => {
    if (!webChild || webChild.killed) return;
    tryProbeWeb(webPort, (alive) => {
      if (alive) { webStatus = "up"; return; }
      if (Date.now() - webStartedAt < 60_000) setTimeout(tick, 800);
      else webStatus = "down";
    });
  };
  setTimeout(tick, 1500);

  return { ok: true, pid: webChild.pid, port: webPort };
}

/**
 * Pull structured metadata from a raw HTML body. Every modern site puts brand
 * signal in <head> (title, OG, JSON-LD) + footer anchors (social links). The
 * brand-extraction AI needs these as STRUCTURED inputs, not buried in stripped
 * body prose. Returns { title, description, og, favicon, social_links, json_ld }.
 */
function extractMetadata(html, baseUrl) {
  const meta = {
    title: "",
    description: "",
    og: {},
    favicon: "",
    social_links: {},
    json_ld: [],
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  // meta name=/property= with content=, both attribute orders. Also handles
  // unquoted attribute values that older WP/CMS templates sometimes emit.
  // (Audit finding #59.)
  const metaTagRe = /<meta\b[^>]*>/gi;
  let m;
  const ATTR_RE = (name) => new RegExp(`(?:${name})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  while ((m = metaTagRe.exec(html)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(ATTR_RE("name|property"));
    const contentMatch = tag.match(ATTR_RE("content"));
    if (!nameMatch || !contentMatch) continue;
    const key = (nameMatch[1] || nameMatch[2] || nameMatch[3] || "").toLowerCase();
    const val = contentMatch[1] || contentMatch[2] || contentMatch[3] || "";
    if (key === "description" && !meta.description) meta.description = val;
    if (key.startsWith("og:")) meta.og[key.slice(3)] = val;
    if (key === "twitter:title" && !meta.og.title) meta.og.title = val;
    if (key === "twitter:description" && !meta.og.description) meta.og.description = val;
    if (key === "twitter:image" && !meta.og.image) meta.og.image = val;
  }

  // favicon — prefer non-apple icon when multiple variants present
  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    const relMatch = tag.match(/rel\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    if (/icon/i.test(relMatch[1])) {
      try {
        meta.favicon = new URL(hrefMatch[1], baseUrl).toString();
        if (!/apple-touch/i.test(relMatch[1])) break;
      } catch { /* skip */ }
    }
  }
  if (!meta.favicon) {
    try { meta.favicon = new URL("/favicon.ico", baseUrl).toString(); } catch {}
  }

  // Social media anchor hrefs — bucket by hostname
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = anchorRe.exec(html)) !== null) {
    let u;
    try { u = new URL(m[1], baseUrl); } catch { continue; }
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const url = u.toString();
    if (!meta.social_links.facebook && /(^|\.)facebook\.com$/.test(host) && !/\/sharer/i.test(u.pathname)) meta.social_links.facebook = url;
    if (!meta.social_links.instagram && /(^|\.)instagram\.com$/.test(host)) meta.social_links.instagram = url;
    if (!meta.social_links.twitter && (/(^|\.)twitter\.com$/.test(host) || /(^|\.)x\.com$/.test(host)) && !/\/intent\//i.test(u.pathname)) meta.social_links.twitter = url;
    if (!meta.social_links.linkedin && /(^|\.)linkedin\.com$/.test(host)) meta.social_links.linkedin = url;
    if (!meta.social_links.youtube && /(^|\.)youtube\.com$/.test(host)) meta.social_links.youtube = url;
    if (!meta.social_links.tiktok && /(^|\.)tiktok\.com$/.test(host)) meta.social_links.tiktok = url;
    if (!meta.social_links.pinterest && /(^|\.)pinterest\.com$/.test(host)) meta.social_links.pinterest = url;
    if (!meta.social_links.threads && /(^|\.)threads\.net$/.test(host)) meta.social_links.threads = url;
  }

  // JSON-LD organization / business schema
  const jsonLdRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = jsonLdRe.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      meta.json_ld.push(parsed);
    } catch { /* skip malformed JSON-LD */ }
  }

  return meta;
}

/**
 * "Clean rebuild" — kills any running web child, deletes the .next/ build cache,
 * and lets the caller restart fresh. Common fix when CSS chunk references go
 * stale (which happens if `next build` ever runs over a `next dev` working
 * directory). User-triggered from the launcher control panel.
 */
function cleanRebuild() {
  // Stop the running web first.
  if (webChild && !webChild.killed) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(webChild.pid), "/F", "/T"]);
      } else {
        webChild.kill("SIGTERM");
      }
    } catch { /* ignore */ }
    webChild = null;
  }
  webStatus = "down";

  // Recursively delete .next/. Use fs.rm with force+recursive (Node 14+).
  const nextDir = path.join(PROJECT_ROOT, ".next");
  try {
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
    return { ok: true, deleted: true };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// --- Update helpers (auto-update from GitHub) ---

/** Read the current Git HEAD's branch + sha by parsing .git directly. Avoids
 *  shelling out to git for the cheap check. Returns null if not a git repo. */
function readLocalGit() {
  const gitDir = path.join(PROJECT_ROOT, ".git");
  try {
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    // HEAD is either "ref: refs/heads/<branch>" (detached if 40-char sha).
    if (head.startsWith("ref: ")) {
      const ref = head.slice(5).trim();
      const branch = ref.replace(/^refs\/heads\//, "");
      let sha = "";
      const refPath = path.join(gitDir, ref);
      if (fs.existsSync(refPath)) {
        sha = fs.readFileSync(refPath, "utf8").trim();
      } else {
        // Packed refs fallback.
        const packed = path.join(gitDir, "packed-refs");
        if (fs.existsSync(packed)) {
          const lines = fs.readFileSync(packed, "utf8").split("\n");
          for (const line of lines) {
            if (line.endsWith(` ${ref}`)) { sha = line.split(" ")[0]; break; }
          }
        }
      }
      return { branch, sha };
    }
    // Detached HEAD — return the literal sha + null branch.
    return { branch: null, sha: head };
  } catch { return null; }
}

/** Quick check: does git status report any uncommitted changes? */
function checkDirtyTree() {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const git = spawn("git", ["status", "--porcelain"], {
      cwd: PROJECT_ROOT, shell: isWin, stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    git.stdout.on("data", (c) => { out += c.toString(); });
    git.on("close", () => resolve(out.trim().length > 0));
    git.on("error", () => resolve(false));
  });
}

/** Fetch the latest commit on origin's main branch via the GitHub REST API.
 *  No auth needed — public repo. R2 in the rules. */
function fetchLatestFromGitHub() {
  return new Promise((resolve) => {
    const https = require("https");
    const req = https.request(
      {
        host: "api.github.com",
        path: `/repos/${GH_REPO}/commits/main`,
        method: "GET",
        headers: {
          "User-Agent": "OpenAdKit-Updater/1.0",
          Accept: "application/vnd.github+json",
        },
        timeout: 8000,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c.toString(); });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve({
              sha: data.sha,
              message: data?.commit?.message?.split("\n")[0] ?? "(no message)",
              date: data?.commit?.author?.date ?? null,
            });
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { try { req.destroy(); } catch {} resolve(null); });
    req.end();
  });
}

/** Run a shell command in PROJECT_ROOT, append output to update log live,
 *  resolve with { ok, code, output }. Used by the apply pipeline. */
function runCommand(cmd, args, label) {
  return new Promise((resolve) => {
    appendUpdateLog(`▶ ${label || `${cmd} ${args.join(" ")}`}`);
    const isWin = process.platform === "win32";
    const child = spawn(cmd, args, { cwd: PROJECT_ROOT, shell: isWin, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (c) => {
      const s = c.toString();
      output += s;
      for (const line of s.split("\n")) if (line.trim()) appendUpdateLog(`  ${line.trim()}`);
    });
    child.stderr.on("data", (c) => {
      const s = c.toString();
      output += s;
      for (const line of s.split("\n")) if (line.trim()) appendUpdateLog(`  ${line.trim()}`);
    });
    child.on("close", (code) => {
      appendUpdateLog(`${code === 0 ? "✓" : "✗"} ${label || cmd} exited ${code}`);
      resolve({ ok: code === 0, code: code ?? -1, output });
    });
    child.on("error", (e) => {
      appendUpdateLog(`✗ ${label || cmd} failed: ${e.message}`);
      resolve({ ok: false, code: -1, output: e.message });
    });
  });
}

async function applyUpdate() {
  // Set status synchronously BEFORE any await — otherwise two concurrent POSTs
  // both pass the guard, both run git pull + npm install, and the working tree
  // is left in an indeterminate state. (Audit finding #15.)
  if (updateState.status === "applying") {
    return { ok: false, error: "Update already in progress." };
  }
  const priorStatus = updateState.status;
  updateState = { ...updateState, status: "applying" };
  const releaseLock = (err) => {
    // Reset status only when we bail before kicking off the long-running pipeline.
    // After we've started, finishUpdate() owns the status transitions.
    updateState = { ...updateState, status: priorStatus };
    return err;
  };
  // R4: branch lock
  const local = readLocalGit();
  if (!local) return releaseLock({ ok: false, error: "Not a git repository — can't auto-update. Re-clone the repo or pull manually." });
  if (local.branch !== "main") {
    return releaseLock({ ok: false, error: `Current branch is "${local.branch || "(detached)"}", not main. Auto-update only runs on the main branch.` });
  }
  // R5: dirty-tree lock
  const dirty = await checkDirtyTree();
  if (dirty) {
    return releaseLock({ ok: false, error: "Local working tree has uncommitted changes. Commit or stash first, then update." });
  }

  updateState = {
    ...updateState,
    status: "applying",
    log: [],
    started_at: Date.now(),
    finished_at: 0,
    error: null,
  };
  appendUpdateLog(`Starting update on branch "main" from sha ${local.sha.slice(0, 7)}`);

  // R7 step 1: stop web
  if (webChild && !webChild.killed) {
    appendUpdateLog("Stopping web app…");
    stopWeb();
    await new Promise((r) => setTimeout(r, 600));
  }

  // R7 step 2: fetch
  let r = await runCommand("git", ["fetch", "origin", "main"], "git fetch origin main");
  if (!r.ok) return finishUpdate(false, "git fetch failed");

  // R7 step 3: pull --ff-only (no merges, no rebases)
  r = await runCommand("git", ["pull", "--ff-only", "origin", "main"], "git pull --ff-only origin main");
  if (!r.ok) return finishUpdate(false, "git pull failed (likely non-fast-forward — abort instead of force)");

  // R7 step 4: npm install (only if package-lock changed; cheap to always run though)
  r = await runCommand("npm", ["install", "--no-audit", "--no-fund"], "npm install");
  if (!r.ok) return finishUpdate(false, "npm install failed");

  // R7 step 5: wipe .next/
  try {
    const nextDir = path.join(PROJECT_ROOT, ".next");
    if (fs.existsSync(nextDir)) fs.rmSync(nextDir, { recursive: true, force: true });
    appendUpdateLog("✓ wiped .next/ build cache");
  } catch (e) {
    return finishUpdate(false, `Failed to wipe .next: ${e?.message ?? e}`);
  }

  // R7 step 6: restart web
  appendUpdateLog("Starting web app on fresh build…");
  startWeb();

  // Re-read local git so launcher shows the new sha.
  const after = readLocalGit();
  appendUpdateLog(`✓ Update complete. New HEAD: ${after?.sha?.slice(0, 7) ?? "(unknown)"}`);
  return finishUpdate(true, null);
}

function finishUpdate(ok, errMsg) {
  updateState.status = ok ? "done" : "error";
  updateState.error = errMsg;
  updateState.finished_at = Date.now();
  return { ok, error: errMsg };
}

function stopWeb() {
  if (!webChild || webChild.killed) {
    webStatus = "down";
    return { ok: true, was_running: false };
  }
  webStatus = "stopping";
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(webChild.pid), "/F", "/T"]);
    } else {
      webChild.kill("SIGTERM");
      setTimeout(() => { try { webChild?.kill("SIGKILL"); } catch {} }, 2000);
    }
  } catch (e) { /* ignore */ }
  return { ok: true, was_running: true };
}

// --- HTTP server ---
const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  // CSRF enforcement (Critical): every state-changing endpoint here is a POST.
  // Browsers attach an Origin header to all non-GET/HEAD requests, so an
  // attacker's page can trigger the request but its Origin won't match. Reject
  // cross-origin writes; requests with no Origin (curl / start scripts) are
  // non-browser callers and are allowed. Without this, any open browser tab
  // could POST /snapshot (wipe data), /update/apply (git pull + npm install),
  // /quit, /web/rebuild, /config, etc.
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return json(res, 403, { ok: false, error: "Cross-origin request blocked." });
    }
  }
  try {
    const url = req.url || "/";

    if (req.method === "GET" && (url === "/" || url === "/launcher" || url === "/launcher.html")) {
      if (!fs.existsSync(LAUNCHER_HTML)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain");
        res.end("launcher.html not found. Expected at: " + LAUNCHER_HTML);
        return;
      }
      const html = await fsp.readFile(LAUNCHER_HTML, "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(html);
      return;
    }

    if (req.method === "GET" && url === "/health") {
      // capabilities array lets the browser confirm which endpoints this
      // sidecar supports — useful for diagnosing "stale sidecar" issues
      // without having to grep the source.
      // cwd lets OpenAdKit.bat/OpenAdKit.command distinguish "MY install's
      // sidecar" from "SOMEONE ELSE'S install on this same port" — needed
      // for multi-install port routing.
      return json(res, 200, {
        ok: true,
        port: PORT,
        cwd: PROJECT_ROOT,
        capabilities: ["status", "snapshot", "config", "web/start", "web/stop", "web/restart", "web/rebuild", "diagnostics", "update/check", "update/apply", "update/status", "ingest"],
        sidecar_version: "2026.05.7fd6c23+", // bump this when adding new endpoints
        session_token: SESSION_TOKEN,
      });
    }

    if (req.method === "GET" && url === "/status") {
      // Re-probe before returning so the launcher gets fresh data
      tryProbeWeb(webPort, (alive) => {
        if (alive) webStatus = "up";
        else if (webStatus === "up") webStatus = "down";
        json(res, 200, {
          web: webStatus,
          sync: "up",
          web_port: webPort,
          sync_port: PORT,
          web_uptime_ms: webStartedAt ? Date.now() - webStartedAt : 0,
          web_last_log: webLastLog,
        });
      });
      return;
    }

    if (req.method === "POST" && url === "/web/start") {
      return json(res, 200, startWeb());
    }
    if (req.method === "POST" && url === "/web/stop") {
      return json(res, 200, stopWeb());
    }
    if (req.method === "POST" && url === "/web/restart") {
      stopWeb();
      // Windows taskkill is fire-and-forget — the child only nulls out on its
      // own `exit` event. Poll until that fires (up to 8s) before restarting,
      // otherwise the new startWeb() sees the old child still alive and bails
      // with "already running". (Audit finding #35.)
      (async () => {
        const deadline = Date.now() + 8000;
        while (webChild && !webChild.killed && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
        }
        startWeb();
      })();
      return json(res, 200, { ok: true });
    }
    // --- Update endpoints (auto-update from GitHub main) ---
    if (req.method === "GET" && url === "/update/check") {
      // R3 + R4: read local sha + branch, refuse on non-main branches.
      const local = readLocalGit();
      if (!local) {
        return json(res, 200, {
          status: "unsupported",
          reason: "Not a git checkout — cannot auto-update. Use the original installer to refresh.",
        });
      }
      if (local.branch !== "main") {
        return json(res, 200, {
          status: "branch_locked",
          branch: local.branch,
          current_sha: local.sha,
          reason: `Auto-update only runs on the main branch. You're on "${local.branch || "(detached)"}".`,
        });
      }
      const dirty = await checkDirtyTree();
      updateState.dirty = dirty;
      updateState.current_sha = local.sha;
      updateState.branch = local.branch;
      const latest = await fetchLatestFromGitHub();
      if (!latest) {
        return json(res, 200, {
          status: "network_error",
          current_sha: local.sha,
          branch: local.branch,
          dirty,
          reason: "Couldn't reach GitHub. Check your internet connection and try again.",
        });
      }
      updateState.latest_sha = latest.sha;
      updateState.latest_commit_message = latest.message;
      updateState.latest_commit_date = latest.date;
      const available = latest.sha && latest.sha !== local.sha;
      updateState.status = available ? "available" : "idle";
      return json(res, 200, {
        status: updateState.status,
        update_available: available,
        current_sha: local.sha,
        latest_sha: latest.sha,
        latest_commit_message: latest.message,
        latest_commit_date: latest.date,
        branch: local.branch,
        dirty,
        // R5 hint — if dirty, the apply endpoint will refuse. Surface that here too.
        blocked_reason: dirty ? "Working tree has uncommitted changes. Commit or stash first." : null,
      });
    }

    if (req.method === "POST" && url === "/update/apply") {
      // Don't await — kick off the job and return immediately. Launcher polls
      // /update/status for progress. Saves the user from a 60s blocked request.
      applyUpdate().catch((e) => {
        finishUpdate(false, e?.message ?? "Unknown error during update");
      });
      return json(res, 200, { ok: true, started: true });
    }

    if (req.method === "GET" && url === "/update/status") {
      return json(res, 200, {
        ...updateState,
        // Trim the log when serializing — last 60 lines is plenty for the
        // launcher UI; full log stays in memory if anyone debugs further.
        log: updateState.log.slice(-60),
      });
    }

    // --- URL ingest fallback via the sidecar (bypasses Jina rate limits + browser CORS) ---
    // Browser-side url-ingest calls this when external readers are blocked.
    // We fetch the target URL server-side (no CORS, no Jina quota) and return
    // a lightly-stripped text version the AI can read directly.
    if (req.method === "GET" && url.startsWith("/ingest")) {
      const u = new URL(req.url || "", `http://127.0.0.1`);
      const target = u.searchParams.get("url");
      if (!target) return json(res, 400, { ok: false, error: "Missing url param." });
      let parsed;
      try { parsed = new URL(target); } catch { return json(res, 400, { ok: false, error: "Invalid url." }); }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return json(res, 400, { ok: false, error: "Only http/https URLs supported." });
      }
      // SSRF guard on the initial URL. (Audit finding #13.)
      if (isPrivateOrLoopbackHost(parsed.hostname)) {
        return json(res, 400, { ok: false, error: "Private / loopback / link-local hosts are not allowed." });
      }
      let body = "";
      let redirects = 0;
      // Cap remote body at 500 KB — extractMetadata + strip pipeline runs ~10x the raw size in memory.
      // Old 1.5 MB silent-truncate wasted CPU and risked OOM on adversarial input. (Audit finding #36.)
      const MAX_REMOTE_BYTES = 500_000;
      const fetchOnce = (targetUrl) => new Promise((resolve, reject) => {
        // Re-validate scheme + private-host on every hop. Redirect chains can otherwise
        // point at 169.254.169.254 (AWS IMDS), intranet, etc.
        let u;
        try { u = new URL(targetUrl); } catch { return reject(new Error("Invalid redirect target")); }
        if (u.protocol !== "http:" && u.protocol !== "https:") return reject(new Error("Non-http(s) redirect blocked"));
        if (isPrivateOrLoopbackHost(u.hostname)) return reject(new Error("Redirect to private host blocked"));
        // DNS-level SSRF guard: resolve the host and reject if ANY resolved
        // address is private/loopback/link-local. Closes decimal/hex IP
        // encodings and DNS-rebinding that the hostname-string check can't see.
        return dns.lookup(u.hostname, { all: true }, (dnsErr, addresses) => {
        if (dnsErr || !addresses || !addresses.length) return reject(new Error("DNS resolution failed for target host"));
        if (addresses.some((a) => isPrivateOrLoopbackHost(a.address))) return reject(new Error("Target host resolves to a private / loopback address"));
        const lib = u.protocol === "https:" ? require("https") : require("http");
        const opts = {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OpenAdKit/1.0; +https://github.com/IamRamgarhia/AdForge)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          timeout: 15000,
        };
        const r = lib.get(targetUrl, opts, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && redirects < 5) {
            redirects++;
            const next = new URL(resp.headers.location, targetUrl).toString();
            return resolve(fetchOnce(next));
          }
          if (resp.statusCode < 200 || resp.statusCode >= 400) {
            return reject(new Error(`HTTP ${resp.statusCode} from target`));
          }
          let raw = "";
          let tooLarge = false;
          resp.setEncoding("utf8");
          resp.on("data", (c) => {
            if (tooLarge) return;
            raw += c;
            if (raw.length > MAX_REMOTE_BYTES) {
              tooLarge = true;
              resp.destroy();
              reject(new Error(`Remote body exceeded ${MAX_REMOTE_BYTES} bytes`));
            }
          });
          resp.on("end", () => { if (!tooLarge) resolve(raw); });
        });
        r.on("error", reject);
        r.on("timeout", () => { r.destroy(); reject(new Error("Timeout after 15s")); });
        });
      });
      try {
        body = await fetchOnce(target);
      } catch (e) {
        return json(res, 502, { ok: false, error: e?.message || "Fetch failed" });
      }

      // Extract structured metadata BEFORE stripping HTML. Everything in <head>
      // (title, description, OG tags, favicon, JSON-LD organization data) and
      // every social-media anchor href is high-signal for brand-brain
      // extraction. Stripping them away first was throwing out the best data.
      const metadata = extractMetadata(body, target);

      // Now strip HTML to plain text for the body content.
      const text = body
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<head[\s\S]*?<\/head>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      const MAX = 40000;
      const trimmed = text.length > MAX ? text.slice(0, MAX) : text;
      return json(res, 200, {
        ok: true,
        url: target,
        content: trimmed,
        truncated: text.length > MAX,
        source: "sidecar",
        metadata,
      });
    }

    if (req.method === "POST" && url === "/web/rebuild") {
      // Clean rebuild: stop web → wipe .next → start fresh. Fixes
      // "CSS not loading / page renders unstyled" caused by stale chunk refs.
      const result = cleanRebuild();
      if (!result.ok) return json(res, 500, result);
      // Wait a beat for the FS to settle then restart.
      setTimeout(() => startWeb(), 800);
      return json(res, 200, { ok: true, deleted_next_cache: true, restart_initiated: true });
    }
    if (req.method === "POST" && url === "/quit") {
      // Stop the web child, ack to the caller, then exit the sidecar.
      stopWeb();
      json(res, 200, { ok: true, bye: true });
      setTimeout(() => { try { server.close(); } catch {} process.exit(0); }, 250);
      return;
    }

    if (req.method === "GET" && url === "/config") {
      return json(res, 200, readEnvLocal());
    }
    if (req.method === "GET" && url === "/diagnostics") {
      let pkgVersion = "unknown";
      try { pkgVersion = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")).version || "unknown"; } catch {}
      return json(res, 200, {
        openadkit_version: pkgVersion,
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        os_release: os.release(),
        os_type: os.type(),
        web_status: webStatus,
        web_port: webPort,
        sync_port: PORT,
        web_pid: webChild?.pid ?? null,
        web_uptime_ms: webStartedAt ? Date.now() - webStartedAt : 0,
        web_last_log: webLastLog,
        cwd: PROJECT_ROOT,
        timestamp: new Date().toISOString(),
      });
    }
    if (req.method === "POST" && url === "/config") {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body); } catch { return json(res, 400, { ok: false, error: "invalid json" }); }
      // Validate as ports — refuse junk like "../../evil" or "99999" before writing .env.local. (Audit finding #16.)
      const current = readEnvLocal();
      const portIn = envPort(parsed.PORT, null);
      const syncPortIn = envPort(parsed.ADFORGE_SYNC_PORT, null);
      if (parsed.PORT !== undefined && portIn === null) {
        return json(res, 400, { ok: false, error: "PORT must be an integer 1-65535." });
      }
      if (parsed.ADFORGE_SYNC_PORT !== undefined && syncPortIn === null) {
        return json(res, 400, { ok: false, error: "ADFORGE_SYNC_PORT must be an integer 1-65535." });
      }
      const next = writeEnvLocal({
        PORT: String(portIn ?? current.PORT),
        ADFORGE_SYNC_PORT: String(syncPortIn ?? current.ADFORGE_SYNC_PORT),
      });
      return json(res, 200, { ok: true, env: next, restart_required: true });
    }

    if (req.method === "GET" && url === "/snapshot") {
      await ensureDataDir();
      let body = "{}";
      if (fs.existsSync(SNAPSHOT_PATH)) body = await fsp.readFile(SNAPSHOT_PATH, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.end(body || "{}");
      return;
    }
    if (req.method === "POST" && url === "/snapshot") {
      await ensureDataDir();
      const body = await readBody(req);
      try { JSON.parse(body); } catch { return json(res, 400, { ok: false, error: "invalid json" }); }
      const tmp = SNAPSHOT_PATH + ".tmp";
      await fsp.writeFile(tmp, body, "utf8");
      await fsp.rename(tmp, SNAPSHOT_PATH);
      return json(res, 200, { ok: true, bytes: Buffer.byteLength(body) });
    }

    return json(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e?.message ?? e) });
  }
});

// Pick up the configured web port at boot so /status is correct
// before the user clicks Start.
try { webPort = envPort(readEnvLocal().PORT, 41573); } catch {}

// Single-instance lock. If another sidecar from THIS install is already
// running (same PID still alive), exit early — the launcher script will
// open the browser. Prevents the "user double-clicks OpenAdKit.bat twice in
// 2 seconds" race where two processes both try to writeEnvLocal.
const LOCK_FILE = path.join(DATA_DIR, ".openadkit.pid");
function acquireSingletonLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const oldPid = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
      if (oldPid > 0) {
        try {
          // Signal 0 → exists check, throws ESRCH if dead. Cross-platform.
          process.kill(oldPid, 0);
          // Process alive → another instance owns the lock.
          console.error(`[openadkit] another sidecar (pid ${oldPid}) is already running for this install. Exiting.`);
          process.exit(0);
        } catch {
          // Process dead → stale lock, safe to take over.
        }
      }
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");
    const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
    process.on("exit", cleanup);
    process.on("SIGINT", () => { cleanup(); process.exit(0); });
    process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  } catch (e) {
    // Non-fatal — if the lockfile can't be created, fall through and let
    // listen() fail with EADDRINUSE if there really is a duplicate.
    console.warn(`[openadkit] could not acquire singleton lock: ${e?.message ?? e}`);
  }
}
acquireSingletonLock();

// Session token bumps every time the sidecar starts. The browser polls
// /health (via /status), sees a new SESSION_TOKEN, and reloads itself.
// That means "user clicks OpenAdKit.bat after a system restart" gives them
// a fresh page in the already-open browser tab — no manual refresh needed.
const SESSION_TOKEN = String(Date.now());

// Surface EADDRINUSE clearly — resolve-ports.cjs has a TOCTOU window between
// the port-free probe and listen(). If another process grabs the port in that
// window, this is the only place the user gets a clear message. (Audit finding #42.)
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[openadkit] FATAL: port ${PORT} is already in use.`);
    console.error("[openadkit] Another OpenAdKit install or process bound it between the launcher's port-free check and this listen() call.");
    console.error("[openadkit] Re-run OpenAdKit.bat / OpenAdKit.command — resolve-ports.cjs will pick a fresh free pair on the next try.");
    process.exit(1);
  }
  console.error("[openadkit] server error:", err);
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[openadkit] launcher + sync listening on http://127.0.0.1:${PORT}`);
  console.log(`[openadkit] open the launcher: http://127.0.0.1:${PORT}/`);
  console.log(`[openadkit] snapshot file:     ${SNAPSHOT_PATH}`);
  // Truly-one-click UX: spawn the Next dev server as soon as the sidecar is
  // up so the user doesn't have to click "Start" in the launcher panel.
  // The launcher's own buttons still work for stop / restart / clean rebuild,
  // but the first paint after double-click is the app itself, not a control
  // panel. Opt-out via ADFORGE_NO_AUTOSTART=1 for power users who want to
  // edit code before the dev server boots.
  if (process.env.ADFORGE_NO_AUTOSTART !== "1") {
    console.log("[openadkit] auto-starting Next dev server (set ADFORGE_NO_AUTOSTART=1 to disable)");
    const res = startWeb();
    if (!res.ok) {
      console.warn(`[openadkit] auto-start failed (non-fatal): ${res.error}. Use the launcher to retry.`);
    }
  }
});

process.on("SIGINT", () => { stopWeb(); console.log("[openadkit] shutting down"); server.close(() => process.exit(0)); });
process.on("SIGTERM", () => { stopWeb(); server.close(() => process.exit(0)); });
