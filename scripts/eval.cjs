#!/usr/bin/env node
/** npm run eval [tool-name-filter...] — bundles tests/eval/eval.ts and runs it. */
const path = require("path");
const { spawnSync } = require("child_process");
const esbuild = require("esbuild");
const ROOT = path.join(__dirname, "..");
const out = path.join(ROOT, "test-results", "eval", "eval.bundle.mjs");
esbuild.buildSync({
  entryPoints: [path.join(ROOT, "tests", "eval", "eval.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  alias: { "@": ROOT },
  banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" },
  logLevel: "warning",
});
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: "inherit", cwd: ROOT });
process.exit(r.status ?? 1);
