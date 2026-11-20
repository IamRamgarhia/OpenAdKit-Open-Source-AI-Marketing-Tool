#!/usr/bin/env node
/**
 * Bundle the MCP server into one self-contained file:
 *   mcp/dist/openadkit-mcp.mjs   (Node >= 20.9, no node_modules needed)
 *
 *   npm run build:mcp
 */
const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const outfile = path.join(ROOT, "mcp", "dist", "openadkit-mcp.mjs");

esbuild
  .build({
    entryPoints: [path.join(ROOT, "mcp", "server.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    minify: false,
    sourcemap: false,
    legalComments: "none",
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire as __oakCreateRequire } from 'node:module';\nconst require = __oakCreateRequire(import.meta.url);",
    },
    define: { __OPENADKIT_VERSION__: JSON.stringify(pkg.version) },
    alias: { "@": ROOT },
    logLevel: "warning",
  })
  .then(() => {
    fs.chmodSync(outfile, 0o755);
    console.log(`[build-mcp] ${path.relative(ROOT, outfile)} (${(fs.statSync(outfile).size / 1e6).toFixed(2)} MB)`);
  })
  .catch(() => process.exit(1));
