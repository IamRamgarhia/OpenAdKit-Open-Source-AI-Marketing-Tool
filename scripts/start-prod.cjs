#!/usr/bin/env node
/**
 * `npm start` — run the production standalone server.
 * Requires `npm run build` first. Port: PORT (default 3005).
 * Bind address: OPENADKIT_HOST (default 127.0.0.1; Docker sets 0.0.0.0).
 * We don't read HOSTNAME directly because Docker sets it to the container id.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const server = path.join(__dirname, "..", ".next", "standalone", "server.js");
if (!fs.existsSync(server)) {
  console.error("[openadkit] No production build found. Run `npm run build` first.");
  process.exit(1);
}
const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.PORT || "3005",
    HOSTNAME: process.env.OPENADKIT_HOST || "127.0.0.1",
  },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
