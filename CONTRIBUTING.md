# Contributing to OpenAdKit

Thanks for thinking about contributing. OpenAdKit is browser-only, BYOK, open source. There is no backend to deploy, no secrets to share, and no telemetry — meaning every contribution lands in production the moment it's merged. That focuses the work nicely.

## Quick start

```bash
git clone https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool.git openadkit
cd openadkit
npm install
npm run dev
```

Open http://localhost:3000, paste your Claude API key, you're in.

Node 20.9+ is required by Next.js 16 — `.nvmrc` pins 24 (LTS). If your team is on an older Node, run via Docker (`docker build -t openadkit . && docker run -p 3005:3005 openadkit`) — no Node install needed.

## Project shape

```
app/                      Next.js App Router pages
components/               React UI primitives
lib/
  ├── claude.ts           Claude API wrapper (streaming + non-streaming)
  ├── stream-hook.ts      Throttled stream accumulator (one render per frame)
  ├── brand-brain.ts      Brand Brain types + system-prompt builder
  ├── storage.ts          Dexie/IndexedDB schema
  ├── settings.ts         localStorage layer
  ├── generator-config.ts Shared shape for generator pages
  ├── checklists.ts       Daily/weekly/monthly checklist data
  ├── learn-content.ts    Concept library index
  └── prompts/            One Claude prompt template per file
```

## Adding a new generator (10 min)

Most contributions will fall into this pattern. Example: adding "Pinterest Pin Ads".

1. **Prompt** — create `lib/prompts/pinterest-ads.ts`. Export an `Input` interface and a `buildPinterestPrompt(input): string`. Include explicit char limits up top.
2. **Page** — create `app/generate/pinterest/page.tsx`. Use `GeneratorShell` with a `GeneratorConfig`. Look at `app/generate/twitter/page.tsx` for the shortest example, or `app/generate/google/page.tsx` for the fullest output renderer.
3. **Sidebar** — add a nav entry in `components/Sidebar.tsx` under the Generate group.

That's it. The `GeneratorShell` handles streaming, character counts, history saving, cost tracking, Brand Brain injection, error state, and the abort button — you write the prompt and the output renderer.

## Prompt engineering conventions

These are the patterns OpenAdKit prompts follow. Borrow them when adding new ones:

1. **Self-counted char limits with overage flags.** Every length-constrained field in the JSON schema should include a `chars` field and a `status: "ok"|"over"` field, with a `trimmed_alt` for overages. Don't trust the model to silently respect limits.
2. **Declare angles first.** For ad-copy prompts, require the model to emit an `angles[]` array before writing variants. Variants reference angles by label.
3. **Combinability clause** (Google Copycat pattern, verbatim): "Each variant must make sense standalone AND in any combination together."
4. **Cascade from tightest constraint outward.** When generating multi-platform output, start at Google 30-char and expand to Meta 40, LinkedIn 150, etc. Don't write long-form first.
5. **Pulse metrics, never letter grades.** For audit/optimization prompts: return 3 numbers with named contributors + fix pointers. Reject letter grades or hidden-reasoning scores.
6. **"Name names" rule.** Every observation must NAME the specific phrase, campaign, keyword, or asset — never "some keywords are weak."
7. **STOP conditions before optimization.** If tracking is broken, the prompt should halt and tell the user to fix that first, refusing to recommend changes.
8. **Mode declaration.** Two-mode prompts (scratch vs iterate-from-data) should declare their mode at the top of the response.
9. **Severity tiers with fix-time SLAs.** Use critical / high / medium / low with explicit time windows.

## Code conventions

- **TypeScript strict.** No `any` escape hatches unless you really mean it.
- **Streaming everywhere.** Never call the non-streaming Claude path for user-facing generators. `useThrottledStream` + `streamClaude` is the pattern.
- **No backend.** Don't add API routes that proxy to Anthropic. The whole product runs in the browser by design.
- **No telemetry, no analytics calls.** Period.
- **Font + color tokens** are defined in `tailwind.config.ts`. Use semantic classes (`text-live`, `border-base-600`) rather than raw colors.
- **Prefer hairline borders over cards.** Density-first.

## Performance

- Stream-throttled at `requestAnimationFrame` to avoid jitter at high token rates.
- All routes statically prerendered; client work runs in browser only.
- Memoize output renderers when they're heavy. The `GeneratorShell` already memoizes input fields.
- Use `next/font/google` for self-hosted fonts (no CDN waterfall).

## Privacy & security

- Never log or store the API key outside `localStorage`.
- Never add any `fetch()` to a server you don't fully trust. The only outbound calls OpenAdKit makes are to the API host of whichever AI provider the user selected (see `lib/providers/`), plus the optional URL reader used by brand extraction.
- Don't ship any analytics or feature flag SDK.

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Tested in browser with a real provider key (any of the 9 — Groq and Gemini have free tiers)
- [ ] No new outbound network calls except the selected provider's API host
- [ ] No new env vars (BYOK only — there are no server secrets)
- [ ] Prompts include character-limit self-validation
- [ ] No new fonts loaded from external CDN (use `next/font`)

## License

By contributing, you agree your contribution will be licensed under MIT.
