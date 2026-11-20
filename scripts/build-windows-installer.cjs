#!/usr/bin/env node
/**
 * Build the Windows app folder and installer.
 *
 *   npm run build && node scripts/build-payload.cjs && node scripts/build-windows-installer.cjs
 *
 * Produces:
 *   dist/win/OpenAdKit/                 the installed layout (runnable as-is)
 *     OpenAdKit.exe                     WinForms + WebView2 window (installer/host)
 *     Microsoft.Web.WebView2.*.dll, WebView2Loader.dll
 *     node/node.exe                     portable Node, SHA-256 checked against nodejs.org
 *     app/                              dist/payload
 *   dist/OpenAdKit-Windows-Setup.exe    Inno Setup installer (when ISCC is available)
 *
 * Every downloaded file is verified before use:
 *   - node.exe zip against nodejs.org's SHASUMS256.txt for the pinned version
 *   - WebView2 SDK files against the SHA-256s pinned below
 *
 * The host is compiled with the C# compiler that ships with Windows
 * (.NET Framework 4), so no .NET SDK is needed. Set ISCC=<path to ISCC.exe>
 * if Inno Setup is not in its default location.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CACHE = path.join(ROOT, ".installer-cache");
const OUT = path.join(DIST, "win", "OpenAdKit");
const PAYLOAD = path.join(DIST, "payload");

// Node LTS bundled into the installer. Bump deliberately; the hash comes from
// nodejs.org's SHASUMS256.txt for this exact version.
const NODE_VERSION = "v24.22.3";

// Microsoft.Web.WebView2 NuGet package, files pinned by SHA-256.
const WEBVIEW2_VERSION = "1.0.4258.31";
const WEBVIEW2_FILES = {
  "lib/net462/Microsoft.Web.WebView2.Core.dll": "d60e6e94245078cb56e44ebd5f360dc04bf18e460136be93bfc4cfca43b98505",
  "lib/net462/Microsoft.Web.WebView2.WinForms.dll": "6a9e6856f23c463783c3afb0ca5d78f56324c86657162ccb16d5227b3233b32a",
  "runtimes/win-x64/native/WebView2Loader.dll": "3426dcc55fdfb8b5e7ac623cf33b4ccf283fbf68a0c5a65bddfdb4d749a8abee",
};

const SYSTEM_TAR = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");

function fail(msg) {
  console.error(`[build-windows] ${msg}`);
  process.exit(1);
}
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "openadkit-build" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (!redirects) return reject(new Error(`too many redirects: ${url}`));
          return resolve(download(new URL(res.headers.location, url).toString(), redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function cached(name, url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    console.log(`  downloading ${url}`);
    fs.writeFileSync(file, await download(url));
  }
  return file;
}

/** Extract specific entries from a zip with Windows' bsdtar. */
function unzip(zip, dest, entries) {
  fs.mkdirSync(dest, { recursive: true });
  execFileSync(SYSTEM_TAR, ["-xf", zip, "-C", dest, ...entries], { stdio: "inherit" });
}

async function stageNode() {
  const name = `node-${NODE_VERSION}-win-x64`;
  const sums = (await download(`https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt`)).toString("utf8");
  const line = sums.split("\n").find((l) => l.trim().endsWith(`${name}.zip`));
  if (!line) fail(`${name}.zip is not listed in SHASUMS256.txt`);
  const want = line.trim().split(/\s+/)[0];
  const zip = await cached(`${name}.zip`, `https://nodejs.org/dist/${NODE_VERSION}/${name}.zip`);
  const got = sha256(fs.readFileSync(zip));
  if (got !== want) {
    fs.rmSync(zip, { force: true });
    fail(`${name}.zip SHA-256 mismatch (got ${got}, nodejs.org says ${want}) — deleted, not used.`);
  }
  console.log(`  node ${NODE_VERSION}: SHA-256 matches nodejs.org`);
  const tmp = path.join(CACHE, "node-extract");
  fs.rmSync(tmp, { recursive: true, force: true });
  unzip(zip, tmp, [`${name}/node.exe`, `${name}/LICENSE`]);
  fs.mkdirSync(path.join(OUT, "node"), { recursive: true });
  fs.copyFileSync(path.join(tmp, name, "node.exe"), path.join(OUT, "node", "node.exe"));
  fs.copyFileSync(path.join(tmp, name, "LICENSE"), path.join(OUT, "node", "LICENSE"));
}

async function stageWebView2() {
  const nupkg = await cached(
    `webview2-${WEBVIEW2_VERSION}.nupkg.zip`,
    `https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${WEBVIEW2_VERSION}`,
  );
  const tmp = path.join(CACHE, "webview2-extract");
  fs.rmSync(tmp, { recursive: true, force: true });
  unzip(nupkg, tmp, Object.keys(WEBVIEW2_FILES));
  for (const [rel, want] of Object.entries(WEBVIEW2_FILES)) {
    const buf = fs.readFileSync(path.join(tmp, rel));
    if (sha256(buf) !== want) fail(`${rel} from WebView2 ${WEBVIEW2_VERSION} does not match its pinned SHA-256 — not used.`);
    fs.writeFileSync(path.join(OUT, path.basename(rel)), buf);
  }
  console.log(`  WebView2 SDK ${WEBVIEW2_VERSION}: all files match pinned SHA-256s`);
}

function compileHost() {
  const fw = path.join(process.env.SystemRoot || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319");
  const csc = path.join(fw, "csc.exe");
  if (!fs.existsSync(csc)) fail(`${csc} not found (the .NET Framework 4 C# compiler that ships with Windows).`);
  execFileSync(
    csc,
    [
      "/nologo",
      "/target:winexe",
      "/platform:x64",
      "/optimize+",
      `/win32icon:${path.join(ROOT, "installer", "art", "icon.ico")}`,
      `/out:${path.join(OUT, "OpenAdKit.exe")}`,
      `/r:${path.join(OUT, "Microsoft.Web.WebView2.Core.dll")}`,
      `/r:${path.join(OUT, "Microsoft.Web.WebView2.WinForms.dll")}`,
      "/r:System.Windows.Forms.dll",
      "/r:System.Drawing.dll",
      path.join(ROOT, "installer", "host", "OpenAdKit.cs"),
    ],
    { stdio: "inherit" },
  );
  console.log("  compiled OpenAdKit.exe");
}

function findIscc() {
  const candidates = [
    process.env.ISCC,
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Inno Setup 6", "ISCC.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Inno Setup 6", "ISCC.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Inno Setup 6", "ISCC.exe"),
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) || null;
}

async function main() {
  if (process.platform !== "win32") fail("run this on Windows (CI uses windows-latest).");
  if (!fs.existsSync(path.join(PAYLOAD, "server.js"))) fail("dist/payload missing — run scripts/build-payload.cjs first.");
  // The Next build is a dot-folder: easy to lose when copying/uploading.
  if (!fs.existsSync(path.join(PAYLOAD, ".next", "BUILD_ID"))) fail("dist/payload/.next/BUILD_ID missing — the app build was not included (hidden-folder copy?).");
  const version = JSON.parse(fs.readFileSync(path.join(PAYLOAD, "payload.json"), "utf8")).version;

  console.log(`[build-windows] OpenAdKit ${version}`);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.cpSync(PAYLOAD, path.join(OUT, "app"), { recursive: true });
  await stageNode();
  await stageWebView2();
  compileHost();

  // The host's own check: files present + WebView2 runtime available.
  try {
    execFileSync(path.join(OUT, "OpenAdKit.exe"), ["--self-test"], { stdio: "inherit" });
  } catch (e) {
    if (e.status === 3) console.warn("  self-test: WebView2 runtime not on this machine (the app falls back to the browser)");
    else fail(`OpenAdKit.exe --self-test failed with exit code ${e.status}`);
  }

  const iscc = findIscc();
  if (!iscc) {
    console.log("[build-windows] Inno Setup not found — app folder ready at dist/win/OpenAdKit (installer skipped).");
    return;
  }
  execFileSync(
    iscc,
    [`/DAppVersion=${version}`, `/DAppDir=${OUT}`, `/DOutputDir=${DIST}`, path.join(ROOT, "installer", "openadkit.iss")],
    { stdio: "inherit" },
  );
  const setup = path.join(DIST, "OpenAdKit-Windows-Setup.exe");
  console.log(`[build-windows] ${path.relative(ROOT, setup)}  SHA-256 ${sha256(fs.readFileSync(setup))}`);
}

main().catch((e) => fail(e.stack || String(e)));
