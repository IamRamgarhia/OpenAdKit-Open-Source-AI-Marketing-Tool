# Changelog

All notable changes to OpenAdKit are tracked here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- **Adding a client by hand needs only the business name.** Platforms,
  content pillars and social links no longer block saving; they're recorded
  as "fill later" automatically.
- **Email is its own platform** for saved email-subject runs (was filed as
  "display"); History can filter by it.
- **robots.txt is generated** (`app/robots.ts`) so its Sitemap line points at
  the deployment's own origin, like the sitemap; `/support` is crawlable.

### Added
- winget manifests for `DiceCodes.OpenAdKit` 2.0.0 (`packaging/winget/`,
  validated with `winget validate`); submit after the release is published.

### Fixed
- Returning users with a key no longer see the landing page flash before the
  dashboard on `/` (a pre-paint marker hides it; crawlers still get the
  server-rendered landing page).

## [2.0.0] — 2026-11-20

### Added
- **Desktop apps.** Windows: `OpenAdKit-Windows-Setup.exe` (per-user, no
  admin) with a native WebView2 window, bundled Node 24 LTS, single instance,
  clean shutdown. macOS / Linux: one-line `install.sh` (verified downloads,
  `OpenAdKit.app` on Mac, app-menu entry + `openadkit` command on Linux,
  `--uninstall` keeps data). Windows one-liner `install.ps1`.
- **Update notifications.** Installed copies check GitHub releases (once a day,
  can be turned off in Settings). Windows updates in one click: the Setup is
  downloaded, verified against the release's SHA256SUMS and installed
  silently, then OpenAdKit reopens. macOS/Linux get the install command.
- **MCP server** (`openadkit-mcp`) for Claude Desktop, Claude Code, Cursor and
  any MCP client: 30 generators/optimizers/research tools plus `list_brands`,
  `get_brand`, `validate_output`, `openadkit_status`. Works with an AI key
  (generates, validates, retries) or without one (returns the prompt + JSON
  Schema; the assistant writes it and validates). Platform character limits
  enforced. Bundled in the installers; the Windows installer can connect it
  to Claude Desktop; Settings shows the exact config for this install.
- **Support & about page** (UPI QR, PayPal, star / share / report, Work with
  DiceCodes), sidebar credit, FUNDING.yml.
- **Honest numbers.** A/B sample size and duration computed with the
  two-proportion formula; budget projections computed from your inputs or
  labelled benchmark midpoints; creative-score CTR labelled an AI estimate.
- Public learn / benchmarks / platforms / decision-tree pages (no key needed)
  and a real landing page at `/`.
- Campaign picker on history and generator results; manual "Save to history".
- `npm run eval`: real-output evaluation of all AI tools (needs a key).

### Fixed (highlights of ~110 audit findings)
- Prompts asked for `null` fields the schemas rejected → a wasted correction
  call on most runs (7 generators). Contract test now covers all 32 pairs.
- Claude 5.5 models added with correct pricing (Sonnet 5 was billed 50% high);
  request bodies match each model's thinking / sampling rules.
- Truncated or refused AI replies now say so instead of "wrong shape".
- Sync merge is per-row by `updated_at` with tombstones: no lost edits, no
  resurrected deletes. API keys and vault material never reach the sync file.
- Budget hard stop enforced for every AI call; key vault encrypts keys saved
  while locked.
- Security: ReDoS-safe HTML stripping, DNS-pinned SSRF guard in the sidecar,
  rate limit no longer bypassable via `X-Forwarded-For`.
- Launch scripts work from any folder; Mac `.command` / `.sh` are executable;
  packaged apps honour the port they were given.
- Over-limit ad text (e.g. 31-character Google headlines) is rejected with the
  exact field to shorten; prompts no longer push models to invent proof.

### Changed — platform upgrade (v2 phase 1)
- **Next.js 14.2.5 → 16.4.6** (Turbopack). Closes a critical Next.js advisory
  and the high-severity zod / postcss / nanoid / source-map-js advisories:
  `npm audit` now reports 0 vulnerabilities. Production build time 44s → ~23s.
- **React 19, Tailwind CSS 4, Zod 4, Dexie 4.4, Zustand 5, lucide-react 1,
  ESLint 9 (flat config), Vitest 5, TypeScript 5.9.** Node 20.9+ required;
  `.nvmrc`, Docker and CI move to Node 24 LTS (CI matrix 22 / 24 / 26).
- **The local app now runs the production server, not `next dev`.**
  `output: "standalone"` + `scripts/prepare-standalone.cjs`; the launcher
  sidecar starts `.next/standalone/server.js` (≈1s to ready) and only falls
  back to dev mode when no build exists or `OPENADKIT_WEB_MODE=dev` is set.
  Launchers and one-line installers run `npm run build` once. `npm start`
  serves the standalone build.
- Docker image is built from the standalone output (no dev dependencies,
  correct file ownership for the non-root user).

### Fixed
- **Launcher "Restart" killed the new web server on macOS/Linux.** A delayed
  SIGKILL aimed at the old process hit the replacement, and the old process's
  exit handler marked the new one as down. Stop/restart now track the exact
  child and wait for its real exit.
- **SIGINT/SIGTERM left the web server running** (the lock handler exited
  before cleanup ran). One shutdown path now stops the web child first.
- **Every build dirtied the git tree** (`public/sw.js` stamped in place, OG
  image re-rendered), which made the launcher's auto-update refuse to run.
  The service worker is now versioned through its registration URL, and the
  OG render is a manual `npm run og:render` step.
- Brand logo icons removed from lucide 1.x replaced with neutral icons.

## [1.1.0] — 2026-08-01

### Fixed — critical
- **Gemini streaming had never worked.** Google terminates SSE events with
  `\r\n\r\n`; all three stream parsers split on the literal `"\n\n"`, which
  never matched, so no event was ever parsed and every Gemini generation
  returned empty text. The in-repo comment describing this as "Gemini
  occasionally returns `res.text` empty" was this bug misdiagnosed as
  intermittent. All parsers now split on `SSE_EVENT_DELIMITER` (`/\r?\n\r?\n/`),
  covered by `lib/__tests__/sse-parsing.test.ts`.
- **Two providers rejected valid API keys.** Cerebras and OpenRouter had a
  `default_model` *and* a `testModel` that had both been decommissioned, so key
  verification 404'd against a model that no longer existed and told the user
  their key was bad. Every provider catalog was re-verified against first-party
  documentation; ~20 withdrawn model IDs are now listed in `RETIRED_MODEL_IDS`
  and migrated on read, and `npm run models:check` checks the catalog against
  live provider APIs (keyless, via OpenRouter's public catalog).
- **An invalid key could be reported as valid and saved.** Key verification
  classified purely on HTTP status, but Google returns **400** — not 401 — for a
  bad key, so a typo'd key showed "Key appears valid — saved". Classification
  now matches the provider's error *text* first and falls back to status
  (`classifyKeyCheckError`), and only saves when the key is genuinely
  authenticated. 429 / 5xx / 402 still count as authenticated; 400 does not.
- **The local sidecar was unreachable on most installs.** The browser hardcoded
  `127.0.0.1:3006` in three places while `scripts/resolve-ports.cjs` assigned a
  free high-range port at launch — so folder sync silently never ran and URL
  ingest silently skipped its most reliable reader and fell through to
  rate-limited third parties, while reporting "is the launcher running?" when it
  was. The port now flows one way: resolver → `.env.local`
  (`NEXT_PUBLIC_ADFORGE_SYNC_PORT`) → `lib/sync-endpoint.ts` → every caller,
  with a runtime probe as a safety net.
- **Anthropic cost estimates were 3× too high.** Opus 4.7 was priced at
  `$15/$75` per MTok against a real rate of `$5/$25`, inflating the spend
  counter, per-client rollups, and extraction previews. Catalog refreshed
  (Opus 5 / Sonnet 5 added, date-suffixed Haiku ID corrected) with
  `lib/__tests__/providers-catalog.test.ts` guarding every checkable invariant.
- **Importing a backup could white-screen History and the dashboard.**
  `importAll()` normalized brains but wrote ads/campaigns/templates/checklist
  rows raw, so a row missing `cost_usd` crashed the render on `.toFixed()`.
  Every table now has a normalizer (`lib/normalize.ts`), applied on import
  *and* on read.

### Fixed — high
- Settings is no longer behind `ApiKeyGate` — the page used to add a key
  required already having one, so the StatusBar's "No key" link bounced to
  `/setup` and deleting your only key locked you out. Saving a verified key now
  also activates that provider when none is active.
- Checklists no longer require an API key (they make no LLM calls).
- Batch mode no longer blanks the streamed output when a provider returns an
  empty `res.text`, treats Stop as a cancel rather than a failure, and now runs
  the same schema-validate + correction pass as the single generators.
- Sidecar CSRF allowlist narrowed to this install's two ports (it accepted
  anything on 3000–3030, where most local dev servers live); added a `Host`
  header check to defeat DNS rebinding on the read-only GET endpoints.
- `/api/ingest` is rate limited per IP, pins validated DNS results into the
  connection to close a rebinding TOCTOU, and blocks CGNAT (100.64/10).
- Image uploads no longer freeze the tab: base64 encoding is chunked instead of
  per-byte string concatenation, and the size cap accounts for base64 inflation.

### Fixed — medium / low
- **Cost formatting broke hydration.** `formatCost` switched from USD to the
  user's currency on a bare `requestAnimationFrame` at module load — which is
  not the moment React finishes hydrating, and regularly fires before it. The
  first client render therefore used the currency path while the server markup
  was plain USD (`$0.03` vs `$0.0264`), producing React #418/#423/#425. It hid
  behind values where both paths agree, such as the StatusBar's `$0.0000`. The
  flag is now set from a `useEffect`, which cannot run before hydration
  completes. (Supersedes the partial fix shipped in 1.0.0.)
- Google's rate-limit responses now surface the provider's own retry delay and
  verbatim message to the user instead of a generic failure, and the response
  body is read once rather than twice.
- The "configured" provider badge and count read saved keys rather than the
  contents of the key input box, so an unsaved draft no longer reads as saved.
- Generator query-param overrides are filtered against the generator's own
  fields (they used to write every param into form state and persist it).
- Schema-correction retries now re-send attached images and roll their cost
  into the saved ad.
- Service worker no longer forces a spurious reload on the first visit.
- StatusBar refreshes on a 15s cadence with an isolated 1s clock, instead of
  re-parsing the whole quota log every second.
- Exports defer `revokeObjectURL` (Firefox/Safari could cancel the download).
- History export menu is keyboard/screen-reader accessible.
- ISO-8601 week numbering for weekly checklist streaks; progress can no longer
  exceed 100%.
- Wizard failover skips providers already known to be rate-limited.
- `metadataBase` and JSON-LD URLs come from `NEXT_PUBLIC_SITE_URL`; `lint` is
  enforced in CI.

### Added
- **Provider comparison — "Which AI should I use?" (`/providers`).** Free-tier
  caps, per-run cost, and vision support for all 9 providers, plus a *measured*
  half computed from your own generation history: runs, spend, and the rate at
  which each provider's first reply failed schema validation and had to be
  re-asked. Deliberately ships **no quality score** — there is no ground truth
  for ad copy, so a ranking would be invented. Retry rate is the honest proxy,
  because it is observable and it doubles what you pay.
- **Structured free-tier data for every provider** (`FreeTier` in
  `lib/provider-limits.ts`: requests/minute, requests/day, whether a card is
  required, and a caveat). Google's entry previously claimed 1,500 requests/day;
  a live 429 measured roughly **20/day on `gemini-3.6-flash`**, because Google's
  free limits are per *model*. `lib/quota-tracker.ts` now re-exports the caps
  instead of keeping a second hardcoded copy — the duplicate was justified by an
  import cycle that does not exist, and the two copies had drifted apart.
- **Per-run token and cost counter.** Every generation reports input, output and
  total tokens with its dollar cost, the model that produced it, and whether a
  schema-correction retry is included in the figure.
- **Rate-limit transparency.** When a provider refuses on quota, the exact
  message it returned is shown verbatim alongside a countdown to retry.
- **Monthly spend budget** with an 80% warning and an optional hard stop,
  computed from real history rather than lifetime counters (`lib/budget.ts`).
- **Brand brain version history** — the last 5 saves are snapshotted and
  restorable, so a bad re-extraction is no longer a one-way door.
- **Regenerate & compare** — re-run any saved generation on a different
  model/provider and diff the two outputs side by side.
- **Optional API-key encryption at rest** (PBKDF2 + AES-GCM, unlocked once per
  session). Off by default; documented honestly about what it does and doesn't
  protect against.
- Anthropic prompt caching for the brand-brain system prompt, with cache-aware
  cost estimation.

### Internal
- Test suite grown to 402 unit assertions across 13 files and 60 browser tests.
  New coverage: provider catalogs, free-tier consistency, SSE parsing, storage
  normalizers, budget math, key-check classification, and a check that every
  sidebar link resolves to a real page with a query value the target offers.
- ESLint config added (the repo had none, so `next lint` prompted interactively
  and could never run in CI); lint is now enforced in CI.
- `npm run test:live` runs a real end-to-end generation when a key is present in
  `.env.test.local`, and skips cleanly when it is not.

## [1.0.0] — 2026-07-03

### Added — generators
- Google Performance Max asset generator (`/generate/google-pmax`)
- Google Shopping listing optimizer (`/generate/google-shopping`)
- TikTok Spark Ads creator brief (`/generate/spark-ads`)
- Email subject-line generator (`/generate/email-subjects`)
- Native Lead Form generator for Meta / LinkedIn / Google / TikTok (`/generate/lead-form`)

### Added — optimization
- Audience Targeting planner (three-tier cold/warm/hot, `/optimize/audience`)
- Ad Budget Planner with daily-amount breakouts and break-even (`/optimize/budget-planner`)

### Added — learn
- Mini-course tracks with 28 pre-written lessons: Google (10), Meta (10), TikTok (8). Each lesson includes a "quick action" sidebar and an in-app practice prompt that links to a relevant generator (`/learn/courses`).

### Added — history
- Status tagging (draft / testing / live / paused / winner / loser)
- Star favorites
- Per-entry notes
- Status + starred filter chips
- Per-Brand-Brain JSON export/import via storage API

### Added — onboarding
- Multi-step setup wizard (5 steps): key + verify · model · experience level · primary platform · quick Brand Brain

### Added — mobile
- Mobile nav drawer (sidebar was desktop-only — now hamburger button on `<768px`)
- Top-padding adjustment to clear the mobile menu button

### Added — PWA
- Service worker for offline app shell (Claude API calls always run live; never cached)
- Service worker registers automatically in production builds only

### Added — open source infra
- GitHub Actions CI workflow (typecheck + build + lint on Node 18/20/22)
- Issue templates: bug report + feature request (no blank issues)
- PR template with scope/verification checklist
- `SECURITY.md` with threat model + responsible disclosure flow
- This `CHANGELOG.md`

### Security — audit pass
- Local sidecar CSRF: all state-changing requests (`POST /snapshot`, `/update/apply`, `/quit`, `/web/*`, `/config`) now reject cross-origin callers (403). The previous guard only reflected CORS headers and never blocked the side effect, so any open browser tab could wipe saved data or trigger `git pull` + `npm install`. Same-origin app/launcher calls and non-browser callers (no `Origin` header) are unaffected.
- URL-ingest SSRF hardening (`app/api/ingest/route.ts`, sidecar `/ingest`, `lib/server/url-helpers.ts`): the private-host guard now strips IPv6 brackets and unwraps IPv4-mapped addresses (`[::1]`, `::ffff:169.254.169.254` were bypassing it), and both fetch paths resolve the hostname via DNS and reject any private / loopback / link-local result on the initial URL and every redirect hop — closing decimal/hex IP encodings and DNS-rebinding. Added regression tests for the bracketed forms.
- Self-hosted / Docker deployments now emit the security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP `frame-ancestors`) via `next.config.mjs`, not just `vercel.json`.

### Fixed — audit pass
- Streaming: never save a blank generation — the generator now reads the accumulated buffer via `useThrottledStream().getText()` instead of a stale closure value (empty output on providers like Gemini that return an empty final `text`).
- Streaming: surface mid-stream provider `error` events (OpenAI-compatible + Google) instead of silently returning truncated output; stream readers release their lock on error; tolerate `data:` frames with no trailing space.
- OpenAI: `gpt-5` / `gpt-5-mini` (and o-series) now send `max_completion_tokens` and omit `temperature`, which those models reject with HTTP 400.
- JSON parsing: `tryParseJson` recovers top-level arrays wrapped in prose, not just objects.
- Gemini: include `thoughtsTokenCount` in output tokens (cost was under-reported for 2.5 thinking models); send the API key via the `x-goog-api-key` header instead of the URL query string.
- SEO: removed the root-layout blanket `canonical: "/"` that made every page a declared duplicate of the homepage (defeating `sitemap.ts`).
- Cost display: fixed a hydration mismatch for non-USD users (`formatCost` renders USD on the server and first client paint, then converts).
- Storage/state: usage counters guard against `NaN`; the daily quota resets on the UTC calendar day instead of a rolling 24h window; `logPerformance` writes atomically; backup/brain import raises a friendly error on malformed JSON instead of a raw parser exception.
- Brand Brain: a `null` array field in a stored/imported brain no longer throws and breaks every generation for that brain.
- Local sync: a sidecar started after page load is now detected (probe no longer caches a permanent "unavailable"); boot no longer double-registers listeners/intervals under React StrictMode.
- Creative Score: schema accepts stringified scores / mixed-case tier / missing reason instead of rejecting valid model output; the Google RSA renderer no longer crashes on a headline missing `text`.
- Brand extraction: a high-quality Organization logo is no longer clobbered by a tiny favicon; a non-array JSON-LD `@graph` no longer aborts extraction; industry-template matching uses word boundaries (a "coffee shop" no longer gets fashion-DTC defaults).
- Launcher: `.env.local` writes preserve user keys (API keys, flags) instead of rewriting the file with only the two ports; `npm run start:all` no longer spawns a duplicate Next server; `stop.sh` / `stop.bat` kill the actual resolved ports instead of hardcoded 3005/3006; the GitHub setup script sends a valid topics payload.
- UI/a11y: real focus management + Escape-to-close for the command palette and feature tour; `fillEmptyWithAi` is cancelable on unmount; undo toasts survive a failing undo and no longer drop queued toasts on a race; deleting a checked custom checklist item no longer pushes progress past 100%; inline code no longer double-escapes.
- Docker: `EXPOSE 3005` (the port the app binds), `npm ci` for reproducible builds, and a non-root `USER`.

## [0.1.0] — Initial public release

### Added — foundation
- BYOK Claude API direct from browser (`anthropic-dangerous-direct-browser-access`)
- Models: Claude Opus 4.7, Sonnet 4.6, Haiku 4.5
- Streaming with `requestAnimationFrame`-throttled rendering
- IndexedDB storage via Dexie + localStorage for settings
- Backup / restore / wipe in Settings

### Added — generators
- Google RSA (15 headlines + 4 descriptions + extensions + Quality Score tips)
- Meta Feed / Stories / Reels / Carousel
- TikTok Hooks (50/click) + UGC scripts
- YouTube In-stream / Bumper / Discovery
- LinkedIn Sponsored / Message / Dynamic / Text / Lead Gen
- Twitter / X — 5 variants or thread
- Display banners — every standard size + responsive assets
- Full Campaign Kit — one brief, every platform

### Added — optimize
- CTR Optimizer (5-lever scored diagnosis + rewrites)
- Quality Score Improver (3-factor diagnosis)
- Budget Waste Analyzer (3 pulse metrics + 20-question audit)
- A/B Test Planner (sample-sized, kill/winner rules)
- Keyword Strategy Builder
- Landing Page Grader (8 levers + exact-quote rewrites)
- Bid Strategy Advisor (matched to conversion volume)
- Ad Fatigue Detector

### Added — routines
- Daily / Weekly / Monthly checklists with persisted streaks and auto-reset per period

### Added — learn (initial)
- 25 concept entries with on-demand Claude explanations

### Added — strategy + report
- "What ad should I run?" strategy recommender
- Campaign report generator (markdown, client-ready)

### Added — UI
- Hand-rolled "Trading Terminal × Editorial" dark UI
- Persistent status bar (model / spend / tokens / live time)
- Scope-prefixed page headers
- Char-validation badges + animated saffron caret on live AI streaming
- Manrope + JetBrains Mono + Instrument Serif via `next/font/google`

### Added — open source
- MIT license
- README with 4 install paths (npm, Vercel, Docker, static export)
- CONTRIBUTING.md with prompt-engineering conventions

[Unreleased]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/tag/v0.1.0
