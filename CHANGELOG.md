# Changelog

All notable changes to OpenAdKit are tracked here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

[Unreleased]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/tag/v0.1.0
