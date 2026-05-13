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
iwr -useb https://raw.githubusercontent.com/IamRamgarhia/AdForge-/main/install.ps1 | iex
```

**macOS / Linux / WSL**:
```bash
curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/AdForge-/main/install-online.sh | bash
```

That single command: installs Node + git if missing (Windows uses winget), clones the repo into `~/AdForge`, runs `npm install`, asks for a port, then opens the launcher control panel in your browser. Click **▶ Start AdForge** and you're live.

### Manual · Windows · 3 double-clicks
1. **Download** this repo (green "Code" button → "Download ZIP" → extract)
2. **Double-click `install.bat`** · waits for dependencies, asks for a port
3. **Double-click `start.bat`** · opens the **AdForge launcher** in your browser

The launcher is a control panel: hit **▶ Start AdForge**, watch the progress bar, then click **↗ Open AdForge** when it's up. From the launcher you can also stop, restart, change ports, and open three different local URLs.

To shut everything down: **double-click `stop.bat`** (or close the launcher's terminal window).

### Manual · Mac / Linux · 3 commands
```bash
git clone https://github.com/IamRamgarhia/AdForge-.git adforge
cd adforge
bash install.sh        # one-time setup
bash start.sh          # launches everything · open http://localhost:3005
# bash stop.sh         # to shut down later
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

### 17 AI generators

| Platform | What |
|---|---|
| **Google** | Responsive Search Ad · Performance Max · Shopping · Display banners |
| **Meta** | Feed · Stories · Reels · Carousel (3 angle-distinct variants per request) |
| **TikTok** | 50 native hooks per click · UGC scripts · Spark Ads · Branded Hashtag Challenge |
| **YouTube** | In-Stream (60s) · Bumpers (6s) · Discovery |
| **LinkedIn** | Sponsored Content · Lead Gen Forms |
| **Twitter / X** | Promoted Tweets · 6-tweet threads |
| **Universal** | Full Campaign Kit · Hashtags (any language) · Email subjects · Lead forms · AI image/video prompts · Social content calendar |

### 11 optimization tools
**Creative Score** · **CTR Optimizer** · **Quality Score Improver** · **Budget Waste Analyzer** · **Budget Planner** · **Cost-Saving Tips** · **A/B Test Planner** · **Keyword Builder** · **Audience Targeting** · **Landing Page Grader** · **Bid Strategy Advisor** · **Ad Fatigue Detector**

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
├── install.ps1                  One-line online installer (Windows · PowerShell)
├── install-online.sh            One-line online installer (Mac / Linux / WSL)
├── install.bat / install.sh     Manual installer (after you clone/unzip)
├── start.bat / start.sh         Launches web + sync sidecar
├── stop.bat / stop.sh           Clean shutdown
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
| **Start** (web + sync) | double-click `start.bat` | `bash start.sh` | `npm run start:all` |
| **Stop** | double-click `stop.bat` | `bash stop.sh` | Ctrl+C |
| Web only | `npm run dev` | `npm run dev` | `npm run dev` |
| Sync sidecar only | `npm run sync` | `npm run sync` | `npm run sync` |
| Typecheck | `npm run typecheck` | — | — |
| Production build | `npm run build` | — | — |

Ports: web app **3005** · sync sidecar **3006** (both localhost-only).

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
