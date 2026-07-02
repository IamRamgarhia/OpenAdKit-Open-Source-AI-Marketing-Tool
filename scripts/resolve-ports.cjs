#!/usr/bin/env node
/**
 * OpenAdKit port resolver — runs before the sidecar starts to figure out which
 * ports THIS install should use, given that other OpenAdKit installs (or
 * unrelated processes) may already occupy the default ports.
 *
 * Decision logic:
 *   1. Read PORT + ADFORGE_SYNC_PORT from .env.local (or hash-derived high-range default; see defaultStartPort()).
 *   2. Probe ADFORGE_SYNC_PORT for /health.
 *        - Responds AND has "ingest" AND cwd matches this install   → "reuse"
 *        - Responds AND has "ingest" AND cwd is a different folder  → shift to a free port pair
 *        - Responds AND missing "ingest" AND cwd matches this folder → "restart_stale"
 *        - Responds AND missing "ingest" AND cwd differs            → shift (it's some other install's stale sidecar — leave it alone)
 *        - No response BUT port is socket-bound by something else   → shift
 *        - No response AND port is free                             → "start"
 *
 * When shifting, .env.local is updated atomically with the new port pair so
 * downstream code (OpenAdKit.bat / launcher / web app) all read the same values.
 *
 * Stdout is a single line: ACTION=<verb>  (reuse | restart_stale | start | shifted | error)
 * The caller (OpenAdKit.bat / OpenAdKit.command) parses that one token and reacts.
 *
 * Zero dependencies — Node stdlib only.
 */
const net = require("net");
const fs = require("fs");
const path = require("path");
const http = require("http");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");

// Default port range: 41573-49999. Chosen because:
//   - 3000-9000 is the most-collided range (every Next.js / Express / Rails /
//     Flask / Vite dev server lives there). New OpenAdKit users hit collisions
//     immediately and the resolver has to shift on every launch.
//   - 41573+ is in IANA's "registered but rarely used" range. Almost nothing
//     else binds there.
//   - We derive a starting offset from a hash of the install folder so two
//     OpenAdKit installs in different folders begin at different bases and
//     don't race to claim the same pair before the OS-probe step.
function defaultStartPort() {
  let h = 0;
  for (const ch of PROJECT_ROOT) {
    h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  }
  // 41573-49998 in 8425-port band (yields 4212 pair slots)
  const offset = Math.abs(h) % 8424;
  return 41573 + (offset & ~1); // even alignment
}

const DEFAULT_PORT_RANGE_START = defaultStartPort();

function readEnv() {
  const out = { PORT: String(DEFAULT_PORT_RANGE_START), ADFORGE_SYNC_PORT: String(DEFAULT_PORT_RANGE_START + 1) };
  if (!fs.existsSync(ENV_LOCAL)) return out;
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function writeEnv(updates) {
  const next = { ...readEnv(), ...updates };
  // Preserve any other keys the user added to .env.local (API keys, feature
  // flags, …) — only PORT / ADFORGE_SYNC_PORT are managed here. The old
  // implementation rewrote the file with just those two, deleting the rest.
  // (Audit finding.)
  let lines = fs.existsSync(ENV_LOCAL)
    ? fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)
    : ["# OpenAdKit configuration (auto-resolved by scripts/resolve-ports.cjs)"];
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
}

function probeHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/health", timeout: 1500 },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { try { req.destroy(); } catch {} resolve(null); });
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

/** Ask the OS for an ephemeral free port. Binds to :0, reads the assigned
 *  port, immediately releases it. Used on truly-first run so we never even
 *  start in the contested 3000-range. */
function askOsForFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(null));
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = (addr && typeof addr === "object") ? addr.port : null;
      srv.close(() => resolve(port));
    });
  });
}

/** Get two consecutive ports the OS believes are free. We can't ask for
 *  consecutive ports atomically, so: ask for one, then walk +1 / +2 until we
 *  find an adjacent free port. Almost always succeeds on the first try. */
async function askOsForFreePair() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const base = await askOsForFreePort();
    if (!base) continue;
    // Prefer even base so web port stays even, sync stays odd.
    const web = base % 2 === 0 ? base : base - 1;
    const sync = web + 1;
    if (web < 1024) continue; // skip privileged ports
    if (await isPortFree(web) && await isPortFree(sync)) {
      return { web, sync };
    }
  }
  return null;
}

async function findFreePair(startFrom) {
  // Start at startFrom (rounded up to even), walk in pairs. The web port is
  // even, the sync port is odd — keeps the relationship obvious.
  let p = startFrom + (startFrom % 2 === 0 ? 0 : 1);
  const max = p + 2000;
  while (p < max) {
    if ((await isPortFree(p)) && (await isPortFree(p + 1))) {
      return { web: p, sync: p + 1 };
    }
    p += 2;
  }
  return null;
}

function normalize(p) {
  const norm = path.normalize(p).replace(/\\/g, "/").replace(/\/+$/, "");
  // Case-insensitive compare only on Windows (case-insensitive filesystem);
  // keep case on Linux/macOS where two installs differing only by case are
  // genuinely distinct. (Audit finding.)
  return process.platform === "win32" ? norm.toLowerCase() : norm;
}

(async () => {
  try {
    // First-run path: no .env.local yet → ask the OS for two ports the kernel
    // just confirmed are free at this moment. Zero collision risk because we
    // skip the contested 3000-range entirely.
    const firstRun = !fs.existsSync(ENV_LOCAL);
    if (firstRun) {
      const fresh = await askOsForFreePair();
      if (fresh) {
        writeEnv({ PORT: String(fresh.web), ADFORGE_SYNC_PORT: String(fresh.sync) });
        process.stdout.write(`ACTION=start PORT=${fresh.web} SYNC=${fresh.sync} REASON=first_run_os_assigned\n`);
        return;
      }
      // OS-port-probe failed (extremely rare). Fall through to hash-based
      // default which still avoids the 3000-range.
    }

    const env = readEnv();
    const desiredWeb = Number(env.PORT) || DEFAULT_PORT_RANGE_START;
    const desiredSync = Number(env.ADFORGE_SYNC_PORT) || (DEFAULT_PORT_RANGE_START + 1);

    const health = await probeHealth(desiredSync);
    const ourCwd = normalize(PROJECT_ROOT);

    if (health) {
      const caps = Array.isArray(health.capabilities) ? health.capabilities : [];
      const hasIngest = caps.includes("ingest");
      const theirCwd = health.cwd ? normalize(health.cwd) : null;
      const sameCwd = theirCwd && theirCwd === ourCwd;

      if (hasIngest && sameCwd) {
        // It's MY sidecar with the right code already running.
        process.stdout.write(`ACTION=reuse PORT=${desiredWeb} SYNC=${desiredSync}\n`);
        return;
      }
      if (!hasIngest && sameCwd) {
        // It's MY sidecar but it's stale (predates /ingest). Caller will quit + restart.
        process.stdout.write(`ACTION=restart_stale PORT=${desiredWeb} SYNC=${desiredSync}\n`);
        return;
      }
      // It's SOMEONE ELSE'S sidecar on the port we wanted (theirCwd mismatch,
      // OR theirCwd missing because they're running an older sidecar that
      // doesn't return cwd). Either way, leave them alone and pick a new pair.
      const pair = await findFreePair(Math.max(DEFAULT_PORT_RANGE_START, desiredSync + 2));
      if (!pair) {
        process.stdout.write(`ACTION=error REASON=no_free_port_pair\n`);
        return;
      }
      writeEnv({ PORT: String(pair.web), ADFORGE_SYNC_PORT: String(pair.sync) });
      process.stdout.write(`ACTION=shifted PORT=${pair.web} SYNC=${pair.sync} REASON=another_install_on_${desiredSync}\n`);
      return;
    }

    // No response. Check whether the port is genuinely free.
    const syncFree = await isPortFree(desiredSync);
    const webFree = await isPortFree(desiredWeb);
    if (syncFree && webFree) {
      process.stdout.write(`ACTION=start PORT=${desiredWeb} SYNC=${desiredSync}\n`);
      return;
    }

    // One or both ports are bound by something non-OpenAdKit (a different web app,
    // a stalled process, etc.). Shift to the next free pair.
    const pair = await findFreePair(Math.max(DEFAULT_PORT_RANGE_START, desiredSync + 2));
    if (!pair) {
      process.stdout.write(`ACTION=error REASON=no_free_port_pair\n`);
      return;
    }
    writeEnv({ PORT: String(pair.web), ADFORGE_SYNC_PORT: String(pair.sync) });
    process.stdout.write(`ACTION=shifted PORT=${pair.web} SYNC=${pair.sync} REASON=ports_bound_by_other_process\n`);
  } catch (e) {
    process.stdout.write(`ACTION=error REASON=${(e && e.message ? e.message : "unknown").replace(/\s+/g, "_")}\n`);
  }
})();
