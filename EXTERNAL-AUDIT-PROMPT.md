# Prompt for an external AI code audit

Copy everything between the `---` lines below into ChatGPT / Gemini / another Claude / any AI you trust, then paste in the relevant code (or point it at the GitHub repo if it has web access). The prompt is self-contained — the model doesn't need follow-up questions.

---

You are a senior staff engineer doing an independent code audit of **AdForge**, a production-bound web app. The codebase has already been through one round of internal audit + fixes — your job is to find what we missed.

## Project context

**AdForge** is an open-source, browser-only AI ad operations cockpit:
- **Stack**: Next.js 14 (App Router) + TypeScript strict + Tailwind + IndexedDB (Dexie) + zero-dependency Node sidecar
- **Architecture**: 100% client-side. No backend. User's API keys live in `localStorage`; calls go directly from browser to provider APIs.
- **Providers**: 9 LLM providers supported (Anthropic, OpenAI, Google Gemini, Groq, Cerebras, OpenRouter, Together, DeepSeek, Mistral) via a unified `lib/llm.ts` + `lib/providers/*` abstraction.
- **Repo**: `https://github.com/IamRamgarhia/AdForge`
- **Scale**: 56 routes — 18 generators, 11 optimizers, 3 research tools, launch wizard, brand-brain onboarding, history/campaigns, settings.

## What's already been audited + fixed

Don't re-flag these. They're done:

1. **Brand extraction pipeline** rewritten with 6 phases: subpages ingest, deterministic metadata fill, AI pass 1, gap-fill pass, auto-Google augmentation, industry-template fallback.
2. **Sidecar security**: SSRF blocked on `/ingest` URL + every redirect target (private-IP guard). CSRF blocked via origin allowlist on all mutating endpoints. `/update/apply` race fixed. `/config` port validation.
3. **LLM provider layer**: `stream_options.include_usage` made opt-in per provider (Mistral rejects it). 3-arg `estimateCostUsd(providerId, modelId, usage)` migrated everywhere. `res.text || stream.text` fallback for Gemini empty-text quirk.
4. **Data integrity**: `normalizeBrandBrain` applied in `importBrain` + `importAll`. Active brand ID cleared on delete. Snapshot reconciles dangling references.
5. **Rate-limit handling**: Per-provider quota tracker (RPM + RPD counters) in `lib/quota-tracker.ts`. 429 retry-after parsed and surfaced. ProviderSwitcher renders inline on rate-limit panels.
6. **Currency**: 12 currencies including INR. `getCurrency()` + `formatMoney()` + `parseMoneyInput()`. Budget labels currency-agnostic.
7. **PWA**: Manifest icons, favicon, OpenGraph + Twitter metadata, sitemap.ts, robots.txt.
8. **Dynamic routes**: All 4 `[param]` routes have `generateStaticParams` + `dynamicParams = false`.
9. **AbortController**: Wired into onboarding (URL + paste + Google + vision), launch wizard, batch mode, BrandBrainForm, learn/[concept], suggestions.
10. **Per-tool sweep**: 4 BLOCKERS + 12 HIGH + 6 MEDIUM fixed across generators (display CharBadge, hashtags non-IG, google-shopping policy_warnings, LinkedIn format.replace) and optimizers (5 unconditional vision blocks, budget-planner $ hardcoding, landing-page dead URL field labeled honestly).
11. **Smoke tests**: 47/47 Playwright tests pass — every route renders without runtime errors in headless Chromium.

Two prior audit reports live in the repo: `AUDIT-FINDINGS.md` (first pass) and `TEST-SCENARIOS.md` (per-tool expected behavior). Read those first to understand what's been considered.

## Your job

Find concrete defects we missed. Specifically look for:

### Category A — Hidden runtime bugs
- Stale closures in `useEffect` deps that cause silent state divergence
- Promise.allSettled callsites where a `rejected` result silently corrupts saved state
- IndexedDB transactions that throw on schema migration (Dexie version bump missing)
- Service worker fetch handler bypassing the "never intercept" list for new domains
- Race conditions between localStorage events from different tabs

### Category B — AI cost/correctness leaks
- Token usage NOT being recorded on a code path (search for `llmCall(` and `llmStream(` calls and trace whether each is followed by `addUsage`)
- Prompts that grow unbounded with user-provided content (search for `${input.*}` with no length cap)
- JSON schema in a prompt that doesn't match what the renderer expects (silent data loss)
- Vision input attached but provider not actually vision-capable (silent text-only fallback)

### Category C — Security
- Any code that writes API keys to a destination other than the specific provider's hostname
- `dangerouslySetInnerHTML` rendering user/AI content without escape
- `href={userInput}` allowing `javascript:` schemes
- Sidecar endpoints that accept user input without validation
- Service worker that caches authenticated responses
- Auto-update flow that runs git/npm commands with user-controlled arguments

### Category D — Data integrity at scale
- Soft-delete bypasses (queries that read deleted rows)
- Schema migrations that fail mid-flight, leaving rows in inconsistent state
- Multi-tab races on shared `localStorage` keys
- Export → wipe → import flows that lose data
- 429-handling that doesn't reset the quota counter cleanly

### Category E — Production readiness
- Build-time secrets accidentally bundled (`NEXT_PUBLIC_*` vars)
- Hardcoded `localhost:*` URLs that ship to production
- Missing `Content-Security-Policy` headers
- `console.error` / `console.log` that ship to production with sensitive data
- Service worker version not bumped per deploy (stale cache)

## Output format

For every finding:

```
### [SEVERITY] file.ts:line — One-line symptom

**What's wrong:** 2-3 sentences. Quote the actual line.

**Why it matters:** What does the user see? Lost data? Wrong cost? Crash?

**Fix sketch:** 1-3 lines of code or a clear description.

**Confidence (0-100):** How sure are you this is a real issue, not a misread?

**Reproduction steps:** If applicable, exact steps a tester can follow to trigger it.
```

Severity scale (use it strictly):
- **BLOCKER (≥90 confidence)**: Crashes, loses user data, leaks secrets, or silently corrupts saved output.
- **HIGH (75–89)**: Fires on common user paths. User-visible failure or wrong result.
- **MEDIUM (60–74)**: Real issue but rare conditions or graceful degradation.
- **LOW (<60)**: Skip unless trivial security.

## Hard rules

1. **No inventing issues.** If you can't trace it to specific code, mark "open question," don't report it as a finding.
2. **No style preferences.** Indentation, naming, "could be cleaner" — skip entirely.
3. **No things a typechecker / linter / compiler would catch.** Those are caught in CI.
4. **Cite file:line for every finding.** No hand-waving.
5. **Don't re-flag the 11 categories listed under "What's already been audited."** Verify they're truly fixed if you want, but don't claim credit for finding them.
6. **Focus on defects, not improvements.** "Could use a better React pattern" is not a defect. "This silently drops user input" is.

## What "done" looks like

A single Markdown report with:
- A summary header counting findings by severity
- One finding block per issue, in the format above, sorted by severity (BLOCKER first)
- A final section listing what you **verified is correct** (so we know the audit was thorough, not just unable to find bugs)

If you find zero defects above MEDIUM, say so explicitly. Don't pad.

---

## Tips for paste-into-X

**If the model has web access** (Gemini, ChatGPT with browsing, Perplexity): also tell it
> Browse the repo at `https://github.com/IamRamgarhia/AdForge`. Start with `AUDIT-FINDINGS.md`, then `TEST-SCENARIOS.md`, then walk `lib/`, `components/`, `app/` in that order.

**If the model has no web access** (raw Claude in claude.ai, GPT without browsing): export the relevant directories first
```
# From the repo root, generate a single concatenated file for upload
git archive HEAD lib components app scripts | tar -tvf - | head -50  # preview
git archive HEAD lib components app scripts public/sw.js -o adforge-source.tar
```
Then upload the tar / paste key files. Start with `lib/llm.ts`, `lib/providers/*`, `components/GeneratorShell.tsx`, `app/brand/new/page.tsx`, `app/launch/wizard/page.tsx`, and `scripts/local-sync.cjs` — those carry the most logic.

**For Codex / Cursor / similar IDE-integrated AIs**: just open the repo and paste the prompt; they'll have file access automatically.
