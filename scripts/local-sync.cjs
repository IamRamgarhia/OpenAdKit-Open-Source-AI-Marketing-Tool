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
      return json(res, 200, { ok: true, port: PORT });
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
