#!/usr/bin/env node
/**
 * One-shot GitHub repo metadata setter for OpenAdKit.
 *
 * Run ONCE after `gh auth login`. Sets:
 *   - Repo description (the "About" line shown in search results + card)
 *   - Homepage URL
 *   - Topics (the indexable tags shown under the description)
 *   - Default features (Issues + Discussions on, Wiki + Projects off)
 *   - Social preview image (if public/og-image.png exists)
 *
 * Usage:
 *   gh auth login              # one-time, browser-based auth
 *   node scripts/setup-github.cjs
 *
 * Or override the repo target:
 *   node scripts/setup-github.cjs IamRamgarhia/Free-open-source-AI-marketing-tool
 *
 * Idempotent — run as many times as needed.
 */
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─── Tunable repo metadata ──────────────────────────────────────────────────
const REPO_DESCRIPTION =
  "Free open-source AI marketing tool · Jasper + AdCreative + Anyword alternative · 9 BYOK providers · browser-only · MIT";

const HOMEPAGE_URL = "https://openadkit.dicecodes.com";

const TOPICS = [
  // What it is — broad discovery
  "ai-marketing",
  "ai-marketing-tool",
  "ai-ads",
  "ad-copy-generator",
  "ai-copywriting",
  // Competitor anchors — high-intent search
  "jasper-alternative",
  "adcreative-alternative",
  "anyword-alternative",
  "copy-ai-alternative",
  // Differentiators
  "byok",
  "open-source",
  "free-marketing-tools",
  "browser-only",
  "mit-license",
  // Stack
  "nextjs",
  "typescript",
  "tailwindcss",
  // Adjacent
  "marketing-automation",
  "ad-copywriting",
  "saas-alternative",
];

const ENABLE_FEATURES = {
  issues: true,
  discussions: true,
  wiki: false,
  projects: false,
};

// ─── Implementation ─────────────────────────────────────────────────────────

function which(cmd) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" });
  return r.status === 0;
}

function gh(args, opts = {}) {
  const r = spawnSync("gh", args, { encoding: "utf8", ...opts });
  if (r.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

function inferRepo() {
  // 1. CLI override
  if (process.argv[2] && process.argv[2].includes("/")) return process.argv[2];
  // 2. gh repo view
  try {
    return JSON.parse(gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
  } catch {
    /* fallthrough */
  }
  // 3. parse git remote
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
    const m = remote.match(/[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {
    /* fallthrough */
  }
  throw new Error("Couldn't infer the repo. Pass one as the first arg: node scripts/setup-github.cjs owner/repo");
}

function checkAuth() {
  const r = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error("\n❌ Not logged in to GitHub.");
    console.error("   Run: gh auth login");
    console.error("   Then re-run this script.\n");
    process.exit(1);
  }
}

function main() {
  if (!which("gh")) {
    console.error("\n❌ GitHub CLI (gh) is not installed.");
    console.error("   Install: https://cli.github.com/manual/installation");
    console.error("   Then run: gh auth login");
    console.error("   Then re-run this script.\n");
    process.exit(1);
  }
  checkAuth();
  const repo = inferRepo();
  console.log(`\n→ Configuring ${repo}\n`);

  console.log("✓ Setting description + homepage…");
  gh([
    "repo", "edit", repo,
    "--description", REPO_DESCRIPTION,
    "--homepage", HOMEPAGE_URL,
  ]);

  console.log("✓ Setting features (issues, discussions, wiki, projects)…");
  // gh repo edit uses --enable-* flags
  gh([
    "repo", "edit", repo,
    `--enable-issues=${ENABLE_FEATURES.issues}`,
    `--enable-discussions=${ENABLE_FEATURES.discussions}`,
    `--enable-wiki=${ENABLE_FEATURES.wiki}`,
    `--enable-projects=${ENABLE_FEATURES.projects}`,
  ]);

  console.log(`✓ Setting ${TOPICS.length} topics…`);
  // gh accepts repeated --add-topic flags. Clear first by reading current
  // and using --remove-topic, but the simpler approach is to set all topics
  // in one call via the REST API.
  // The topics REST endpoint expects an array (`names[]`). Sending a scalar
  // `names=<comma-joined>` alongside it makes GitHub 422 the whole request
  // (which aborts one-shot setup). Send ONLY the array form. (Audit finding.)
  gh([
    "api", `repos/${repo}/topics`,
    "--method", "PUT",
    "-H", "Accept: application/vnd.github.mercy-preview+json",
  ].concat(TOPICS.flatMap((t) => ["-f", `names[]=${t}`])));

  // Note: GitHub does NOT expose social preview image upload via the REST API
  // or gh CLI as of the current version. Surface a clear next step instead of
  // failing silently.
  const ogImage = path.join(__dirname, "..", "public", "og-image.png");
  if (fs.existsSync(ogImage)) {
    console.log("\n📷 Social preview image:");
    console.log(`   GitHub doesn't expose this via API. Upload manually:`);
    console.log(`     1. https://github.com/${repo}/settings`);
    console.log(`     2. Scroll to "Social preview" → "Edit"`);
    console.log(`     3. Upload: ${ogImage}`);
    console.log(`   (1200×630, already optimized — was generated by scripts/render-og.cjs.)`);
  }

  console.log(`\n✅ Done. Visit https://github.com/${repo} to verify.`);
  console.log(`   Description: ${REPO_DESCRIPTION}`);
  console.log(`   Homepage:    ${HOMEPAGE_URL}`);
  console.log(`   Topics:      ${TOPICS.join(", ")}\n`);
}

try {
  main();
} catch (e) {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
}
