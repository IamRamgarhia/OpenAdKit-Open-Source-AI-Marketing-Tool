# Contributing to OpenAdKit

Thanks for thinking about contributing. OpenAdKit is open source, bring-your-own-key and local-first: there are no accounts, no server secrets and no telemetry. That keeps the work focused.

Not a developer? You can still help a lot: [report a bug](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/issues/new), suggest a generator your clients need, or improve the docs.

## Quick start

```bash
git clone https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool.git openadkit
cd openadkit
npm install
npm run dev
```

Open <http://localhost:3005>, paste a key for any of the 9 providers (Groq and Gemini have free tiers), and you're in.

Node 20.9+ is required (Next.js 16); `.nvmrc` pins 24 (LTS). No Node? Use Docker: `docker build -t openadkit . && docker run -p 3005:3005 openadkit`.

To try the full local app (production server + sync sidecar, like the installers ship), run `npm run build` once, then `OpenAdKit.bat` (Windows) or `bash OpenAdKit.command` (macOS / Linux).

## Project shape

```
app/                      Next.js App Router pages (generate/, optimize/, research/, …)
components/               React UI (GeneratorShell, AdMockup, Sidebar, nav-config.ts, …)
lib/
  ├── llm.ts              Provider-agnostic call/stream + budget hard stop
  ├── providers/          The 9 AI providers (catalogs, pricing, streaming)
  ├── prompts/            One prompt template per tool
  ├── schemas/            Zod output schemas (tolerant of nulls / numeric strings)
  ├── tools/registry.ts   Framework-free tool registry used by the MCP server
  ├── tools/limits.ts     Hard platform character limits
  ├── brand-brain.ts      Brand Brain types + system-prompt builder
  ├── storage.ts          Dexie / IndexedDB schema, merge + tombstones
  ├── local-sync.ts       Folder-sync client (never syncs keys)
  ├── settings.ts         localStorage layer
  └── key-vault.ts        Optional key encryption
mcp/                      MCP server (server.ts, runtime.ts)
scripts/                  Sidecar (local-sync.cjs), launchers, build + release helpers
installer/                Windows WebView2 host + Inno Setup script
tests/                    Playwright suites + output-quality eval
```

## Adding a new generator

Most contributions follow this pattern. Example: adding "Pinterest Pin Ads".

1. **Prompt** — create `lib/prompts/pinterest-ads.ts`. Export an `Input` interface and a `buildPinterestPrompt(input): string`. Put the character limits up top.
2. **Schema** — add the output schema in `lib/schemas/generators.ts`, wrapped with `tolerant()` like the others.
3. **Page** — create `app/generate/pinterest/page.tsx` using `GeneratorShell` with a `GeneratorConfig`. `app/generate/twitter/page.tsx` is the shortest example; `app/generate/google/page.tsx` has the fullest output renderer.
4. **Sidebar** — add an entry in `components/nav-config.ts` under the right platform group.
5. **MCP** — add the tool to `lib/tools/registry.ts` so Claude Desktop / Claude Code / Cursor get it too. If the platform has hard limits, add them to `lib/tools/limits.ts`.
6. **Tests** — `lib/__tests__/prompt-schema-contract.test.ts` has a coverage guard: every schema wired into a page needs a contract entry proving the prompt's JSON example passes the schema.

`GeneratorShell` handles streaming, character counts, history saving, cost tracking, Brand Brain injection, schema validation with one correction retry, error state and the stop button — you write the prompt and the output renderer.

## Prompt conventions

1. **Self-counted character limits with overage flags.** Length-limited fields include `chars` and `status: "ok"|"over"`, with a `trimmed_alt` for overages. Don't trust the model to respect limits silently.
2. **Declare angles first.** Ad-copy prompts emit an `angles[]` array before variants; variants reference angles by label.
3. **Combinability clause** (Google pattern): "Each variant must make sense standalone AND in any combination together."
4. **Start from the tightest limit.** For multi-platform output, start at Google's 30 characters and expand outward.
5. **Numbers with named contributors, not letter grades.** Audit prompts return a few numbers with named reasons and fix pointers.
6. **"Name names."** Every observation names the specific phrase, keyword, campaign or asset.
7. **STOP conditions.** If tracking is broken, the prompt tells the user to fix that first.
8. **Mode declaration.** Two-mode prompts (from scratch vs from data) say which mode they're in.
9. **Severity tiers** (critical / high / medium / low) with time windows.
10. **No invented numbers or proof.** Only use social proof, stats and customer names that are in the Brand Brain. If a number can be computed (sample size, projections), compute it in code (`lib/ab-math.ts`, `lib/budget-estimates.ts`) and pass it to the model as a fact.

## Code conventions

- **TypeScript strict.** No `any` escape hatches unless you really mean it.
- **Streaming for user-facing generators** via `GeneratorShell` / `llmStream` and `useThrottledStream`.
- **No server-side AI calls.** AI requests go from the app straight to the user's chosen provider. Don't add API routes that proxy to providers.
- **No telemetry, no analytics calls.** Period.
- **Design tokens** live in the `@theme` block of `app/globals.css`. Use semantic classes (`text-live`, `border-base-600`) rather than raw colors.
- **React Compiler lint rules are errors** (`npm run lint`): no `setState` in effects, no impure calls during render.

## Privacy & security

- Never write API keys anywhere except the browser's `localStorage` (or the encrypted vault). `lib/local-sync.ts` `isSyncablePrefKey()` keeps them out of the sync file — keep it that way.
- The only outbound calls are the selected provider's API, the URL readers used for brand extraction, and GitHub release checks for updates. Don't add others.
- Don't ship analytics or feature-flag SDKs.

## Checks

```bash
npm run typecheck
npm test               # Vitest unit + integration tests
npm run lint
npm run build
npm run test:smoke     # Playwright, against a running production server (see .github/workflows/ci.yml)
npm run build:mcp      # if you touched the MCP server or registry
```

`npm run eval` runs every AI tool against a real provider (key in `.env.test.local`) and checks character limits, banned hype words, invented statistics and retries. It refuses to run without a key.

## PR checklist

- [ ] `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` pass
- [ ] Tested in the app with a real provider key (any of the 9)
- [ ] No new outbound network calls
- [ ] No new server secrets (BYOK only)
- [ ] Prompts include character-limit self-checks and don't invite invented numbers
- [ ] New generator added to `lib/tools/registry.ts` and the contract test
- [ ] No fonts loaded from an external CDN (use `next/font`)

## License

By contributing, you agree your contribution is licensed under MIT.
