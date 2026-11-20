/**
 * Release-based updates for installed copies of OpenAdKit (Windows Setup,
 * install.sh). Git checkouts keep using the sidecar's git updater.
 *
 *   check()  → compares the installed version with the latest GitHub release
 *   downloadWindowsSetup() → fetches OpenAdKit-Windows-Setup.exe for that
 *     release, verifies it against the release's SHA256SUMS.txt (and size +
 *     MZ header), and writes it plus ready.json under
 *     %LOCALAPPDATA%\OpenAdKit\update\. The desktop host (OpenAdKit.exe) runs
 *     it silently after the sidecar exits, then relaunches.
 *
 * Downloads only follow redirects to GitHub's own hosts.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const REPO = "IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool";
const API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const SETUP_NAME = "OpenAdKit-Windows-Setup.exe";
const ALLOWED_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "codeload.github.com",
]);
const INSTALL_SH = `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`;

/** "v2.1.0" / "2.1.0-beta.1" → comparable parts; null when not semver. */
function parseVersion(v) {
  const m = String(v || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || "" };
}

/** -1 / 0 / 1. A pre-release sorts before its release. Unparseable → 0. */
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (const k of ["major", "minor", "patch"]) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Installed version: payload.json (packaged) else package.json. */
function installedVersion(projectRoot) {
  for (const f of ["payload.json", "package.json"]) {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(projectRoot, f), "utf8")).version;
      if (v) return { version: String(v), source: f };
    } catch {
      /* next */
    }
  }
  return { version: "0.0.0", source: "unknown" };
}

/** How this copy was installed, from the env the launcher/host set. */
function installKind(env = process.env, projectRoot) {
  if (env.OPENADKIT_PACKAGED === "windows") return "windows";
  if (env.OPENADKIT_PACKAGED === "unix") return "unix";
  if (projectRoot && fs.existsSync(path.join(projectRoot, ".git"))) return "git";
  return "other";
}

function get(url, { maxBytes = 300 * 1024 * 1024, redirects = 5, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return reject(new Error(`bad URL: ${url}`));
    }
    if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) {
      return reject(new Error(`refusing to download from ${u.hostname}`));
    }
    const req = https.get(
      u,
      { headers: { "User-Agent": "OpenAdKit-update-check", Accept: "*/*", ...headers }, timeout: 15000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new Error("too many redirects"));
          return resolve(get(new URL(res.headers.location, u).toString(), { maxBytes, redirects: redirects - 1, headers }));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u.pathname}`));
        }
        const chunks = [];
        let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy(new Error("download too large"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

/** Latest published release: { tag, version, url, notes, published_at, assets[] }. */
async function fetchLatestRelease(fetcher = get) {
  const body = await fetcher(API_LATEST, { maxBytes: 2 * 1024 * 1024, headers: { Accept: "application/vnd.github+json" } });
  const r = JSON.parse(body.toString("utf8"));
  return {
    tag: r.tag_name,
    version: String(r.tag_name || "").replace(/^v/i, ""),
    url: r.html_url,
    notes: typeof r.body === "string" ? r.body.slice(0, 4000) : "",
    published_at: r.published_at,
    assets: (r.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
  };
}

/** Result shape for GET /release/check. */
async function check({ projectRoot, env = process.env, fetcher = get } = {}) {
  const installed = installedVersion(projectRoot);
  const kind = installKind(env, projectRoot);
  let latest;
  try {
    latest = await fetchLatestRelease(fetcher);
  } catch (e) {
    return { status: "network_error", current: installed.version, install_kind: kind, reason: String(e.message || e) };
  }
  const available = compareVersions(latest.version, installed.version) > 0;
  const setup = latest.assets.find((a) => a.name === SETUP_NAME);
  return {
    status: available ? "available" : "up_to_date",
    update_available: available,
    current: installed.version,
    latest: latest.version,
    tag: latest.tag,
    release_url: latest.url,
    notes: latest.notes,
    published_at: latest.published_at,
    install_kind: kind,
    can_apply: available && kind === "windows" && process.platform === "win32" && Boolean(setup),
    command: kind === "unix" ? INSTALL_SH : null,
  };
}

/** SHA-256 for `name` from a SHA256SUMS.txt body ("<hex>  name" or "<hex> *name"). */
function checksumFor(sums, name) {
  for (const line of String(sums).split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (m && m[2].trim() === name) return m[1].toLowerCase();
  }
  return null;
}

function updateDir(env = process.env) {
  const base = env.LOCALAPPDATA || path.join(require("os").homedir(), "AppData", "Local");
  return path.join(base, "OpenAdKit", "update");
}

/** Download + verify the Setup for `tag`; writes ready.json for the host. */
async function downloadWindowsSetup({ tag, env = process.env, fetcher = get, log = () => {} }) {
  const base = `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}`;
  log(`Downloading checksums for ${tag}…`);
  const sums = (await fetcher(`${base}/SHA256SUMS.txt`, { maxBytes: 64 * 1024 })).toString("utf8");
  const want = checksumFor(sums, SETUP_NAME);
  if (!want) throw new Error(`${SETUP_NAME} is not listed in the release's SHA256SUMS.txt`);
  log(`Downloading ${SETUP_NAME}…`);
  const exe = await fetcher(`${base}/${SETUP_NAME}`);
  const got = crypto.createHash("sha256").update(exe).digest("hex");
  if (got !== want) throw new Error(`Downloaded installer failed its SHA-256 check (got ${got}). Not installed.`);
  if (exe.length < 1024 * 1024 || exe[0] !== 0x4d || exe[1] !== 0x5a) throw new Error("Downloaded file is not a Windows installer.");
  const dir = updateDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, SETUP_NAME);
  fs.writeFileSync(file, exe);
  fs.writeFileSync(path.join(dir, "ready.json"), JSON.stringify({ path: file, tag, sha256: got, at: Date.now() }));
  log(`Verified (SHA-256 ${got}). OpenAdKit will close, update and reopen.`);
  return { path: file, sha256: got };
}

module.exports = {
  REPO,
  SETUP_NAME,
  INSTALL_SH,
  parseVersion,
  compareVersions,
  installedVersion,
  installKind,
  fetchLatestRelease,
  check,
  checksumFor,
  updateDir,
  downloadWindowsSetup,
  get,
};
