#!/usr/bin/env node
/**
 * Cross-platform launcher: runs the local-sync sidecar AND the Next.js dev server
 * in parallel. One Ctrl+C kills both cleanly.
 *
 * Honors PORT + ADFORGE_SYNC_PORT from .env.local (or current env).
 *
 * Used by:  npm run start:all
 *
 * If you'd rather use the OS-native scripts, run start.bat (Windows) or
 * bash start.sh (Mac/Linux) instead — same result, no Node-bookkeeping.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load .env.local if PORT not already in env
function loadEnvLocal() {
  const file = path.join(PROJECT_ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const PORT = process.env.PORT || "3005";
const SYNC_PORT = process.env.ADFORGE_SYNC_PORT || "3006";

const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";

console.log(`[openadkit] starting local-sync sidecar on http://127.0.0.1:${SYNC_PORT}`);
const sync = spawn(process.execPath, [path.join(__dirname, "local-sync.cjs")], {
  cwd: PROJECT_ROOT,
  stdio: ["ignore", "inherit", "inherit"],
  // run-all spawns Next itself (below), so tell the sidecar NOT to also
  // auto-start its own `next dev` — otherwise two servers race for the same
  // PORT and the second dies with EADDRINUSE. (Audit finding.)
  env: { ...process.env, ADFORGE_SYNC_PORT: SYNC_PORT, ADFORGE_NO_AUTOSTART: "1" },
});

console.log(`[openadkit] starting Next.js dev server on http://localhost:${PORT}`);
console.log(`[openadkit] try also  http://openadkit.localhost:${PORT}  — works in all modern browsers, zero setup`);
const next = spawn(npx, ["next", "dev", "-p", PORT], {
  cwd: PROJECT_ROOT,
  stdio: ["ignore", "inherit", "inherit"],
  shell: isWin,
  env: { ...process.env },
});

function shutdown(signal) {
  console.log(`\n[openadkit] received ${signal} — stopping all processes`);
  try { sync.kill(); } catch {}
  try { next.kill(); } catch {}
  setTimeout(() => process.exit(0), 600);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

sync.on("exit", (code) => {
  console.log(`[openadkit] local-sync exited with code ${code}`);
});
next.on("exit", (code) => {
  console.log(`[openadkit] next dev exited with code ${code}`);
  try { sync.kill(); } catch {}
  process.exit(code ?? 0);
});
