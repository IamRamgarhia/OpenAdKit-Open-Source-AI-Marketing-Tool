<div align="center">

<img src="docs/banner.svg" alt="AdForge — open-source AI ad ops cockpit. 17 generators, 11 optimizers, 9 AI providers, browser-only, MIT-licensed, built by Dicecodes." width="100%" />

# AdForge

### Open-source AI ad ops cockpit · every platform · bring your own AI key · zero subscriptions

*Built by [Dicecodes](https://dicecodes.com)*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-ffb020.svg)](CHANGELOG.md)
[![Node 18.17+](https://img.shields.io/badge/node-%E2%89%A518.17-brightgreen.svg)](https://nodejs.org)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![Built by Dicecodes](https://img.shields.io/badge/built%20by-Dicecodes-ffb020.svg)](https://dicecodes.com)
[![Browser-only](https://img.shields.io/badge/browser--only-yes-blue.svg)](#privacy--security)
[![BYOK](https://img.shields.io/badge/BYOK-9%20providers-purple.svg)](#9-ai-providers-supported)
[![GitHub stars](https://img.shields.io/github/stars/IamRamgarhia/AdForge?style=social)](https://github.com/IamRamgarhia/AdForge/stargazers)

**One tool. Every ad platform. Zero subscriptions.**
*Your key · your data · your folder.*

[Install](#install-in-60-seconds) ·
[What's inside](#whats-inside) ·
[vs paid alternatives](#why-this-vs-the-49-499mo-stack) ·
[Architecture](#architecture) ·
[Contributing](CONTRIBUTING.md)

</div>

---

## What is AdForge?

AdForge replaces a **$49–$499/month stack** of AI marketing tools (Jasper · AdCreative · Anyword · Pencil · Marpipe …) with **one open-source app** that runs entirely in your browser.

You bring your own AI key — free tier (Groq · Gemini · Cerebras · OpenRouter) or paid (Claude · GPT · Mistral · DeepSeek) — and get every paid-tool feature for **$0/month**.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Paste a client URL    ─►   AdForge auto-extracts a Brand Brain         │
│                                                                          │
│   ▼                                                                      │
│                                                                          │
│   AI suggests campaigns    ─►   Pick a generator (17 of them)            │
│                                                                          │
│   ▼                                                                      │
│                                                                          │
│   Generate · score · preview · launch                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Install in 60 seconds

You need **Node.js 20+** ([download here](https://nodejs.org/en/download)). That's the only prerequisite — the one-liner below installs everything else.

### Fastest · one line, any OS

**Windows** (PowerShell):
```powershell
iwr -useb https://raw.githubusercontent.com/IamRamgarhia/AdForge-/main/scripts/install/install.ps1 | iex
```

**macOS / Linux / WSL**:
```bash
curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/AdForge-/main/scripts/install/install.sh | bash
```

That single command: installs Node + git if missing (Windows uses winget), clones the repo into `~/AdForge`, runs `npm install`, asks for a port, then opens the launcher control panel in your browser. Click **▶ Start AdForge** and you're live.

### Manual · Windows · 3 double-clicks
1. **Download** this repo (green "Code" button → "Download ZIP" → extract)
2. **Double-click `install.bat`** · waits for dependencies, asks for a port, creates an **AdForge** shortcut on your Desktop
3. **Double-click the new `AdForge` icon on your Desktop** *(or `AdForge.bat` in the folder)* · your default browser opens to the AdForge launcher

The launcher is a control panel: hit **▶ Start AdForge**, watch the progress bar, then click **↗ Open AdForge** when it's up. From the launcher you can also stop, restart, change ports, and open three different local URLs.

To shut everything down: close the launcher tab and run `scripts\stop.bat` (or just close the hidden sidecar via Task Manager).

### Manual · Mac / Linux · 3 commands
```bash
git clone https://github.com/IamRamgarhia/AdForge-.git adforge
cd adforge
bash install.sh                  # one-time setup · creates ~/Desktop/AdForge shortcut
bash AdForge.command             # or double-click AdForge on your Desktop
# bash scripts/stop.sh           # to force-stop later
```

### Cross-platform · one command (after clone)
```bash
npm install
npm run start:all      # web app + local-sync sidecar together
```

> First launch walks you through a 5-step wizard: welcome → tour → pick AI provider → paste key → optional first brand. No accounts. No env vars. No database.

### Pick your own port
`install.bat` / `install.sh` ask which port you want and save it to `.env.local`. Defaults to **3005**. Pick anything 1024–65535 (avoid 80 unless you want admin rights).

### Want a prettier URL?
- **Zero setup:** open `http://adforge.localhost:3005/` instead of `http://localhost:3005/`. Works in Chrome / Firefox / Safari / Edge today — all modern browsers auto-resolve `*.localhost` to 127.0.0.1.
- **Hosts-file option:** for `http://adforge.local/` with no port shown, run `scripts/set-domain.bat` (Windows, as admin) or `sudo bash scripts/set-domain.sh` (Mac/Linux). Full guide: [docs/CUSTOM_DOMAIN.md](docs/CUSTOM_DOMAIN.md).

### Your data lives in this folder
After install, **everything you do** (brand brains, generated ads, campaigns, checklists, performance logs) auto-saves to `data/snapshot.json` in the project folder.

**Zip the folder → move to another machine → run `start` again → everything is there.** That's the whole portability story.

---

## What's inside

### Sidebar is grouped by platform
Pick where you're running ads first ("I'm doing Meta this week"), then see every tool that applies. Cross-platform tools appear under each relevant group so discovery happens by *where* you ship, not by the action verb.

| Platform group | Generators | Optimizers in this group |
|---|---|---|
| **Meta · Facebook + Instagram** | Meta Ads · Reel Ideas · Lead Form · Hashtags · Content Calendar · Image / Video Prompts | CTR Optimizer (Meta-tuned) · Creative Score · Audience Targeting · Ad Fatigue · A/B Test · Landing Page · Bid Strategy |
| **Google · Search + PMax + Shopping** | Google RSA · Performance Max · Shopping · Display Banners | Quality Score Improver · Keyword Builder · Bid Strategy · CTR Optimizer · Audience · Landing Page · A/B Test |
| **TikTok** | TikTok In-Feed · Reel Ideas · Spark Ads · Branded Hashtag Challenge · Hashtags · Content Calendar · Image / Video Prompts | CTR Optimizer · Creative Score · Audience · Ad Fatigue |
| **LinkedIn · B2B** | LinkedIn Sponsored · Lead Form | CTR Optimizer · Audience · Landing Page · A/B Test |
| **YouTube** | YouTube TrueView Scripts · Shorts Ideas · Hashtags · Image / Video Prompts | Creative Score |
| **X · Twitter** | Twitter Ads · Hashtags · Content Calendar | — |
| **Email + Display** | Email Subjects · Display Banners | — |

### Flagship features
- **⚡ 10-Minute Launch Wizard** (`/launch/wizard`) — single click → strategy brief + cross-platform ad copy + content calendar + 3-email sequence + launch-day social posts. One Campaign, five chained AI calls, streaming live.
- **Multi-Client Batch Mode** (`/batch`) — pick N clients → generate the same asset (Content Calendar / Hashtags / Reel Ideas / Campaign Kit) for all in parallel. Each output uses that client's own brand brain so voice is preserved per-client.
- **Reel Idea Generator** (`/generate/reel-ideas`) — 10 proven hook formulas rotated across a batch (POV / Contradiction / Listicle / Number-Promise / Pattern-Interrupt / Before-After / Story / Demo / Controversy / Insider) with platform-native rules baked in for IG Reels / TikTok / Shorts / FB Reels.
- **Competitor Reel Teardown** (`/research/reel-teardown`) — paste a competitor's captions → AI maps hook formulas, content pillars, format mix, weakness map → writes 5 "beat-their-reel" scripts citing the specific reels they respond to.
- **Data-first optimizers** — every optimizer (CTR · Quality Score · Audience · Landing Page · Keywords · Bid Strategy · Ad Fatigue) requires real Google Ads / Meta / TikTok numbers, computes derived metrics, and cites specific values in its recommendations. Optional dashboard-screenshot upload on vision-capable providers (Claude / OpenAI 4.1+ / Gemini).

### Universal tools (used across platforms)
**Full Campaign Kit** · **Hashtags (any language)** · **Email Subjects** · **Lead Forms** · **AI Image/Video Prompts** · **Social Content Calendar** · **Steal & Beat** competitor ad teardown · **Compare 2 Ads** · **Budget Waste Analyzer** · **Budget Planner** · **A/B Test Planner**

### Multi-client management
- Add a client by **pasting a website URL** — AdForge auto-extracts the Brand Brain (tone, audience, USP, VOC, words to use/avoid) using Jina Reader + your chosen LLM
- 10 **industry templates** for instant brand creation (local restaurant, B2B SaaS, e-commerce fashion, agency, etc.)
- One-click switcher in the top bar
- History + checklists scope to active client automatically

### Competitor intelligence
- **Steal & Beat** — paste competitor ads from Meta Ads Library / Google Transparency Center / TikTok Top Ads / LinkedIn Ad Library. AI tears them down + writes 3 variants that beat the strongest one.
- **Compare 2 ads** — head-to-head AI teardown · picks the winner · proposes a hybrid

### Step-by-step launch guides
Pick a platform + experience level + budget — AdForge walks you through **every click, every field, every dropdown** in Meta Ads Manager / Google Ads / TikTok Ads Manager / LinkedIn Campaign Manager. For non-technical users who've never launched an ad before.

### Routines + learning
- **Daily / Weekly / Monthly** checklists with streak counters and custom items
- **28 mini-course lessons** across Google · Meta · TikTok tracks
- **Interactive Ad Copy School** — type → AI critiques → you rewrite (AIDA, PAS, BAB, FAB, 4 U's)
- **25-concept library** + on-demand AI explainer
- **Industry benchmarks** for CTR/CPC/CVR/ROAS across 8 verticals

### Performance feedback loop
Log impressions / clicks / conversions / spend / revenue per ad → AdForge computes CTR / CPA / ROAS → surfaces **winning angles per brand** in future Suggested Campaigns.

### Ad mockups · what they'll look like
Every Google / Meta / TikTok generation includes a **live realistic mockup** — Feed cards, Reels overlays, Search SERP previews, For-You-page mockups. No more guessing the visual.

---

## 9 AI providers supported

| Tier | Provider | Free? | Notes |
|---|---|:-:|---|
| **Free** | **Groq** | ✅ | ~30 req/min Llama 3.3 70B · fastest tokens/sec |
| **Free** | **Cerebras** | ✅ | ~30 req/min · even faster than Groq |
| **Freemium** | **Google Gemini** | ✅ | Generous free tier on Flash · paid Pro |
| **Freemium** | **OpenRouter** | ✅ | Free community models tagged `:free` |
| **Freemium** | **Together AI** | partial | Some free models · mostly cheap paid |
| **Paid** | **Anthropic Claude** | ❌ | Strongest for long-context reasoning |
| **Paid** | **OpenAI GPT** | ❌ | Best at structured JSON |
| **Paid** | **DeepSeek** | ❌ | Cheapest serious model |
| **Paid** | **Mistral** | ❌ | Multilingual + JSON |

Pick during onboarding · switch any time in Settings · one app, every API.

---

## Why this vs the $49-499/mo stack

| Feature | Jasper $49+ | AdCreative $39+ | Anyword $49+ | Pencil $119+ | **AdForge · free** |
|---|:-:|:-:|:-:|:-:|:-:|
| Visual ad mockups | ❌ | ✅ | ❌ | ✅ | ✅ |
| Multi-platform copy | ✅ | partial | ✅ | Meta-only | ✅ (17 generators) |
| Brand voice memory | ✅ | ❌ | partial | partial | ✅ (per-client) |
| Predictive creative scoring | ❌ | ✅ | ✅ | ✅ | ✅ |
| Competitor teardown | ❌ | ✅ | ❌ | ✅ | ✅ (4 libraries) |
| Compare A/B before launch | ❌ | ❌ | ✅ | ❌ | ✅ |
| Industry templates | ✅ | ✅ | ✅ | ❌ | ✅ (10) |
| Performance feedback loop | ❌ | ❌ | ❌ | ✅ | ✅ |
| Campaign grouping | ✅ | ✅ | ✅ | ✅ | ✅ |
| Step-by-step UI launch guides | ❌ | ❌ | ❌ | ❌ | ✅ |
| Decision tree planner | ❌ | ❌ | ❌ | ❌ | ✅ |
| Hashtags in any language | partial | ❌ | ❌ | ❌ | ✅ |
| Content calendar with AI tool links | ❌ | partial | ❌ | ❌ | ✅ |
| Mini-courses + framework trainer | ❌ | ❌ | ❌ | ❌ | ✅ (28 lessons) |
| Cmd+K palette · power-user nav | ❌ | ❌ | ❌ | ❌ | ✅ |
| 9 AI providers · BYOK · free+paid | 1 | 1 | 1 | 1 | ✅ |
| Browser-only · MIT · self-host | ❌ | ❌ | ❌ | ❌ | ✅ |
| Folder-portable data | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Monthly cost** | **$49–125** | **$39–299** | **$49–999** | **$119–999** | **$0** |

---

## Architecture

<img src="docs/architecture.svg" alt="AdForge architecture diagram. Browser-only Next.js app talks directly to your chosen LLM provider, Jina Reader for URL ingest, and a zero-dependency Node local-sync sidecar that persists all your work to data/snapshot.json in the project folder." width="100%" />

<details>
<summary>Text version (for screen readers)</summary>

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR BROWSER                                │
│                                                                     │
│   Next.js App  ──►  Jina Reader (URL ingest)                        │
│   (port 3005)  ──►  Your chosen LLM provider directly               │
│                     (api.anthropic.com / openai.com / generative…)  │
│                                                                     │
│   IndexedDB  ◄──── auto-sync ────►  Local-sync sidecar              │
│   localStorage                       (port 3006, Node, zero-dep)    │
│                                              │                      │
│                                              ▼                      │
│                                       data/snapshot.json            │
│                                       (portable!)                   │
└─────────────────────────────────────────────────────────────────────┘
```

</details>

**Outbound calls from the running app**:
1. The LLM provider you configured · for every generation
2. Jina Reader (`r.jina.ai`) · only when ingesting a brand URL
3. AllOrigins (`api.allorigins.win`) · only as a fallback if Jina is rate-limited
4. The competitor ad libraries (`facebook.com/ads/library`, `adstransparency.google.com`, `ads.tiktok.com`, `linkedin.com/ad-library`) · only when YOU click "Open" — they open in YOUR new tab, never proxied through us.

**No backend AdForge owns. No telemetry. No analytics. No accounts.**

---

## Privacy & security

- **No backend.** Your data never leaves your browser.
- **No telemetry.** Zero tracking, zero analytics calls.
- **BYOK.** API keys live in your browser's `localStorage` only.
- **Direct calls.** Each LLM provider receives the request directly from your browser — no proxy.
- **Folder-portable.** All non-key data syncs to `data/snapshot.json`. Keys are excluded by default (toggle in Settings → Preferences).
- **Soft-delete + undo.** Accidental deletes get a 7-second undo toast.
- **Wipe & export.** Settings includes full export (JSON/CSV/Markdown) and "wipe all local data."

> ⚠️ Because keys are in `localStorage`, treat AdForge like your password manager: only install on devices you trust, don't paste keys on shared machines.

See [SECURITY.md](SECURITY.md) for the threat model + responsible-disclosure flow.

---

## Project layout

```
adforge/
├── app/                         Next.js App Router (56 routes)
│   ├── generate/*               17 ad generators
│   ├── optimize/*               11 optimization tools
│   ├── research/*               Steal & Beat · Compare ads
│   ├── platforms/[platform]/    Per-platform hubs
│   ├── checklist/*              Daily / Weekly / Monthly routines
│   ├── learn/*                  Concepts · mini-courses · framework trainer
│   ├── suggestions/             AI-suggested campaigns per brand
│   ├── launch-guide/            Step-by-step UI walkthrough
│   ├── campaigns/               Group ads · status lifecycle
│   ├── brand/                   Multi-client Brand Brains
│   ├── benchmarks/              Industry CTR/CPC/CVR/ROAS
│   ├── strategy/                What to run · decision tree
│   ├── about/                   Built by Dicecodes
│   └── settings/                Provider keys · prefs · wipe
│
├── components/
│   ├── AdMockup.tsx             Meta/Google/TikTok/YouTube live previews
│   ├── CommandPalette.tsx       Cmd+K fuzzy nav
│   ├── UndoToast.tsx            Global 7-second undo
│   ├── PerformanceDialog.tsx    Log impressions/CTR/CPA/ROAS
│   └── …                        Shared UI primitives
│
├── lib/
│   ├── providers/               9-provider abstraction
│   ├── prompts/                 30+ AI prompt templates
│   ├── storage.ts               Dexie/IndexedDB schema v3
│   ├── settings.ts              localStorage layer + migration
│   ├── local-sync.ts            Folder-sync client
│   ├── url-ingest.ts            Jina + AllOrigins fallback
│   ├── benchmarks.ts            Industry data
│   ├── platform-hubs.ts         Per-platform reference
│   ├── industry-templates.ts    10 quick-start templates
│   └── courses.ts               28 mini-course lessons
│
├── scripts/
│   ├── local-sync.cjs           ~150-line Node sidecar (folder persistence)
│   ├── run-all.cjs              Cross-platform launcher
│   └── refresh_knowledge.py     Optional maintainer tool
│
├── data/                        Your snapshot lives here (gitignored)
├── AdForge.bat / AdForge.command  Click-to-launch (Desktop shortcut points here)
├── install.bat / install.sh       Manual installer (after you clone/unzip)
├── scripts/install/install.ps1    One-line online bootstrap (Windows · PowerShell)
├── scripts/install/install.sh     One-line online bootstrap (Mac / Linux / WSL)
├── scripts/start.bat / start.sh    Manual sidecar runner (advanced)
├── scripts/stop.bat / stop.sh      Force shutdown
└── package.json
```

---

## Tech stack

- **Next.js 14** (App Router, fully static-prerendered)
- **TypeScript** strict
- **Tailwind CSS** + hand-rolled "Trading-Terminal × Editorial" design system
- **Dexie** for IndexedDB · **localStorage** for settings
- **Manrope + JetBrains Mono + Instrument Serif** (self-hosted via `next/font`)
- **No state-management framework** — `useState` + storage helpers
- **No backend** — everything runs in your browser
- **No analytics** — full stop
- **Zero npm dependencies** in the local-sync sidecar (Node stdlib only)

Production build: 56 statically prerendered routes · 87 KB shared JS · 130-160 KB first-load JS per route.

---

## Start / Stop reference

| Action | Windows | Mac / Linux | Cross-platform |
|---|---|---|---|
| Install (one-time) | double-click `install.bat` | `bash install.sh` | `npm install` |
| **Launch** | double-click `AdForge` on Desktop *(or `AdForge.bat`)* | double-click `AdForge` on Desktop *(or `bash AdForge.command`)* | — |
| Force-stop everything | `scripts\stop.bat` | `bash scripts/stop.sh` | Ctrl+C in the sidecar window |
| Manual sidecar (visible log) | `scripts\start.bat` | `bash scripts/start.sh` | `npm run start:all` |
| Web only | `npm run dev` | `npm run dev` | `npm run dev` |
| Sync sidecar only | `npm run sync` | `npm run sync` | `npm run sync` |
| Typecheck | `npm run typecheck` | — | — |
| Production build | `npm run build` | — | — |

Ports: web app **3005** · sync sidecar **3006** (both localhost-only).

---

## Troubleshooting

Most problems come down to one of four things: a port already in use, Node missing or too old, Windows Defender blocking a script, or `.env.local` pointing at the wrong port. The launcher's **⚠ Report a problem on GitHub** button auto-fills an issue with your exact Node/OS/port state — use it if any of these don't help.

### Sidecar won't start

**Symptom:** Double-clicking `AdForge` does nothing, or the cmd window flashes and disappears.

1. Open a terminal in the install folder and run `node --version`. If it reports anything below **v20.0.0** or "command not found," install Node 20+ from <https://nodejs.org/en/download>.
2. Run `scripts\start.bat` (Windows) or `bash scripts/start.sh` (Mac/Linux) directly — the window stays open and prints the real error.
3. If you see `Input Error: There is no script engine for file extension ".vbs"`, your Windows Script Host is disabled. The current `AdForge.bat` uses PowerShell instead — make sure you have the latest version from this repo.

### Port already in use

**Symptom:** Sidecar starts but `/status` returns `web: starting` forever, or the launcher says "EADDRINUSE 3005."

- The web app defaults to port 3005, sidecar to 3006. Open the launcher → **Settings** → change to anything 1024–65535. Save, then Stop + Start.
- On Windows, find who owns the port: `netstat -ano | findstr :3005` then `taskkill /PID <pid> /F`.
- On Mac/Linux: `lsof -iTCP:3005 -sTCP:LISTEN`.

### Port mismatch between `.env.local` and the launcher

**Symptom:** Launcher's "Open AdForge" button points at the wrong port.

- Open `.env.local` in the install folder. It should have two lines: `PORT=3005` and `ADFORGE_SYNC_PORT=3006` (use whatever values you picked at install).
- If both ports match what the launcher shows, you're fine. If they don't, save the correct values in `.env.local` and force-stop everything (`scripts\stop.bat` or `bash scripts/stop.sh`), then relaunch.

### Windows Defender / SmartScreen warning

**Symptom:** "Windows protected your PC" dialog when running `install.bat` or `AdForge.bat`.

- Click **More info → Run anyway**. The warning appears for any unsigned script downloaded from the internet — AdForge is open source and reviewable.
- For zero warnings: clone the repo with `git clone` instead of downloading the ZIP. Files created locally don't carry the "mark of the web."

### Web app stays on "Starting…" past 30 seconds

**Symptom:** Launcher shows "Starting AdForge…" with progress bar that never completes.

- First boot compiles 56 routes; this can take 15-30 seconds on slow disks. Wait a full minute.
- If it's still stuck, click **⚠ Report a problem** in the launcher — the GitHub issue will include `web_last_log` which usually shows the exact compile error.
- Workaround: stop the launcher, delete `.next/` in the install folder, restart.

### Browser says "site can't be reached"

**Symptom:** Clicking "Open AdForge" shows `ERR_CONNECTION_REFUSED`.

- The web app isn't running. Go back to the launcher and check the status dot — orange means starting, gray means stopped. Click **Start**.
- If the dot is green but the page still fails, your browser may have cached an old port. Try `http://127.0.0.1:<port>/` directly with the port shown in the launcher.

### Where do I find the logs?

- **Launcher (sidecar) logs:** the launcher page shows the last 3 lines of the Next.js output in the gray log box. For full logs, run `scripts\start.bat` / `bash scripts/start.sh` in a visible window instead of `AdForge.bat`.
- **Web app errors in the browser:** open DevTools (F12) → Console.
- **Data file:** `data/snapshot.json` in the install folder is everything AdForge has saved.

### Reporting a bug

Click **⚠ Report a problem on GitHub** in the launcher — it pre-fills [github.com/IamRamgarhia/AdForge-/issues/new](https://github.com/IamRamgarhia/AdForge-/issues/new) with your platform, Node version, port config, and recent log lines. Add what you were trying to do and submit.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Most contributions are a single prompt + a single page using the shared `GeneratorShell` framework — aim for 10-minute PRs.

Pattern grounding: AdForge prompts borrow patterns (with attribution) from open-source skill repos. See [NOTICE.md](NOTICE.md) for the full source list.

---

## About

AdForge is built by **[Dicecodes](https://dicecodes.com)** — a digital studio combining creative design with advanced technology for measurable business growth.

We make money from custom builds, not from this tool. **AdForge will always be free.**

Need a private fork, a white-labeled agency edition, or something we haven't built? **[Get in touch →](https://dicecodes.com)** · 📧 [Contact@dicecodes.com](mailto:Contact@dicecodes.com) · 💬 [WhatsApp +91 98884 04991](https://wa.me/919888404991)

---

## License

MIT. See [LICENSE](LICENSE).

<sub>*Built by Dicecodes · Open source forever · No backend · No telemetry · Your key, your data, your folder.*</sub>
