#!/usr/bin/env node
/**
 * Make `.next/standalone` a complete, runnable app.
 *
 * `next build` with `output: "standalone"` emits server.js plus the traced
 * node_modules, but deliberately leaves out `public/` and `.next/static/`
 * (they are meant for a CDN). Self-hosted installs serve everything from one
 * process, so copy both in. Runs as `postbuild`; also used by the installer
 * and release scripts. Start the result with:
 *
 *   PORT=41573 HOSTNAME=127.0.0.1 node .next/standalone/server.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  return 1;
}

function main() {
  const server = path.join(STANDALONE, "server.js");
  if (!fs.existsSync(server)) {
    // Vercel and other adapters don't produce a standalone dir — nothing to do.
    console.log("[prepare-standalone] no .next/standalone/server.js — skipping");
    return;
  }
  copyDir(path.join(ROOT, "public"), path.join(STANDALONE, "public"));
  copyDir(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"));
  // Never ship local secrets or user data inside the bundle.
  for (const f of [".env", ".env.local", ".env.production.local"]) {
    fs.rmSync(path.join(STANDALONE, f), { force: true });
  }
  fs.rmSync(path.join(STANDALONE, "data"), { recursive: true, force: true });
  console.log("[prepare-standalone] .next/standalone is ready (public + static copied)");
}

main();
