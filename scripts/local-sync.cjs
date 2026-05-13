#!/usr/bin/env node
/**
 * AdForge local-sync + launcher sidecar.
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
const { spawn } = require("child_process");

const PORT = Number(process.env.ADFORGE_SYNC_PORT || process.env.ADOS_SYNC_PORT || 3006);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "snapshot.json");
const LAUNCHER_HTML = path.join(PROJECT_ROOT, "public", "launcher.html");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const MAX_BODY = 25 * 1024 * 1024;

// --- State ---
let webChild = null;
let webStatus = "down"; // 'down' | 'starting' | 'up' | 'stopping'
let webPort = 3005; // overwritten from .env.local right below
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
  console.log(`[adforge:update] ${line}`);
}
const GH_REPO = "IamRamgarhia/AdForge"; // public, no auth required

// --- Helpers ---
function envPort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : fallback;
}

function readEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) return { PORT: "3005", ADFORGE_SYNC_PORT: String(PORT) };
  const out = {};
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return { PORT: out.PORT || "3005", ADFORGE_SYNC_PORT: out.ADFORGE_SYNC_PORT || String(PORT) };
}

function writeEnvLocal(updates) {
  const current = readEnvLocal();
  const next = { ...current, ...updates };
  const body = [
    "# AdForge configuration (managed by the launcher)",
    `PORT=${next.PORT}`,
    `ADFORGE_SYNC_PORT=${next.ADFORGE_SYNC_PORT}`,
  ].join("\n") + "\n";
  fs.writeFileSync(ENV_LOCAL, body, "utf8");
  return next;
}

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) await fsp.mkdir(DATA_DIR, { recursive: true });
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  else res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
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
  webPort = Number(env.PORT) || 3005;
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
    console.log(`[adforge] next dev exited with code ${code}`);
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
          "User-Agent": "AdForge-Updater/1.0",
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
  if (updateState.status === "applying") {
    return { ok: false, error: "Update already in progress." };
  }
  // R4: branch lock
  const local = readLocalGit();
  if (!local) return { ok: false, error: "Not a git repository — can't auto-update. Re-clone the repo or pull manually." };
  if (local.branch !== "main") {
    return { ok: false, error: `Current branch is "${local.branch || "(detached)"}", not main. Auto-update only runs on the main branch.` };
  }
  // R5: dirty-tree lock
  const dirty = await checkDirtyTree();
  if (dirty) {
    return { ok: false, error: "Local working tree has uncommitted changes. Commit or stash first, then update." };
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
      return json(res, 200, {
        ok: true,
        port: PORT,
        capabilities: ["status", "snapshot", "config", "web/start", "web/stop", "web/restart", "web/rebuild", "diagnostics", "update/check", "update/apply", "update/status", "ingest"],
        sidecar_version: "2026.05.de6d6df+", // bump this when adding new endpoints
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
      setTimeout(() => startWeb(), 1200);
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
      const https = parsed.protocol === "https:" ? require("https") : require("http");
      let body = "";
      let redirects = 0;
      const fetchOnce = (targetUrl) => new Promise((resolve, reject) => {
        const opts = {
          headers: {
            // Pretend to be a real browser — many sites short-circuit non-UA requests.
            "User-Agent": "Mozilla/5.0 (compatible; AdForge/1.0; +https://github.com/IamRamgarhia/AdForge)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          timeout: 15000,
        };
        const r = https.get(targetUrl, opts, (resp) => {
          // Follow up to 5 redirects (Cloudflare and friends frequently bounce).
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && redirects < 5) {
            redirects++;
            const next = new URL(resp.headers.location, targetUrl).toString();
            return resolve(fetchOnce(next));
          }
          if (resp.statusCode < 200 || resp.statusCode >= 400) {
            return reject(new Error(`HTTP ${resp.statusCode} from target`));
          }
          let raw = "";
          resp.setEncoding("utf8");
          resp.on("data", (c) => { raw += c; if (raw.length > 1_500_000) { resp.destroy(); resolve(raw); } });
          resp.on("end", () => resolve(raw));
        });
        r.on("error", reject);
        r.on("timeout", () => { r.destroy(); reject(new Error("Timeout after 15s")); });
      });
      try {
        body = await fetchOnce(target);
      } catch (e) {
        return json(res, 502, { ok: false, error: e?.message || "Fetch failed" });
      }
      // Strip HTML to plain text — naive but good enough for AI ingestion.
      // The browser side does a fancier DOMParser-based version when needed.
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
        adforge_version: pkgVersion,
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
      const next = writeEnvLocal({
        PORT: String(parsed.PORT || readEnvLocal().PORT),
        ADFORGE_SYNC_PORT: String(parsed.ADFORGE_SYNC_PORT || readEnvLocal().ADFORGE_SYNC_PORT),
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
try { webPort = envPort(readEnvLocal().PORT, 3005); } catch {}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[adforge] launcher + sync listening on http://127.0.0.1:${PORT}`);
  console.log(`[adforge] open the launcher: http://127.0.0.1:${PORT}/`);
  console.log(`[adforge] snapshot file:     ${SNAPSHOT_PATH}`);
});

process.on("SIGINT", () => { stopWeb(); console.log("[adforge] shutting down"); server.close(() => process.exit(0)); });
process.on("SIGTERM", () => { stopWeb(); server.close(() => process.exit(0)); });
