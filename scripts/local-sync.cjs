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
 *      GET  /config        → returns current PORT + OPENADKIT_SYNC_PORT from .env.local
 *      POST /config        → updates .env.local (port + sync port)
 *      GET  /health        → liveness probe
 *
 * Bound to 127.0.0.1 only — never network-reachable.
 *
 * Env (OPENADKIT_* preferred; legacy ADFORGE_* still read as a fallback):
 *   OPENADKIT_SYNC_PORT   (ADFORGE_SYNC_PORT, ADOS_SYNC_PORT)  listen port
 *   OPENADKIT_DATA_DIR    (ADFORGE_DATA_DIR)                   snapshot dir
 *   OPENADKIT_NO_AUTOSTART=1 (ADFORGE_NO_AUTOSTART)            don't spawn web
 *
 * THREAT MODEL / AUTH: there is deliberately no token or password. The guards
 * below (Host allow-list against DNS rebinding, Origin allow-list against
 * cross-site POSTs, 127.0.0.1-only bind) are designed to stop *browsers* —
 * i.e. a malicious web page open in any tab. They do NOT stop another local,
 * non-browser process running as any user on this machine: such a process can
 * send whatever Host/Origin it likes (or none) and read/write the snapshot,
 * change ports, or trigger /update/apply. That is accepted: a local process
 * already has the same access to the user's files and browser profile. Do not
 * expose this port beyond loopback (no port-forwarding, no 0.0.0.0 bind).
 *
 * Run:   node scripts/local-sync.cjs
 * Stop:  Ctrl+C
 */

const releaseUpdate = require("./release-update.cjs");
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
// Env naming: OPENADKIT_* is canonical; the pre-rebrand ADFORGE_* (and the
// even older ADOS_*) names are still honoured as fallbacks so existing
// launchers, .env.local files and shell profiles keep working.
function envFirst(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}
const PORT = Number(envFirst("OPENADKIT_SYNC_PORT", "ADFORGE_SYNC_PORT", "ADOS_SYNC_PORT") || 41574);
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
  const override = envFirst("OPENADKIT_DATA_DIR", "ADFORGE_DATA_DIR");
  if (override) return override;
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
const IS_MAIN = require.main === module;
// Requiring this file (tests) must not touch the user's data dir.
if (IS_MAIN) migrateLegacyDataDirOnce();
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
const GH_REPO = "IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool"; // public, no auth required

// --- Helpers ---
function envPort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : fallback;
}

/**
 * The web app's port. An explicit PORT in the environment wins — the
 * launchers, installers and the Windows host all pass the port they chose —
 * then .env.local (source installs), then the default. readEnvLocal() fills
 * in a default PORT when the file is missing, so it must not come first or
 * a packaged app's chosen port would be silently ignored.
 */
function configuredWebPort() {
  return envPort(process.env.PORT, null) ?? envPort(readEnvLocal().PORT, 41573);
}

function readEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) {
    return { PORT: "41573", OPENADKIT_SYNC_PORT: String(PORT), ADFORGE_SYNC_PORT: String(PORT) };
  }
  const out = {};
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  const sync = out.OPENADKIT_SYNC_PORT || out.ADFORGE_SYNC_PORT || String(PORT);
  // Both names are returned (same value) so older launcher.html builds that
  // read ADFORGE_SYNC_PORT keep working.
  return { PORT: out.PORT || "41573", OPENADKIT_SYNC_PORT: sync, ADFORGE_SYNC_PORT: sync };
}

function writeEnvLocal(updates) {
  const current = readEnvLocal();
  const next = { ...current, ...updates };
  const syncPort = updates.OPENADKIT_SYNC_PORT || updates.ADFORGE_SYNC_PORT || current.OPENADKIT_SYNC_PORT;
  next.OPENADKIT_SYNC_PORT = syncPort;
  next.ADFORGE_SYNC_PORT = syncPort;
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
  setKey("OPENADKIT_SYNC_PORT", syncPort);
  setKey("ADFORGE_SYNC_PORT", syncPort); // legacy name, kept for older scripts
  // Browser-visible mirror — Next only inlines NEXT_PUBLIC_* names, and the web
  // app needs the sidecar port to talk to us at all. Must stay in lockstep with
  // the sync port. See lib/sync-endpoint.ts.
  setKey("NEXT_PUBLIC_OPENADKIT_SYNC_PORT", syncPort);
  setKey("NEXT_PUBLIC_ADFORGE_SYNC_PORT", syncPort);
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
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return false;
    const p = Number(u.port);
    if (!Number.isFinite(p)) return false;
    // ONLY this install's two ports. The previous version also accepted
    // anything on 3000-3030 "in case ports get shifted" — but 3000-3010 is
    // where nearly every local dev server lives (Next, Vite, Rails, Flask), so
    // any page served by one of those could POST /update/apply (git pull + npm
    // install => arbitrary code execution), /quit, /config, /web/rebuild, or
    // /snapshot (overwrite all user data). The port resolver now keeps us out
    // of that range entirely, so the tolerance was pure attack surface.
    // Ports are re-read from .env.local per request (see refreshPorts) so a
    // shift doesn't require a restart to be honoured.
    return p === webPort || p === PORT;
  } catch {
    return false;
  }
}

/**
 * DNS-rebinding guard.
 *
 * Binding to 127.0.0.1 stops remote *network* access but not a remote *page*:
 * an attacker's domain with a short TTL can resolve to 127.0.0.1, at which
 * point the browser treats requests to it as same-origin and CORS never
 * applies. Origin checks don't help either — GETs legitimately carry no Origin.
 *
 * The Host header is the one thing the attacker can't forge here: it carries
 * the name the browser dialled, so `evil.com:PORT` is rejected while
 * `127.0.0.1:PORT` is allowed. Without this, GET /snapshot (every brand brain,
 * all ad history, and API keys when key-sync is enabled) and GET /config were
 * readable cross-origin.
 */
function isAllowedHost(hostHeader) {
  if (!hostHeader) return false;
  // Strip the port; handle bracketed IPv6 literals.
  const host = String(hostHeader).trim().toLowerCase();
  const name = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0];
  return name === "127.0.0.1" || name === "localhost" || name === "[::1]" || name === "::1";
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
// either on the initial URL, on any redirect target, or on any address the
// target resolves to. (Audit finding #13.)
//
// KEEP IN LOCKSTEP with isPrivateOrLoopbackHost() in lib/server/url-helpers.ts
// (this file is CommonJS and can't import the TS one). Both are exercised
// against the same table in lib/__tests__/sidecar.test.ts.
function isPrivateOrLoopbackHost(hostname) {
  if (!hostname) return true;
  let h = String(hostname).toLowerCase();
  // URL.hostname returns IPv6 literals WITH brackets ("[::1]").
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h === "localhost" || h === "ip6-localhost" || h === "ip6-loopback") return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or hex-compressed ::ffff:7f00:1):
  // unwrap the embedded IPv4 and validate it against the IPv4 rules below.
  const mapped = h.match(/^::ffff:([0-9a-f:.]+)$/i);
  if (mapped) {
    const v4 = mappedIPv6ToIPv4(mapped[1]);
    if (v4) h = v4;
  }
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // 169.254.0.0/16 — link-local, includes cloud metadata (169.254.169.254).
  if (/^169\.254\./.test(h)) return true;
  if (/^0\./.test(h)) return true;
  // 100.64.0.0/10 — carrier-grade NAT (RFC 6598; Tailscale, k8s CNIs, …).
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  // 192.0.0.0/24 (IETF protocol assignments), 198.18.0.0/15 (benchmarking).
  if (/^192\.0\.0\./.test(h)) return true;
  if (/^198\.1[89]\./.test(h)) return true;
  // Multicast (224.0.0.0/4) and reserved/broadcast (240.0.0.0/4).
  if (/^(22[4-9]|2[3-5]\d)\.\d/.test(h)) return true;
  if (h === "::1" || h === "::") return true;
  // IPv6 link-local (fe80::/10) and unique-local (fc00::/7).
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
  // IPv6 multicast (ff00::/8).
  if (/^ff[0-9a-f]{2}:/i.test(h)) return true;
  return false;
}

function mappedIPv6ToIPv4(embedded) {
  if (embedded.includes(".")) return embedded;
  const groups = embedded.split(":").filter((g) => g.length > 0);
  if (groups.length === 0 || groups.length > 2) return null;
  let value = 0;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    value = ((value << 16) | parseInt(g, 16)) >>> 0;
  }
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(".");
}

/**
 * A `lookup` for http(s).request that only ever returns addresses we already
 * validated. Without it the request does its own, second DNS lookup after the
 * SSRF check — a 0-TTL hostile record can answer the check with a public IP
 * and the connection with 127.0.0.1 / 169.254.169.254 (DNS rebinding TOCTOU).
 * Mirrors pinnedLookup() in app/api/ingest/route.ts.
 */
function pinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    const cb = typeof options === "function" ? options : callback;
    const wantsAll = typeof options === "object" && options !== null && options.all;
    const safe = addresses.filter((a) => !isPrivateOrLoopbackHost(a.address));
    if (!safe.length) return cb(new Error("Private / loopback / link-local host blocked"));
    if (wantsAll) return cb(null, safe);
    return cb(null, safe[0].address, safe[0].family);
  };
}

const INGEST_USER_AGENT =
  "Mozilla/5.0 (compatible; OpenAdKit/1.0; +https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool)";

function defaultResolve(hostname) {
  return dns.promises.lookup(hostname, { all: true });
}

function defaultRequest(protocol, options, onResponse) {
  const lib = protocol === "https:" ? require("https") : require("http");
  return lib.request(options, onResponse);
}

/**
 * Fetch a public http(s) URL server-side with SSRF protection.
 *
 * Every hop (initial URL + each redirect): scheme check, literal-host check,
 * DNS resolution with every address checked, then the connection is made with
 * the vetted addresses PINNED via `lookup` so no second resolution happens.
 * Redirect bodies are drained (res.resume()) so sockets are released, and a
 * chain longer than maxRedirects is an explicit error — never "return the
 * 3xx body as page content".
 *
 * `deps.request(protocol, options, onResponse)` and `deps.resolve(hostname)`
 * are injectable for tests.
 */
async function fetchRemote(targetUrl, deps = {}) {
  const request = deps.request || defaultRequest;
  const resolve = deps.resolve || defaultResolve;
  const maxRedirects = deps.maxRedirects ?? 5;
  const maxBytes = deps.maxBytes ?? 500_000;
  const timeoutMs = deps.timeoutMs ?? 15_000;

  let current = targetUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let u;
    try { u = new URL(current); } catch { throw new Error("Invalid redirect target"); }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Non-http(s) URL blocked");
    if (isPrivateOrLoopbackHost(u.hostname)) throw new Error("Private / loopback / link-local host blocked");

    let addresses;
    try { addresses = await resolve(u.hostname.replace(/^\[|\]$/g, "")); } catch { addresses = null; }
    if (!addresses || !addresses.length) throw new Error("DNS resolution failed for target host");
    if (addresses.some((a) => isPrivateOrLoopbackHost(a.address))) {
      throw new Error("Target host resolves to a private / loopback address");
    }

    const res = await new Promise((resolveHop, rejectHop) => {
      let settled = false;
      const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
      const req = request(
        u.protocol,
        {
          protocol: u.protocol,
          hostname: u.hostname.replace(/^\[|\]$/g, ""),
          port: u.port || (u.protocol === "https:" ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          method: "GET",
          lookup: pinnedLookup(addresses),
          // SNI/Host stay the original name even though we dial a pinned IP.
          servername: u.protocol === "https:" ? u.hostname : undefined,
          headers: {
            Host: u.host,
            "User-Agent": INGEST_USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        },
        (resp) => {
          const status = resp.statusCode || 0;
          if (status >= 300 && status < 400) {
            // Drain + discard so the socket is released back / closed.
            resp.resume();
            return done(resolveHop, { status, location: resp.headers.location || null, body: "" });
          }
          if (status < 200 || status >= 400) {
            resp.resume();
            return done(rejectHop, new Error(`HTTP ${status} from target`));
          }
          let raw = "";
          resp.setEncoding("utf8");
          resp.on("data", (c) => {
            if (settled) return;
            raw += c;
            if (raw.length > maxBytes) {
              resp.destroy();
              done(rejectHop, new Error(`Remote body exceeded ${maxBytes} bytes`));
            }
          });
          resp.on("end", () => done(resolveHop, { status, location: null, body: raw }));
          resp.on("error", (e) => done(rejectHop, e));
        }
      );
      req.on("error", (e) => done(rejectHop, e));
      if (typeof req.setTimeout === "function") {
        req.setTimeout(timeoutMs, () => {
          try { req.destroy(); } catch {}
          done(rejectHop, new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s`));
        });
      }
      req.end();
    });

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`Redirect ${res.status} without Location header`);
      current = new URL(res.location, current).toString();
      continue;
    }
    return res.body;
  }
  throw new Error(`Too many redirects (max ${maxRedirects})`);
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

/**
 * Decide how to run the web app. Production (`node server.js` from the
 * standalone bundle) is the default: it starts in ~1s and uses a fraction of
 * the memory of `next dev`. Dev mode is only used when no build exists or when
 * OPENADKIT_WEB_MODE=dev is set (contributors).
 *   - Packaged installs: PROJECT_ROOT is the standalone payload → ./server.js
 *   - Git checkouts after `npm run build`: ./.next/standalone/server.js
 */
/** Where this install's MCP server lives, so Settings can show the exact
 *  Claude Desktop / Claude Code / Cursor config (via /api/runtime). */
function mcpEnv() {
  const candidates = [
    path.join(PROJECT_ROOT, "mcp", "openadkit-mcp.mjs"), // installed app
    path.join(PROJECT_ROOT, "mcp", "dist", "openadkit-mcp.mjs"), // source checkout after build:mcp
  ];
  const script = candidates.find((f) => fs.existsSync(f));
  return script ? { OPENADKIT_MCP_SCRIPT: script, OPENADKIT_NODE: process.execPath } : {};
}

function resolveWebCommand(port) {
  const isWin = process.platform === "win32";
  const wantDev = String(process.env.OPENADKIT_WEB_MODE || "").toLowerCase() === "dev";
  if (!wantDev) {
    const candidates = [
      path.join(PROJECT_ROOT, "server.js"),
      path.join(PROJECT_ROOT, ".next", "standalone", "server.js"),
    ];
    for (const server of candidates) {
      if (fs.existsSync(server)) {
        return {
          mode: "production",
          cmd: process.execPath,
          args: [server],
          cwd: path.dirname(server),
          shell: false,
          // OPENADKIT_SYNC_PORT lets the web server tell the browser where this
          // sidecar is (app/api/runtime), whatever port was baked in at build.
          env: { NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1", OPENADKIT_SYNC_PORT: String(PORT), ...mcpEnv() },
        };
      }
    }
  }
  return {
    mode: "dev",
    cmd: isWin ? "npx.cmd" : "npx",
    args: ["next", "dev", "-p", String(port)],
    cwd: PROJECT_ROOT,
    shell: isWin,
    env: { PORT: String(port), OPENADKIT_SYNC_PORT: String(PORT), ...mcpEnv() },
  };
}
let webMode = "down";
const lastLines = (s) => s.trim().split(/\r?\n/).slice(-3).join("\n");

function startWeb() {
  if (webChild) {
    return { ok: false, error: "already running" };
  }
  webPort = configuredWebPort();
  webStatus = "starting";
  webStartedAt = Date.now();
  webLastLog = "";

  const run = resolveWebCommand(webPort);
  webMode = run.mode;
  const child = spawn(run.cmd, run.args, {
    cwd: run.cwd,
    env: { ...process.env, ...run.env },
    shell: run.shell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  webChild = child;

  child.stdout.on("data", (b) => {
    const s = b.toString();
    process.stdout.write(`[web] ${s}`);
    webLastLog = lastLines(s);
  });
  child.stderr.on("data", (b) => {
    const s = b.toString();
    process.stderr.write(`[web-err] ${s}`);
    webLastLog = lastLines(s);
  });
  child.on("exit", (code) => {
    console.log(`[openadkit] web (${run.mode}) exited with code ${code}`);
    // Only clear state if this is still the tracked child. A restart may have
    // already spawned a replacement; the old child's exit must not mark the
    // new one as down.
    if (webChild === child) {
      webChild = null;
      webStatus = "down";
    }
  });

  // Poll for "up". Production boots in about a second; dev can take a while
  // on first compile.
  const deadlineMs = run.mode === "production" ? 30_000 : 90_000;
  const tick = () => {
    if (webChild !== child) return;
    tryProbeWeb(webPort, (alive) => {
      if (webChild !== child) return;
      if (alive) { webStatus = "up"; return; }
      if (Date.now() - webStartedAt < deadlineMs) setTimeout(tick, 500);
      else webStatus = "down";
    });
  };
  setTimeout(tick, run.mode === "production" ? 400 : 1500);

  return { ok: true, pid: child.pid, port: webPort, mode: run.mode };
}

// --- Linear-time HTML helpers ---------------------------------------------
// Hand-copied CommonJS port of stripHtml / extractMetadata from
// lib/server/url-helpers.ts — KEEP IN LOCKSTEP. Both use indexOf / literal
// searches only, so cost is O(n) however malformed the body is. The previous
// lazy `[\s\S]*?` / `[^>]*` regexes re-scanned to the end of the body from
// every unclosed tag: 500 KB of "<script" pinned the sidecar's CPU for
// minutes (DoS). Tested in lib/__tests__/sidecar.test.ts.
const TAG_NAME_CHAR = /[a-z0-9-]/i;

function indexOfCI(haystack, needle, from) {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "gi");
  re.lastIndex = from;
  const m = re.exec(haystack);
  return m ? m.index : -1;
}

function removeBlocks(s, tag) {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const start = indexOfCI(s, open, i);
    if (start < 0) break;
    const after = s.charAt(start + open.length);
    if (after && TAG_NAME_CHAR.test(after)) {
      out += s.slice(i, start + 1);
      i = start + 1;
      continue;
    }
    const end = indexOfCI(s, close, start + open.length);
    if (end < 0) break;
    out += s.slice(i, start);
    i = end + close.length;
  }
  return out + s.slice(i);
}

function replaceTags(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) break;
    const gt = s.indexOf(">", lt + 1);
    if (gt < 0) break;
    if (gt === lt + 1) {
      out += s.slice(i, lt + 1);
      i = lt + 1;
      continue;
    }
    out += s.slice(i, lt) + " ";
    i = gt + 1;
  }
  return out + s.slice(i);
}

function stripHtml(html) {
  let s = removeBlocks(html, "script");
  s = removeBlocks(s, "style");
  s = removeBlocks(s, "noscript");
  s = removeBlocks(s, "head");
  return replaceTags(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function scanTags(html, visit) {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) return;
    if (html.charAt(lt + 1) === "<") { i = lt + 1; continue; }
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) return;
    let n = lt + 1;
    if (html.charAt(n) === "/") n++;
    while (n < gt && TAG_NAME_CHAR.test(html.charAt(n))) n++;
    const name = html.slice(lt + 1, n).toLowerCase();
    if (visit({ name, raw: html.slice(lt, gt + 1), end: gt + 1 }) === true) return;
    i = gt + 1;
  }
}

const ATTR_RE = (name) => new RegExp(`(?:${name})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
const META_NAME_ATTR = ATTR_RE("name|property");
const META_CONTENT_ATTR = ATTR_RE("content");

/**
 * Pull structured metadata from a raw HTML body. Every modern site puts brand
 * signal in <head> (title, OG, JSON-LD) + footer anchors (social links). The
 * brand-extraction AI needs these as STRUCTURED inputs, not buried in stripped
 * body prose. Returns { title, description, og, favicon, social_links, json_ld }.
 */
function extractMetadata(html, baseUrl) {
  const meta = { title: "", description: "", og: {}, favicon: "", social_links: {}, json_ld: [] };
  let faviconLocked = false;
  let scriptCloseExhausted = false;

  const onAnchor = (tag) => {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return;
    let u;
    try { u = new URL(hrefMatch[1], baseUrl); } catch { return; }
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
  };

  scanTags(html, ({ name, raw, end }) => {
    if (name === "title" && !meta.title) {
      const lt = html.indexOf("<", end);
      if (lt > end && html.slice(lt, lt + 8).toLowerCase() === "</title>") meta.title = html.slice(end, lt).trim();
    } else if (name === "meta") {
      const nameMatch = raw.match(META_NAME_ATTR);
      const contentMatch = raw.match(META_CONTENT_ATTR);
      if (!nameMatch || !contentMatch) return;
      const key = (nameMatch[1] || nameMatch[2] || nameMatch[3] || "").toLowerCase();
      const val = contentMatch[1] || contentMatch[2] || contentMatch[3] || "";
      if (key === "description" && !meta.description) meta.description = val;
      if (key.startsWith("og:")) meta.og[key.slice(3)] = val;
      if (key === "twitter:title" && !meta.og.title) meta.og.title = val;
      if (key === "twitter:description" && !meta.og.description) meta.og.description = val;
      if (key === "twitter:image" && !meta.og.image) meta.og.image = val;
    } else if (name === "link" && !faviconLocked) {
      const relMatch = raw.match(/rel\s*=\s*["']([^"']+)["']/i);
      const hrefMatch = raw.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!relMatch || !hrefMatch) return;
      if (/icon/i.test(relMatch[1])) {
        try {
          meta.favicon = new URL(hrefMatch[1], baseUrl).toString();
          if (!/apple-touch/i.test(relMatch[1])) faviconLocked = true;
        } catch { /* skip */ }
      }
    } else if (name === "a") {
      onAnchor(raw);
    } else if (name === "script" && !scriptCloseExhausted && /type\s*=\s*["']application\/ld\+json["']/i.test(raw)) {
      const close = indexOfCI(html, "</script>", end);
      if (close < 0) { scriptCloseExhausted = true; return; }
      try { meta.json_ld.push(JSON.parse(html.slice(end, close).trim())); } catch { /* skip malformed JSON-LD */ }
    }
  });

  if (!meta.favicon) {
    try { meta.favicon = new URL("/favicon.ico", baseUrl).toString(); } catch {}
  }
  return meta;
}

/**
 * "Clean rebuild" — kills any running web child, deletes the .next/ build cache,
 * and lets the caller restart fresh. Common fix when CSS chunk references go
 * stale (which happens if `next build` ever runs over a `next dev` working
 * directory). User-triggered from the launcher control panel.
 */
async function cleanRebuild() {
  await stopWeb();
  const nextDir = path.join(PROJECT_ROOT, ".next");
  try {
    if (fs.existsSync(nextDir)) fs.rmSync(nextDir, { recursive: true, force: true });
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
  // Git checkouts rebuild the production bundle; packaged installs have no
  // .next to rebuild (the payload is prebuilt) and just restart.
  if (fs.existsSync(path.join(PROJECT_ROOT, "node_modules", "next"))) {
    const r = await runCommand("npm", ["run", "build"], "npm run build");
    if (!r.ok) return { ok: false, error: "npm run build failed — see /update/status log" };
  }
  return { ok: true, deleted: true };
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
  if (webChild) {
    appendUpdateLog("Stopping web app…");
    await stopWeb();
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

  // R7 step 5: production build (the web app runs from .next/standalone)
  r = await runCommand("npm", ["run", "build"], "npm run build");
  if (!r.ok) return finishUpdate(false, "npm run build failed");

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

/**
 * Stop the tracked web child. Returns a promise that resolves once THAT child
 * has exited (or after a timeout). The child is captured locally so a delayed
 * SIGKILL can never hit a replacement spawned by a restart.
 */
function stopWeb() {
  const child = webChild;
  if (!child) {
    webStatus = "down";
    return Promise.resolve({ ok: true, was_running: false });
  }
  webStatus = "stopping";
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (webChild === child) { webChild = null; webStatus = "down"; }
      resolve({ ok: true, was_running: true });
    };
    if (child.exitCode !== null || child.signalCode !== null) return finish();
    child.once("exit", finish);
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/F", "/T"], { windowsHide: true });
      } else {
        child.kill("SIGTERM");
        setTimeout(() => { if (!done) { try { child.kill("SIGKILL"); } catch {} } }, 3000);
      }
    } catch { /* ignore */ }
    setTimeout(finish, 8000);
  });
}

// --- HTTP server ---
/** Re-read the configured ports so an .env.local edit (or a launcher-driven
 *  port shift) is honoured without restarting the sidecar. Cheap: one small
 *  file read, and only on requests that need an authorization decision. */
function refreshPorts() {
  try {
    webPort = configuredWebPort();
  } catch {
    /* keep the last known value */
  }
}

const server = http.createServer(async (req, res) => {
  // Host check runs FIRST and covers every method, including GET. This is the
  // DNS-rebinding defence — see isAllowedHost(). Origin checks below can't
  // cover GETs because browsers don't send Origin on them.
  if (!isAllowedHost(req.headers.host)) {
    return json(res, 403, { ok: false, error: "Invalid Host header." });
  }
  refreshPorts();
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
      // `cwd` and `session_token` are only disclosed to a recognised local
      // origin. /health has to stay readable unauthenticated (the port probe
      // in lib/sync-endpoint.ts uses it), but an absolute filesystem path and
      // a session token don't need to be part of that public surface.
      const trusted = isAllowedOrigin(req.headers.origin || "") || !req.headers.origin;
      return json(res, 200, {
        ok: true,
        port: PORT,
        capabilities: ["status", "snapshot", "config", "web/start", "web/stop", "web/restart", "web/rebuild", "diagnostics", "update/check", "update/apply", "update/status", "ingest"],
        sidecar_version: "2026.08.1", // bump this when adding new endpoints
        ...(trusted ? { cwd: PROJECT_ROOT, session_token: SESSION_TOKEN } : {}),
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
          web_mode: webMode,
        });
      });
      return;
    }

    if (req.method === "POST" && url === "/web/start") {
      return json(res, 200, startWeb());
    }
    if (req.method === "POST" && url === "/web/stop") {
      return stopWeb().then((r) => json(res, 200, r));
    }
    if (req.method === "POST" && url === "/web/restart") {
      // Wait for the old child's real exit before spawning the replacement.
      stopWeb().then(() => startWeb());
      return json(res, 200, { ok: true });
    }
    // --- Release updates (installed copies: Windows app, install.sh) ---
    if (req.method === "GET" && url === "/release/check") {
      return json(res, 200, await releaseUpdate.check({ projectRoot: PROJECT_ROOT }));
    }
    if (req.method === "POST" && url === "/release/apply") {
      if (process.platform !== "win32" || process.env.OPENADKIT_PACKAGED !== "windows") {
        return json(res, 400, {
          ok: false,
          error: "One-click update is for the Windows app. On macOS/Linux, run the install command again.",
          command: releaseUpdate.INSTALL_SH,
        });
      }
      const info = await releaseUpdate.check({ projectRoot: PROJECT_ROOT });
      if (!info.can_apply) return json(res, 409, { ok: false, error: "No update to install.", ...info });
      try {
        await releaseUpdate.downloadWindowsSetup({ tag: info.tag, log: appendUpdateLog });
      } catch (e) {
        return json(res, 502, { ok: false, error: String(e?.message ?? e) });
      }
      // The desktop host sees this process exit, finds update/ready.json, runs
      // the verified Setup silently and relaunches OpenAdKit.
      json(res, 200, { ok: true, installing: info.latest });
      setTimeout(shutdown, 300);
      return;
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
      try {
        // Cap remote body at 500 KB — extractMetadata + strip pipeline runs a
        // few x the raw size in memory. (Audit finding #36.)
        body = await fetchRemote(target);
      } catch (e) {
        return json(res, 502, { ok: false, error: e?.message || "Fetch failed" });
      }

      // Extract structured metadata BEFORE stripping HTML. Everything in <head>
      // (title, description, OG tags, favicon, JSON-LD organization data) and
      // every social-media anchor href is high-signal for brand-brain
      // extraction. Stripping them away first was throwing out the best data.
      const metadata = extractMetadata(body, target);

      // Now strip HTML to plain text for the body content (linear-time).
      const text = stripHtml(body);
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
      // Runs in the background (a production build takes ~30s); progress is
      // visible in /update/status's log.
      cleanRebuild().then((r) => {
        if (r.ok) startWeb();
        else webLastLog = r.error;
      });
      return json(res, 200, { ok: true, deleted_next_cache: true, restart_initiated: true });
    }
    if (req.method === "POST" && url === "/quit") {
      // Stop the web child, ack to the caller, then exit the sidecar.
      json(res, 200, { ok: true, bye: true });
      shutdown();
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
      const rawSync = parsed.OPENADKIT_SYNC_PORT !== undefined ? parsed.OPENADKIT_SYNC_PORT : parsed.ADFORGE_SYNC_PORT;
      const syncPortIn = envPort(rawSync, null);
      if (parsed.PORT !== undefined && portIn === null) {
        return json(res, 400, { ok: false, error: "PORT must be an integer 1-65535." });
      }
      if (rawSync !== undefined && syncPortIn === null) {
        return json(res, 400, { ok: false, error: "OPENADKIT_SYNC_PORT must be an integer 1-65535." });
      }
      const next = writeEnvLocal({
        PORT: String(portIn ?? current.PORT),
        OPENADKIT_SYNC_PORT: String(syncPortIn ?? current.OPENADKIT_SYNC_PORT),
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
try { webPort = configuredWebPort(); } catch {}

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
    // Signal handling lives in shutdown() below so the web child is always
    // stopped first; the exit hook removes the lock on every exit path.
    process.on("exit", cleanup);
  } catch (e) {
    // Non-fatal — if the lockfile can't be created, fall through and let
    // listen() fail with EADDRINUSE if there really is a duplicate.
    console.warn(`[openadkit] could not acquire singleton lock: ${e?.message ?? e}`);
  }
}

// Session token bumps every time the sidecar starts. The browser polls
// /health (via /status), sees a new SESSION_TOKEN, and reloads itself.
// That means "user clicks OpenAdKit.bat after a system restart" gives them
// a fresh page in the already-open browser tab — no manual refresh needed.
const SESSION_TOKEN = String(Date.now());

// Only the real CLI entrypoint takes the lock, binds the port and installs
// signal handlers. `require("./local-sync.cjs")` (unit tests) gets the pure
// helpers below with zero side effects.
if (IS_MAIN) {
  acquireSingletonLock();
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
    if (envFirst("OPENADKIT_NO_AUTOSTART", "ADFORGE_NO_AUTOSTART") !== "1") {
      console.log("[openadkit] auto-starting web app (set OPENADKIT_NO_AUTOSTART=1 to disable)");
      const res = startWeb();
      if (!res.ok) {
        console.warn(`[openadkit] auto-start failed (non-fatal): ${res.error}. Use the launcher to retry.`);
      }
    }
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/** Stop the web child, close the server and exit. Idempotent. */
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[openadkit] shutting down");
  // Hard deadline so a stuck child can never keep the sidecar alive.
  setTimeout(() => process.exit(0), 10_000).unref();
  stopWeb().finally(() => {
    try { server.close(); } catch {}
    process.exit(0);
  });
}

module.exports = {
  envFirst,
  isAllowedOrigin,
  isAllowedHost,
  isPrivateOrLoopbackHost,
  pinnedLookup,
  fetchRemote,
  stripHtml,
  extractMetadata,
  resolveUserDataDir,
  configuredWebPort,
  PORT,
};
