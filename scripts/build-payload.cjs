#!/usr/bin/env node
/**
 * Assemble the release payload: everything OpenAdKit needs to run with a
 * plain `node`, no npm, no build step on the user's machine.
 *
 *   npm run build && node scripts/build-payload.cjs
 *
 * Output:
 *   dist/payload/                     server.js, .next/, node_modules/, public/,
 *                                     scripts/local-sync.cjs, package.json,
 *                                     payload.json
 *   dist/OpenAdKit-app.tar.gz         the same, for the macOS/Linux installer
 *
 * The payload is pure JavaScript (next.config.mjs keeps native `sharp` out),
 * so one archive serves Windows, macOS and Linux on any Node >= 20.9.
 *
 * Refuses to finish if user data or secrets made it in.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const DIST = path.join(ROOT, "dist");
const PAYLOAD = path.join(DIST, "payload");
const TARBALL = path.join(DIST, "OpenAdKit-app.tar.gz");

function fail(msg) {
  console.error(`[build-payload] ${msg}`);
  process.exit(1);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(path.join(STANDALONE, "server.js"))) {
    fail("no .next/standalone/server.js — run `npm run build` first.");
  }
  if (!fs.existsSync(path.join(STANDALONE, ".next", "static"))) {
    fail(".next/standalone is missing static assets — postbuild (prepare-standalone) did not run.");
  }

  fs.rmSync(PAYLOAD, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(STANDALONE, PAYLOAD, { recursive: true });
  fs.mkdirSync(path.join(PAYLOAD, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts", "local-sync.cjs"), path.join(PAYLOAD, "scripts", "local-sync.cjs"));
  // App icon for the macOS .app bundle / Linux .desktop entry made by install.sh.
  fs.copyFileSync(path.join(ROOT, "installer", "art", "icon-512.png"), path.join(PAYLOAD, "icon.png"));

  // Secrets / user data must never ship.
  for (const f of [".env", ".env.local", ".env.production.local", ".env.test.local"]) {
    fs.rmSync(path.join(PAYLOAD, f), { force: true });
  }
  fs.rmSync(path.join(PAYLOAD, "data"), { recursive: true, force: true });
  const files = walk(PAYLOAD);
  const bad = files.filter((f) => /(^|[\\/])(\.env[^\\/]*|snapshot\.json|.*\.db|.*\.sqlite)$/i.test(f));
  if (bad.length) fail(`refusing to ship user data / secrets:\n  ${bad.join("\n  ")}`);
  const native = files.filter((f) => f.endsWith(".node"));
  if (native.length) fail(`native binaries found — the payload must be platform-neutral:\n  ${native.join("\n  ")}`);

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const meta = {
    name: "OpenAdKit",
    version: pkg.version,
    node: pkg.engines?.node ?? ">=20.9",
    built_at: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
  };
  fs.writeFileSync(path.join(PAYLOAD, "payload.json"), JSON.stringify(meta, null, 2) + "\n");

  // tar is built into Windows 10+, macOS and Linux.
  fs.rmSync(TARBALL, { force: true });
  // Relative paths: GNU tar (Git Bash) reads "C:" in an absolute path as a remote host.
  execFileSync("tar", ["-czf", path.basename(TARBALL), "-C", path.basename(PAYLOAD), "."], { cwd: DIST, stdio: "inherit" });

  const bytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);
  console.log(
    `[build-payload] v${meta.version}: ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB → dist/payload, ` +
      `${(fs.statSync(TARBALL).size / 1e6).toFixed(1)} MB → dist/OpenAdKit-app.tar.gz`,
  );
}

main();
