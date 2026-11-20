# scripts/

Helper scripts for running, building and releasing OpenAdKit. If you installed OpenAdKit with the Windows Setup or the macOS / Linux install line, you don't need any of these — they're for people running from a source checkout and for maintainers.

## Running from a source checkout

| Script | What it does |
|---|---|
| `start.bat` / `start.sh` | Start OpenAdKit with a visible log window. Installs dependencies and builds on first run, picks ports, starts the sidecar (which starts the web app) and opens your browser. Works from any folder. `OPENADKIT_NO_BROWSER=1` skips opening the browser. |
| `stop.bat` / `stop.sh` | Stop everything: asks the sidecar to shut down cleanly, then frees any ports left over. Works from any folder. |
| `local-sync.cjs` | The sidecar (`npm run sync`). Zero npm dependencies. Serves the launcher control panel, starts the production web server, syncs your data to `snapshot.json` in your user data folder, reads brand websites for extraction, and checks for updates. Listens on `127.0.0.1` only. |
| `run-all.cjs` | `npm run start:all` — sidecar + Next.js **dev** server (hot reload) together, for contributors. |
| `start-prod.cjs` | `npm start` — run the production standalone server (needs `npm run build`). |
| `resolve-ports.cjs` | Picks a free port pair for this install so two copies never collide. |
| `set-domain.bat` / `set-domain.sh` | Add or remove an `openadkit.local` hosts-file entry (admin / sudo). See [docs/CUSTOM_DOMAIN.md](../docs/CUSTOM_DOMAIN.md). |
| `install/install.ps1`, `install/install.sh` | Older one-line installers that clone the repo, `npm install` and build. The prebuilt installers in the repo root (`install.ps1`, `install.sh`) are the recommended path now. |

## Building and releasing

| Script | What it does |
|---|---|
| `prepare-standalone.cjs` | Runs after `npm run build`: copies `public/` and `.next/static/` into `.next/standalone` so it runs on its own. |
| `build-mcp.cjs` | `npm run build:mcp` — bundles the MCP server into one file, `mcp/dist/openadkit-mcp.mjs`. See [docs/MCP.md](../docs/MCP.md). |
| `build-payload.cjs` | Assembles the release payload (`dist/payload` + `OpenAdKit-app.tar.gz`): the built app, sidecar, MCP server and icon. Refuses to include secrets or user data. |
| `build-windows-installer.cjs` | Builds the Windows app folder (WebView2 host + portable Node, both checked by SHA-256) and, with Inno Setup installed, `OpenAdKit-Windows-Setup.exe`. |
| `release-update.cjs` | Update checks for installed copies: compares with the latest GitHub release; on Windows downloads the new Setup and verifies it against `SHA256SUMS.txt`. |
| `register-mcp.cjs` | Adds / removes OpenAdKit in Claude Desktop's config without touching other servers (`--remove`, `--detect`, `--print`). Used by the installers. |
| `make-icons.cjs` | Renders `public/icon.svg` into the icon files the installers need. |
| `render-og.cjs` | `npm run og:render` — renders `public/og-image.svg` to PNG. |
| `capture-screenshots.cjs` | `npm run screenshots` — captures the README screenshots. |

## Quality checks

| Script | What it does |
|---|---|
| `eval.cjs` | `npm run eval` — runs every AI tool against a real provider (key in `.env.test.local`) and checks character limits, banned hype words, invented statistics, brand usage and retries. Refuses to run without a key. `--mcp-host` mode evaluates the MCP server's no-key prompt mode. |
| `check-models.cjs` | `npm run models:check` — checks the provider model catalog for retired or renamed models against live model lists (no keys needed). |
| `setup-github.cjs` | `npm run setup:github` — one-time repo metadata setup (needs `gh auth login`). |

## `refresh_knowledge.py` (optional maintainer tool)

Pulls current platform specs and benchmarks from public ad-platform docs using [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai) and your choice of LLM key. Writes a JSON delta + Markdown summary for review. Run it now and then to keep `lib/benchmarks.ts` and the character-limit constants up to date.

```bash
python -m venv .venv
source .venv/bin/activate          # or .venv\Scripts\activate on Windows
pip install scrapegraphai playwright python-dotenv
playwright install --with-deps chromium

# Set one LLM key:
export GROQ_API_KEY=gsk_...        # free tier
# or GOOGLE_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY

python scripts/refresh_knowledge.py
```

Output lands in `scripts/output/`. Review the Markdown summary before merging any number changes. It's a maintainer tool, not a user dependency, so the heavier install is fine.
