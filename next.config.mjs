import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Build id used to version the service worker cache. Prefer CI/Vercel
 *  values, then the git SHA, then a timestamp. */
function resolveBuildId() {
  if (process.env.NEXT_PUBLIC_BUILD_ID) return process.env.NEXT_PUBLIC_BUILD_ID;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return String(Date.now());
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: resolveBuildId() },
  // Self-contained server bundle (.next/standalone) — this is what the
  // Windows installer, the macOS/Linux one-liner and Docker ship. Users run
  // `node server.js` in production mode instead of `next dev`.
  output: "standalone",
  // Pin tracing to this folder so a stray lockfile in a parent directory
  // can't make Next trace (and bundle) the wrong tree.
  outputFileTracingRoot: root,
  turbopack: { root },
  // Security headers for self-hosted / Docker deployments. Vercel applies these
  // via vercel.json, but non-Vercel hosts don't read that file.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
