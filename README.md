<div align="center">

<img src="public/og-image.png" alt="OpenAdKit — free open source AI marketing tool. Every ad platform, every AI provider (bring your own key), zero subscriptions. Replaces Jasper, AdCreative, Anyword and Copy.ai. MIT licensed. Built by DiceCodes." width="100%" />

# OpenAdKit — Open Source AI Marketing Tool

<!-- Last updated: 2026-11-20 · v2.0.0 · keep this fresh on every meaningful README edit; AI citation engines treat it as a freshness signal -->

### Write, score and plan ads for every platform · bring your own AI key · zero subscriptions

*The free, open source alternative to Jasper, AdCreative, Anyword, Pencil & Copy.ai · desktop app for Windows, macOS and Linux · MIT licensed · built by [DiceCodes](https://dicecodes.com)*

[![Download for Windows](https://img.shields.io/badge/Download-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white&labelColor=334155)](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/latest/download/OpenAdKit-Windows-Setup.exe)
[![Install on macOS](https://img.shields.io/badge/Install-macOS-111827?style=for-the-badge&logo=apple&logoColor=white&labelColor=334155)](#macos-and-linux)
[![Install on Linux](https://img.shields.io/badge/Install-Linux-E95420?style=for-the-badge&logo=linux&logoColor=white&labelColor=334155)](#macos-and-linux)
[![All downloads](https://img.shields.io/badge/All-downloads-16a34a?style=for-the-badge&logo=github&logoColor=white&labelColor=334155)](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/latest)
[![Support](https://img.shields.io/badge/%E2%9D%A4%EF%B8%8F-Support-db2777?style=for-the-badge&labelColor=334155)](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool#support-the-project)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-ffb020.svg)](docs/releases/v2.0.0.md)
[![Node 20.9+](https://img.shields.io/badge/node-%E2%89%A520.9-brightgreen.svg)](https://nodejs.org)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![MCP server](https://img.shields.io/badge/MCP-Claude%20%7C%20Cursor-8b5cf6.svg)](docs/MCP.md)
[![BYOK](https://img.shields.io/badge/BYOK-9%20providers-purple.svg)](#9-ai-providers-supported)
[![Built by DiceCodes](https://img.shields.io/badge/built%20by-DiceCodes-ffb020.svg)](https://dicecodes.com)
[![GitHub stars](https://img.shields.io/github/stars/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool?style=social)](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/stargazers)

**One tool. Every ad platform. Zero subscriptions.**
*Your key · your data · your computer.*

[Download & install](#download--install) ·
[Screenshots](#screenshots) ·
[How to use it](#how-to-use-openadkit--step-by-step) ·
[Who's it for](#whos-it-for) ·
[What's inside](#whats-inside) ·
[Use it in Claude (MCP)](#use-openadkit-inside-claude-desktop-claude-code-and-cursor-mcp) ·
[vs Jasper / AdCreative / Anyword / Copy.ai](#openadkit-vs-jasper-adcreative-anyword-copyai--feature-comparison) ·
[FAQ](#frequently-asked-questions) ·
[Support the project](#support-the-project)

</div>

---

## What is OpenAdKit?

**OpenAdKit is a free, open source AI marketing tool** that does the job of a **$49–$499/month stack** of paid AI ad tools (Jasper · AdCreative · Anyword · Pencil · Copy.ai · Marpipe) in **one app that runs on your own computer**.

You **bring your own AI key** — free tier (Groq · Gemini · Cerebras · OpenRouter) or paid (Claude · GPT · Mistral · DeepSeek · Together) — and pay nothing to OpenAdKit, ever.

**18 AI ad generators · 11 optimizers · competitor research · 9 AI providers · a saved "Brand Brain" for every client · image (screenshot) input on Claude, GPT and Gemini · 10-minute launch wizard · multi-client batch mode · an MCP server so Claude Desktop, Claude Code and Cursor can use every tool.**

> Use it for: writing Google Ads RSA copy, Meta / Facebook / Instagram / TikTok / LinkedIn / YouTube / X ads, Reel hooks, email subject lines, scoring creatives before launch, fixing low-CTR ads, planning budgets and A/B tests, running an agency across many clients, or teaching yourself paid media with the built-in framework trainer (PAS · AIDA · BAB · 4 U's · Schwartz awareness ladder).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Paste a client URL    ─►   OpenAdKit builds a Brand Brain              │
│                                                                          │
│   ▼                                                                      │
│                                                                          │
│   AI suggests campaigns    ─►   Pick a generator (18 of them)            │
│                                                                          │
│   ▼                                                                      │
│                                                                          │
│   Generate · score · preview · launch                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

<a id="install-in-60-seconds"></a>
<a id="use-it-now--two-paths"></a>

## Download & install

Free, no account, no sign-up. Pick your computer:

| Your computer | What to do |
|---|---|
| **Windows 10 / 11** | [Download OpenAdKit-Windows-Setup.exe](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/latest/download/OpenAdKit-Windows-Setup.exe) and double-click it. |
| **macOS** (Apple silicon & Intel) | Paste one line into Terminal — [see below](#macos-and-linux). |
| **Linux** | Same line as macOS — [see below](#macos-and-linux). |
| **Server / NAS** | [Docker](#docker). |
| **Just a browser** | [Deploy your own copy on Vercel](#hosted-on-vercel-no-install). |

### Windows

1. **[Download OpenAdKit-Windows-Setup.exe](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/latest/download/OpenAdKit-Windows-Setup.exe)** and double-click it.
2. If Windows says **"Windows protected your PC"**, click **More info → Run anyway**. This appears because the installer is not code-signed yet; the source code is all here to review.
3. Click through the installer. It installs **for your user only — no admin password needed** — and adds a Start menu entry (plus a desktop shortcut if you tick it).

OpenAdKit opens in its own window (it uses Microsoft Edge WebView2, which ships with Windows 11; if it is missing, OpenAdKit opens in your default browser instead). Everything it needs, including Node.js, is inside the installer. Uninstall any time from **Settings → Apps → OpenAdKit** — your clients and history are kept.

**Prefer PowerShell?** This downloads the same installer, checks it against the release's SHA-256 checksum, and installs it silently:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/install.ps1 | iex"
```

### macOS and Linux

Open **Terminal** and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/install.sh | bash
```

What this does:

- Uses your Node.js if it is version 20.9 or newer. If not, it downloads its own copy of Node 24 LTS from nodejs.org into the OpenAdKit folder (no `sudo`, nothing installed system-wide) and checks it against nodejs.org's SHA-256 list.
- Downloads the latest OpenAdKit release and checks it against the release's `SHA256SUMS.txt`. A file that doesn't match is refused and nothing is installed.
- **macOS:** creates **OpenAdKit.app** in `~/Applications` — open it from Launchpad or Spotlight.
- **Linux:** adds OpenAdKit to your app menu and adds an `openadkit` command (`openadkit`, `openadkit stop`, `openadkit status`).
- If Claude Desktop is installed, it asks whether to connect OpenAdKit to it ([what that means](#use-openadkit-inside-claude-desktop-claude-code-and-cursor-mcp)).
- Starts OpenAdKit and opens it in your browser.

**Uninstall** (your data is kept):

```bash
curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/main/install.sh | bash -s -- --uninstall
```

### Docker

```bash
docker build -t openadkit .
docker run -p 3005:3005 openadkit
```

Then open <http://localhost:3005>. The image runs the production server only (no local-sync sidecar), so your work lives in that browser — use **Settings → Export** to back it up.

### Hosted on Vercel (no install)

Deploy your own private copy in one click. The free tier is enough.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIamRamgarhia%2FOpenAdKit-Open-Source-AI-Marketing-Tool)

You get your own URL that works on any device with a browser, including phones and tablets. The app detects it is hosted and uses a built-in `/api/ingest` route to read the brand websites you paste. **Your work is stored only in that browser** — use *Settings → Export* now and then to back it up to a file.

### From source (developers)

You need Node.js 20.9 or newer (`.nvmrc` pins 24).

```bash
git clone https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool.git openadkit
cd openadkit
npm install
npm run build          # one time, about a minute
```

Then launch:

- **Windows:** double-click **`OpenAdKit.bat`**
- **macOS / Linux:** `bash OpenAdKit.command`
- **Hot reload while you edit code:** `npm run dev` (web app on <http://localhost:3005>)

The launchers start the local server plus the sync sidecar, pick free ports, open a small control panel and create a desktop shortcut on first run. Older one-line scripts that clone and build for you are still in [`scripts/install/`](scripts/install/).

> On first launch a short setup wizard walks you through: welcome → tour → pick an AI provider → paste your key → optional first brand. No accounts, no env vars, no database.

### Updates

Installed copies check GitHub Releases and show a **"OpenAdKit vX is available"** notice with **Update now** (Windows) or the update command (macOS / Linux) when a new version is out. You can turn the daily check off in Settings.

- **Windows:** one click. OpenAdKit downloads the new Setup, checks its SHA-256 checksum, installs it silently and reopens.
- **macOS / Linux:** run the same install line again. Your data is kept.
- **From source:** the control panel's updater runs a fast-forward-only `git pull` and refuses if you have uncommitted changes.

---

## Screenshots

> Real screenshots of the app — no mockups. The only thing we can't show is your own AI provider's output (BYOK — bring your own API key).

### The cockpit — every tool one click away

<img src="public/screenshots/08-cockpit-dashboard.png" alt="OpenAdKit dashboard cockpit showing 18 AI ad generators and 11 optimizers organized by ad platform — Meta, Google, TikTok, LinkedIn, YouTube, X — with quick access to brand brain, history, and AI campaign suggestions" width="100%" />

### 5-step onboarding wizard — pick a provider, paste a key, done

<img src="public/screenshots/01-setup-wizard.png" alt="OpenAdKit free 5-step setup wizard for the open source AI marketing tool — welcome screen explaining local-first storage, bring your own AI key (BYOK), and zero subscriptions" width="100%" />

### Settings — switch between 9 AI providers (free + paid) in one click

<img src="public/screenshots/09-settings-providers.png" alt="OpenAdKit settings page with all 9 supported AI providers — Anthropic Claude, OpenAI GPT, Google Gemini, Groq, Cerebras, OpenRouter, Together AI, DeepSeek, Mistral — each with BYOK API key field, model selector, and usage tracking" width="100%" />

### Meta + Facebook + Instagram ad generator

<img src="public/screenshots/10-generator-meta-ads.png" alt="OpenAdKit Meta Ads generator producing 3 angle-distinct Facebook and Instagram ad copy variants — pain, desire, and social proof angles — with character count validation for Meta primary text, headline, and description fields" width="100%" />

### Creative Score — 5-lever scoring + 3 named fixes

<img src="public/screenshots/11-optimizer-creative-score.png" alt="OpenAdKit Creative Score optimizer showing a 5-lever scoring rubric — hook strength, specificity, urgency, brand fit, conversion potential — with named-phrase fixes and a CTR band labelled as an AI estimate" width="100%" />

### Competitor research — link straight to Meta, Google, TikTok, LinkedIn ad libraries

<img src="public/screenshots/12-research-competitors.png" alt="OpenAdKit competitor research tool with direct deep links to Meta Ads Library, Google Ads Transparency Center, TikTok Top Ads, and LinkedIn Ad Library — paste competitor ads to get a teardown plus three beat-their-ad variants" width="100%" />

### Compare — side-by-side OpenAdKit vs Jasper / AdCreative / Anyword / Copy.ai

<img src="public/screenshots/02-alternatives-comparison.png" alt="OpenAdKit alternatives comparison page showing the free open source AI marketing tool versus Jasper, AdCreative.ai, Anyword, Copy.ai, and Pencil — feature-by-feature matrix with monthly cost rows and per-competitor strengths and shortfalls" width="100%" />

### Built-in benchmarks — CTR / CPC / CVR / ROAS ranges by industry

<img src="public/screenshots/03-benchmarks-industry-data.png" alt="OpenAdKit benchmarks page with industry-specific Google Ads and Meta Ads performance ranges — click-through rate (CTR), cost per click (CPC), conversion rate (CVR), return on ad spend (ROAS) — for SaaS, e-commerce, B2B, local services, education, finance" width="100%" />

### Platform hub — every ad format, character limit, best practice in one place

<img src="public/screenshots/04-platforms-hub.png" alt="OpenAdKit platforms hub showing every supported ad platform — Meta Facebook and Instagram, Google Search and Performance Max and Shopping, TikTok In-Feed and Spark, LinkedIn Sponsored, YouTube In-Stream, X Twitter — each linking to format-specific generators and character-limit references" width="100%" />

### Platform deep-dive — Meta ad formats explained

<img src="public/screenshots/05-platform-meta-detail.png" alt="OpenAdKit Meta platform detail page explaining every Facebook and Instagram ad format — Feed, Reels, Stories, Carousel, Collection — with exact character limits, image dimensions, and AI generator links for each format" width="100%" />

### Learn — ad copywriting framework trainer (PAS, AIDA, BAB, 4 U's, Schwartz awareness ladder)

<img src="public/screenshots/06-learn-frameworks-trainer.png" alt="OpenAdKit ad copywriting framework trainer covering PAS Problem-Agitate-Solution, AIDA Attention-Interest-Desire-Action, BAB Before-After-Bridge, the 4 U's, and Schwartz awareness ladder — interactive lessons for marketers learning paid media" width="100%" />

### Launch guide — step-by-step Facebook / Google UI walkthroughs

<img src="public/screenshots/07-launch-guide-walkthrough.png" alt="OpenAdKit step-by-step launch guide walking through the Facebook Ads Manager and Google Ads UI from campaign creation to publish — for first-time advertisers learning paid media" width="100%" />

---

## How to use OpenAdKit — step-by-step

> Your first 10 minutes, from install to your first AI-written ad.

### Step 1 · Install OpenAdKit (1–5 minutes)

Follow [Download & install](#download--install) for your computer. Windows: run the Setup. Mac / Linux: paste the one line into Terminal.

**You'll know it worked** when the OpenAdKit setup wizard opens (screenshot #2 above).

### Step 2 · Pick an AI provider + paste a key (2 minutes)

This is the **only thing you might pay for**, and it can be $0 if you pick a free tier.

1. The setup wizard shows all 9 supported AI providers grouped by **Free** (Groq, Gemini, Cerebras, OpenRouter) and **Paid** (Anthropic Claude, OpenAI GPT, DeepSeek, Mistral, Together AI).
2. **Good first picks:**
   - **Groq** (free, fastest) — sign up at [console.groq.com](https://console.groq.com), copy your API key (starts with `gsk_…`), paste it in.
   - **Gemini** (free) — get a key at [aistudio.google.com](https://aistudio.google.com/app/apikey), paste it.
   - **Claude** (paid) — get a key at [console.anthropic.com](https://console.anthropic.com), starts with `sk-ant-…`. The default model is Claude Sonnet 5.5.
3. Click **Verify** — OpenAdKit makes one tiny test call to confirm the key works.
4. Pick a model from the dropdown (the defaults are sensible). Click **Continue**.

> 💡 You can save keys for several providers and switch any time in Settings — handy when you hit a free-tier rate limit.

#### Which AI gives the most free credits? (built into the app at `/providers`)

OpenAdKit ships a **"Which AI should I use?"** page that compares every provider's free tier, real cost per generation, and image support side by side — and adds a **measured** column from your own usage.

| Provider | Free tier | Free requests/day | Card needed | Image input |
|---|---|---|---|---|
| **Groq** | Yes | **14,400** | No | No |
| **OpenRouter** (`:free` models) | Yes | 50 | No | Yes |
| **Cerebras** | Yes | 30/min, no daily cap published | No | No |
| **Google Gemini** | Yes | **~20 per model** | No | Yes |
| Anthropic Claude · OpenAI GPT · DeepSeek · Mistral · Together AI | Paid | — | Yes | Claude/GPT only |

**Best free option for volume: Groq** — 14,400 requests/day with no credit card. **Watch out for Gemini:** its free limits are counted *per model*, and `gemini-3.6-flash` allows only about **20 requests/day** — the Flash-Lite models are far more generous.

**On "which AI writes better ads": we don't claim to know.** There is no ground truth for ad copy, so a quality ranking would be invented. What the app measures instead is **retry rate** — how often a provider's first reply failed validation and had to be re-asked. That is observable, it doubles your token cost when it happens, and it comes from your own history.

### Step 3 · Add your first brand (3 minutes)

**Paste one URL and OpenAdKit drafts a complete brand profile — a "Brand Brain".**

1. The wizard's last step asks for a **website URL** — your brand, a client's, or a competitor you're studying.
2. Click **Extract**. OpenAdKit:
   - Reads the homepage (and a few key subpages like /about, /pricing)
   - Pulls Open Graph data, JSON-LD schema and social links
   - Asks the AI to fill 30+ brand fields: business name, industry, USP, tone, audience pains and desires, key benefits, words to use and avoid, competitors, and more
3. Review the **Brand Brain**. Fix anything that looks off. Hit **Save**. (The last 5 saves are kept, so you can roll back a bad re-extraction.)

> 💡 **Agencies:** repeat Step 3 for each client and switch the active client from the top bar. Every generator and optimizer uses the active client's Brand Brain.

### Step 4 · Generate your first ad (1 minute)

1. From the dashboard, pick a generator. Try **Meta · Facebook + Instagram Ads** first.
2. Fill the form: **objective**, **format** (Feed / Reels / Stories / Carousel), **product / offer** (pre-filled from the Brand Brain), and any **promotion**.
3. Click **Generate** and watch the copy stream in.
4. You get **angle-distinct variants** (pain, desire, social proof), each with primary text, headline, description, a CTA suggestion and a character count per field. For video formats you also get a hook / value / CTA script with on-screen text.

> 💡 Press ⌘+↵ (Mac) or Ctrl+↵ (Windows) anywhere in the generator to regenerate.

### Step 5 · Score, optimize, and ship (3–5 minutes)

1. Copy a variant. Open **Optimize → Creative Score**.
2. Paste the ad, pick the platform, click **Score**.
3. You get a **5-lever score** (hook strength, specificity, urgency, brand fit, conversion potential), a **verdict** (scale / iterate / rewrite / kill), **3 named fixes** (the exact phrase to change and the replacement) and a CTR band that is clearly labelled as an **AI estimate**.
4. Apply the fixes, re-score, repeat.
5. Before launch, try the other optimizers: **CTR Optimizer**, **Budget Waste**, **Audience Targeting**, **Quality Score** (Google), **A/B Test Planner**, **Budget Planner**.
6. Export from the History page as **Markdown**, **JSON** or **CSV** for client handoff.

> 💡 **Launch Guide** in the sidebar walks you through Facebook Ads Manager or Google Ads from campaign creation to publish — useful if you're new to paid media.

### What to try next

- **Research → Steal & Beat** — paste competitor ads from the Meta Ads Library / Google Transparency Center and get a teardown plus 3 beat-their-ad variants.
- **Generate → Content Calendar** — a dated social calendar with captions, hashtags and visual briefs.
- **Generate → Campaign Kit** — one brief becomes message-matched copy across Google, Meta, TikTok, LinkedIn, YouTube, X and email.
- **Learn → Frameworks Trainer** — interactive lessons in PAS, AIDA, BAB, the 4 U's and the Schwartz awareness ladder.

A full usage guide also lives at **`/how-to-use`** inside the app.

---

## Who's it for?

| You are… | OpenAdKit gives you… |
|---|---|
| 🧑‍💻 **A solo founder or indie maker** | Free AI ad copy across Google / Meta / TikTok / LinkedIn / YouTube / X without paying $49–125/mo for Jasper. |
| 🏢 **A marketing agency** | A Brand Brain per client, batch mode (the same asset for many clients in one run), per-client cost rollup, and Markdown / JSON / CSV / print-to-PDF export for client handoff. |
| 🛒 **An e-commerce store owner** | Performance Max + Shopping generators, a Reel idea generator with 10 hook formulas, hashtag sets per platform, a content calendar with image/video prompts. |
| 🎓 **A marketing student** | A free practice ground: framework trainer (PAS / AIDA / BAB / FAB / 4 U's), 28 mini-course lessons, a 25-concept library, industry benchmark ranges for CTR / CPC / CVR / ROAS. |
| 💸 **A budget-conscious freelancer** | Bring a free AI key (Groq, Gemini Flash, Cerebras, OpenRouter free models) and write ads at $0. |
| 🔒 **A privacy-conscious team** | No accounts, no telemetry, no cloud backend. Your work stays on your computer; API keys never go into the sync file. |
| 🤖 **A power user** | Cmd+K command palette, 9-provider switching, screenshot input on Claude / OpenAI / Gemini, keyboard navigation, and an [MCP server](docs/MCP.md) for Claude Desktop, Claude Code and Cursor. |

---

## What's inside

### Sidebar is grouped by platform

Pick where you're running ads first ("I'm doing Meta this week"), then see every tool that applies.

| Platform group | Generators | Optimizers in this group |
|---|---|---|
| **Meta · Facebook + Instagram** | Meta Ads · Reel Ideas · Lead Form · Hashtags · Content Calendar · Image / Video Prompts | CTR Optimizer · Creative Score · Audience Targeting · Ad Fatigue · A/B Test · Landing Page · Bid Strategy |
| **Google · Search + PMax + Shopping** | Google RSA · Performance Max · Shopping · Display Banners | Quality Score · Keyword Builder · Bid Strategy · CTR Optimizer · Audience · Landing Page · A/B Test |
| **TikTok** | TikTok In-Feed · Reel Ideas · Spark Ads · Branded Hashtag Challenge · Hashtags · Content Calendar · Image / Video Prompts | CTR Optimizer · Creative Score · Audience · Ad Fatigue |
| **LinkedIn · B2B** | LinkedIn Sponsored · Lead Form | CTR Optimizer · Audience · Landing Page · A/B Test |
| **YouTube** | YouTube scripts · Shorts Ideas · Hashtags · Image / Video Prompts | Creative Score |
| **X · Twitter** | Twitter Ads · Hashtags · Content Calendar | — |
| **Email + Display** | Email Subjects · Display Banners | — |

### Flagship features

- **🤖 Which AI should I use?** (`/providers`) — compare all 9 providers on free-tier limits, real cost per generation and image support, plus a *measured* view of your own usage. No invented quality scores.
- **⚡ 10-Minute Launch Wizard** (`/launch/wizard`) — strategy brief + cross-platform ad copy + content calendar + 3-email sequence + launch-day social posts, chained and streamed live.
- **Multi-Client Batch Mode** (`/batch`) — pick several clients and generate the same asset (Content Calendar / Hashtags / Reel Ideas / Campaign Kit) for each, in that client's own voice.
- **Reel Idea Generator** (`/generate/reel-ideas`) — 10 hook formulas (POV / Contradiction / Listicle / Number-Promise / Pattern-Interrupt / Before-After / Story / Demo / Controversy / Insider) with platform rules for IG Reels / TikTok / Shorts / FB Reels.
- **Competitor Reel Teardown** (`/research/reel-teardown`) — paste a competitor's captions, get their hook formulas, content pillars and weak spots, plus 5 "beat-their-reel" scripts.
- **Data-first optimizers** — CTR, Quality Score, Audience, Landing Page, Keywords, Bid Strategy and Ad Fatigue work from your real Google / Meta / TikTok numbers and cite them. You can also drop in a dashboard screenshot on vision-capable providers (Claude / OpenAI / Gemini).
- **🔌 MCP server** — use all of the above from inside Claude Desktop, Claude Code or Cursor. [Details below](#use-openadkit-inside-claude-desktop-claude-code-and-cursor-mcp).

### Universal tools (used across platforms)

**Full Campaign Kit** · **Hashtags (any language)** · **Email Subjects** · **Lead Forms** · **AI Image/Video Prompts** · **Social Content Calendar** · **Steal & Beat** competitor teardown · **Compare 2 Ads** · **Budget Waste Analyzer** · **Budget Planner** · **A/B Test Planner**

### Multi-client management

- Add a client by **pasting a website URL** — OpenAdKit drafts the Brand Brain (tone, audience, USP, words to use/avoid) with your chosen AI
- 10 **industry templates** for instant brand creation (local restaurant, B2B SaaS, e-commerce fashion, agency, and more)
- One-click client switcher in the top bar; history and checklists follow the active client
- Brand Brain version history (last 5 saves)

### Competitor intelligence

- **Steal & Beat** — paste competitor ads from Meta Ads Library / Google Transparency Center / TikTok Top Ads / LinkedIn Ad Library. The AI tears them down and writes 3 variants that beat the strongest one.
- **Compare 2 ads** — head-to-head teardown · picks the winner · proposes a hybrid

### Step-by-step launch guides

Pick a platform, your experience level and budget — OpenAdKit walks you through every click in Meta Ads Manager / Google Ads / TikTok Ads Manager / LinkedIn Campaign Manager.

### Routines + learning

- **Daily / Weekly / Monthly** checklists with streaks and custom items
- **28 mini-course lessons** across Google · Meta · TikTok tracks
- **Interactive Ad Copy School** — you write, the AI critiques, you rewrite (AIDA, PAS, BAB, FAB, 4 U's)
- **25-concept library** + on-demand AI explainer
- **Industry benchmark ranges** for CTR / CPC / CVR / ROAS (directional ranges from public reports — your own data always wins)

### Performance feedback loop

Log impressions / clicks / conversions / spend / revenue per ad → OpenAdKit computes CTR / CPA / ROAS → surfaces **winning angles per brand** in future Suggested Campaigns.

### Ad mockups

Google / Meta / TikTok generations include a **live mockup** — feed cards, Reels overlays, search result previews — so you can see the ad before you launch it.

### Spend controls

A per-run token and cost counter, a monthly budget with an 80% warning and an optional hard stop, and the provider's own rate-limit message shown word for word with a retry countdown.

---

## No made-up numbers

AI models happily invent statistics. OpenAdKit is built to stop that:

- **A/B test sample sizes are calculated, not guessed.** The A/B Test Planner uses the standard two-proportion formula (95% confidence, 80% power) on your baseline rate and the smallest lift you care about. The AI only writes the hypotheses and test design.
- **Budget projections come from your numbers.** The Budget Planner computes clicks, conversions, CPA and ROAS from your own CPC, conversion rate and order value — or, if you leave them blank, from benchmark midpoints that are **clearly labelled** as such.
- **The Creative Score CTR band is labelled as an AI estimate**, because that's what it is.
- **Prompts forbid invented proof.** Ad prompts only use social proof, data and named customers that are in your Brand Brain; otherwise they ask for concrete, checkable specifics.
- **Every structured result is checked.** Each JSON output is validated against a schema; if it fails, OpenAdKit automatically asks the model to correct it once (and tells you the retry is included in the cost).

---

## Use OpenAdKit inside Claude Desktop, Claude Code and Cursor (MCP)

OpenAdKit includes an **MCP server** — a small connector that lets AI assistants call OpenAdKit's tools directly. Ask Claude *"write Google search ads for my dental clinic client"* and it uses OpenAdKit's Google RSA tool, your saved Brand Brain, and the real character limits.

**What you get:** 30 AI tools (18 generators, 11 optimizers, 1 competitor-research tool) plus `list_brands`, `get_brand`, `validate_output` and `openadkit_status`.

**Two ways it runs:**

- **No AI key needed (prompt mode).** OpenAdKit hands the assistant the exact prompt and output format; Claude writes the result and checks it with `validate_output`, which also enforces platform character limits (for example, 30 characters for a Google headline).
- **With your own key (generate mode).** Set an AI key such as `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in the connector's settings and OpenAdKit generates, validates and retries by itself.

A/B sample sizes, budget projections, CTR / CPA math, fatigue changes and bid feasibility are computed in code either way. Brands come from the clients you saved in the OpenAdKit app.

**Connecting it:**

- **Windows installer:** tick **"Connect OpenAdKit to Claude Desktop"** during setup (shown when Claude Desktop is installed).
- **macOS / Linux installer:** answer **Y** when it asks about Claude Desktop.
- **Any time:** open **Settings** in the app — it shows the exact config for your computer, ready to copy.
- **Claude Code:** `claude mcp add openadkit -- node <path to openadkit-mcp.mjs>`
- **Cursor or any other MCP app:** add it to `.cursor/mcp.json` / your app's MCP config.

Full setup with copy-paste config for each app, file paths per operating system and the complete tool list: **[docs/MCP.md](docs/MCP.md)**.

---

## 9 AI providers supported

| Tier | Provider | Free? | Notes |
|---|---|:-:|---|
| **Free** | **Groq** | ✅ | ~30 req/min · very fast |
| **Free** | **Cerebras** | ✅ | ~30 req/min · very fast |
| **Freemium** | **Google Gemini** | ✅ | Free tier counted per model · paid Pro |
| **Freemium** | **OpenRouter** | ✅ | Free community models tagged `:free` |
| **Freemium** | **Together AI** | partial | Some free models · mostly cheap paid |
| **Paid** | **Anthropic Claude** | ❌ | Sonnet 5.5 (default), Opus 5.5, Haiku 5.5, Fable 5.2 |
| **Paid** | **OpenAI GPT** | ❌ | Strong structured JSON |
| **Paid** | **DeepSeek** | ❌ | Low cost |
| **Paid** | **Mistral** | ❌ | Multilingual + JSON |

Pick during onboarding · switch any time in Settings · one app, every API.

---

## OpenAdKit vs Jasper, AdCreative, Anyword, Copy.ai — Feature Comparison

> Looking for one specifically? Jump to:
> [OpenAdKit vs Jasper](#openadkit-vs-jasper) ·
> [OpenAdKit vs AdCreative](#openadkit-vs-adcreativeai) ·
> [OpenAdKit vs Anyword](#openadkit-vs-anyword) ·
> [OpenAdKit vs Copy.ai](#openadkit-vs-copyai) ·
> [OpenAdKit vs Pencil](#openadkit-vs-pencil--genusai)
>
> Or read the full side-by-side at [openadkit.dicecodes.com/alternatives](https://openadkit.dicecodes.com/alternatives).

### Full feature matrix

| Feature | Jasper $49+ | AdCreative $39+ | Anyword $49+ | Pencil $119+ | **OpenAdKit · free** |
|---|:-:|:-:|:-:|:-:|:-:|
| Visual ad mockups | ❌ | ✅ | ❌ | ✅ | ✅ |
| Multi-platform copy | ✅ | partial | ✅ | Meta-only | ✅ (18 generators) |
| Brand voice memory | ✅ | ❌ | partial | partial | ✅ (per-client) |
| Creative scoring | ❌ | ✅ | ✅ | ✅ | ✅ (AI estimate, labelled) |
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
| Works inside Claude / Cursor (MCP) | ❌ | ❌ | ❌ | ❌ | ✅ |
| 9 AI providers · BYOK · free+paid | 1 | 1 | 1 | 1 | ✅ |
| Open source · MIT · self-host | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Monthly cost** | **$49–125** | **$39–299** | **$49–999** | **$119–999** | **$0** |

### OpenAdKit vs Jasper

Jasper ($39–59/seat/mo) is a polished long-form + ad-copy generator with brand-voice training. It's strong on consistency across blog/email/social, but **lacks platform-specific format enforcement** — generic copy ignores Meta's mobile headline length, Google PMax asset groups, and TikTok Spark Ad mechanics. Per-seat pricing scales painfully for agencies. **OpenAdKit covers the same ad-copy surfaces plus 11 dedicated optimizers** (creative score, CTR, ad fatigue, quality score), and BYOK across 9 providers means you use the same top models at your provider's price, with nothing on top.

### OpenAdKit vs AdCreative.ai

AdCreative ($39–249+/mo) is best for **AI-generated visual ad creatives** (banners, video) with a "conversion probability" score — capabilities OpenAdKit does NOT have in-app. **OpenAdKit is broader on copy** (18 generators) and optimizers. For visuals, OpenAdKit writes ready-to-paste prompts for Midjourney / DALL-E / Runway / Pika plus a directory of free and paid tools — you keep the choice.

### OpenAdKit vs Anyword

Anyword ($49–499/seat/mo) is known for **per-variant predictive scoring** and brand-voice training, with enterprise features at the top tier and no platform-specific generators (no PMax, no Spark Ads, no Branded Hashtag Challenge). **OpenAdKit's Creative Score** covers similar ground (5-lever score + named fixes + a CTR band labelled as an AI estimate) without per-seat fees. Anyword's brand voice maps to OpenAdKit's **Brand Brain**, drafted from any URL.

### OpenAdKit vs Copy.ai

Copy.ai (Free 2k words/mo, Pro $49/mo, Team $249/mo) offers **multi-step GTM workflows** and sales agents. **OpenAdKit has no word or credit caps** because you pay your AI provider directly (free tiers on Groq, Gemini, Cerebras, OpenRouter). The Launch Wizard handles multi-step campaign orchestration, and the 18 generators each enforce platform formats.

### OpenAdKit vs Pencil / Genus.ai

Pencil (~$119+/mo, enterprise) does **AI ad creative generation with performance prediction**. It moved upmarket — out of reach for solo and small-business marketers. **OpenAdKit serves that segment**: copy + optimizer breadth, $0 instead of $119+/mo, MIT licensed so your work and brand data stay yours.

---

## Privacy & security

- **No accounts, no telemetry, no analytics.** Nothing is sent to DiceCodes.
- **BYOK.** Your API key is stored on your computer (in the app's browser storage). Every AI call goes **straight from the app to the provider you picked**.
- **Optional key encryption.** Turn on the key vault in Settings to encrypt saved keys with a passphrase (PBKDF2 + AES-GCM), unlocked once per session.
- **Keys never go into the sync file.** Folder sync saves clients, history and settings — API keys are always left out.
- **Soft-delete + undo.** Accidental deletes get a 7-second undo.
- **Export & wipe.** Settings has full export (JSON / CSV / Markdown) and "wipe all local data".

> ⚠️ Treat OpenAdKit like a password manager: only use it on computers you trust.

See [SECURITY.md](SECURITY.md) for the threat model and how to report a vulnerability.

### Where your data lives

Your clients, history and settings are kept in the app's browser storage (IndexedDB + localStorage) **and** copied by the local sync sidecar to a `snapshot.json` file:

| Computer | Folder |
|---|---|
| Windows | `%APPDATA%\OpenAdKit` |
| macOS | `~/Library/Application Support/OpenAdKit` |
| Linux | `~/.config/openadkit` |

Updating or uninstalling never touches this folder. Copy it to a new computer and your clients come back (re-enter your API keys there). Sync merges row by row, so an edit made in one place isn't overwritten by an older copy, and a client you delete stays deleted.

**Hosted (Vercel) and Docker:** there is no sync sidecar, so your work lives only in that browser. Use *Settings → Export* to back it up.

### What leaves your computer

1. The AI provider you configured — for every generation.
2. Website readers (the local sidecar first, then Jina Reader `r.jina.ai`, then AllOrigins as a fallback) — only when you paste a URL for brand extraction.
3. GitHub — installed copies check the latest release for updates.
4. Competitor ad libraries (`facebook.com/ads/library`, `adstransparency.google.com`, `ads.tiktok.com`, `linkedin.com/ad-library`) — only when *you* click "Open"; they open in your browser, never proxied.

**Hosted mode** sends one extra thing to your own Vercel server: the URL you type into brand extraction (so `/api/ingest` can fetch it). Your AI key never touches that server.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR COMPUTER                               │
│                                                                     │
│   App window / browser ──► Local Next.js 16 server (127.0.0.1)      │
│        │                                                            │
│        ├──► Your chosen AI provider, directly                       │
│        │    (api.anthropic.com / api.openai.com / Gemini / …)       │
│        │                                                            │
│   IndexedDB + localStorage  ◄── merge sync ──►  Local-sync sidecar  │
│                                               (Node, 127.0.0.1)     │
│                                                       │             │
│                                                       ▼             │
│                                          <user data dir>/snapshot.json
│                                                       ▲             │
│   Claude Desktop / Claude Code / Cursor ──► MCP server (reads brands)│
└─────────────────────────────────────────────────────────────────────┘
```

The Windows app is a small native window (WebView2) around the same local server. On macOS and Linux the app opens in your default browser. The local app starts in about 1–3 seconds because it runs Next.js's production standalone server, not a dev build.

---

## Project layout

```
openadkit/
├── app/                         Next.js App Router
│   ├── generate/*               18 ad generators
│   ├── optimize/*               11 optimizers
│   ├── research/*               Steal & Beat · Compare ads · Reel Teardown
│   ├── launch/wizard/           10-minute Launch Wizard
│   ├── batch/                   Multi-client batch generation
│   ├── providers/               "Which AI should I use?"
│   ├── support/                 Support & about (UPI, PayPal, Work with DiceCodes)
│   ├── api/ingest/              URL reader for hosted mode
│   └── …                        platforms, learn, checklist, campaigns, brand, settings
│
├── components/                  UI (GeneratorShell, AdMockup, CommandPalette, …)
├── lib/
│   ├── providers/               9-provider abstraction
│   ├── prompts/                 Prompt templates
│   ├── schemas/                 Output schemas (zod)
│   ├── tools/                   Tool registry + platform character limits (shared with MCP)
│   ├── storage.ts               Dexie / IndexedDB + merge sync with tombstones
│   ├── local-sync.ts            Folder-sync client (never syncs keys)
│   ├── key-vault.ts             Optional key encryption
│   ├── ab-math.ts               Two-proportion sample-size math
│   └── budget-estimates.ts      Budget projections from your inputs
│
├── mcp/                         MCP server (server.ts, runtime.ts)
├── installer/                   Windows host (WebView2) + Inno Setup script
├── scripts/                     Sidecar, launchers, build + release helpers
├── install.sh / install.ps1     One-line installers (macOS/Linux · Windows)
├── OpenAdKit.bat / .command     Launch from a source checkout
├── Dockerfile · vercel.json
└── package.json
```

---

## Tech stack

- **Next.js 16** (App Router, Turbopack, standalone production server) · **React 19** · **Tailwind CSS 4** · **TypeScript** strict
- **Zod 4** schemas for every AI output · **Dexie 4** (IndexedDB) · **Zustand 5**
- **Node 20.9+** (Node 24 LTS bundled in the installers)
- **MCP server** built on the official `@modelcontextprotocol/sdk`
- **Windows app:** WinForms + WebView2 host, Inno Setup installer, per-user install
- **No cloud backend, no analytics**

### Quality & testing

- **780+ unit and integration tests** (Vitest) — providers, prompts vs. schemas, sync merge, the sidecar, the MCP server, update checks and more.
- **93 Playwright browser tests** against the production build, plus **4 data-safety scenario tests** (a client is written to disk, a fresh browser gets it back, a delete stays deleted everywhere, API keys never reach the sync file).
- **CI** runs typecheck, tests, lint and a production build on Node 22, 24 and 26 for every pull request.
- **The Windows installer is built, silently installed and self-tested in CI** before a release is drafted.

---

## Start / Stop reference

**Installed app:** open it from the Start menu (Windows), Launchpad / Spotlight (macOS) or the app menu / `openadkit` command (Linux). Close the window to quit on Windows; on macOS / Linux run `openadkit stop` or the stop command the installer printed.

**From source:**

| Action | Windows | Mac / Linux |
|---|---|---|
| Launch | double-click `OpenAdKit.bat` | `bash OpenAdKit.command` |
| Launch with a visible log | `scripts\start.bat` | `bash scripts/start.sh` |
| Stop everything | `scripts\stop.bat` | `bash scripts/stop.sh` |
| Web app with hot reload | `npm run dev` | `npm run dev` |
| Dev server + sidecar together | `npm run start:all` | `npm run start:all` |
| Typecheck · tests · build | `npm run typecheck` · `npm test` · `npm run build` | same |
| Build the MCP server | `npm run build:mcp` | same |

The start and stop scripts work from any folder. Ports are chosen automatically and remembered, because your browser data is tied to the address (including the port).

---

## Troubleshooting

### Windows says "Windows protected your PC"

Click **More info → Run anyway**. The installer isn't code-signed yet. You can check the download against `SHA256SUMS.txt` on the [release page](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases/latest), or use the PowerShell line, which checks it for you.

### OpenAdKit opens in my browser instead of its own window (Windows)

The Microsoft Edge WebView2 runtime is missing (it ships with Windows 11 and comes with Edge on Windows 10). OpenAdKit still works in your browser; install WebView2 from Microsoft to get the app window.

### "OpenAdKit did not start within 60 seconds" (macOS / Linux)

Check the log (below) for the real error. Then run the install line again — it reinstalls the program and keeps your data.

### My clients or keys disappeared

Browser storage is tied to the exact address, including the port. The installed apps keep the same port on purpose. If you opened OpenAdKit at a different address (another port, `localhost` vs `127.0.0.1`, or a custom domain), switch back. Your clients are also in `snapshot.json` in your [data folder](#where-your-data-lives), and the app pulls them back in when the sidecar is running. API keys are never in that file — re-enter them.

### Where do I find the logs?

| Install | Log file |
|---|---|
| Windows app | `%LOCALAPPDATA%\OpenAdKit\logs\server.log` |
| macOS | `~/Library/Application Support/OpenAdKit/runtime/server.log` |
| Linux | `~/.local/share/openadkit/server.log` |
| From source | run `scripts\start.bat` / `bash scripts/start.sh` to see the log in the window |

Errors inside the app: press F12 (browser) → Console.

### From source: port in use, blank page, or stuck on "Starting…"

- Run `scripts\stop.bat` / `bash scripts/stop.sh`, then launch again — the launcher picks a free port pair.
- Page shows raw, unstyled HTML: delete the `.next/` folder and run `npm run build` again (or use **Clean rebuild** in the control panel). This happens when `npm run build` runs while `npm run dev` is also running.
- `node --version` must be **20.9 or newer**.

### Reporting a bug

[Open an issue](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/issues/new) with your operating system, how you installed OpenAdKit, what you were doing, and the last lines of the log. From a source checkout, the control panel's **Report a problem on GitHub** button fills most of this in for you.

---

## Frequently Asked Questions

### Is OpenAdKit really free?
Yes. MIT licensed, no paid tier, no credits. You only pay your AI provider — and Groq, Gemini, Cerebras and OpenRouter's `:free` models have free tiers. See [Why is it free?](#why-is-it-free)

### Is OpenAdKit a real Jasper / AdCreative / Copy.ai alternative?
For ad copy across Google, Meta, TikTok, LinkedIn, YouTube and X — yes: 18 generators, 11 optimizers, a Brand Brain per client, competitor teardowns, content calendars and a 10-minute launch wizard. It does **not** generate images; it writes prompts for Midjourney / Runway / DALL-E / Pika instead.

### Do I need to be technical to install it?
No. On Windows, download the Setup and double-click it. On a Mac or Linux, paste one line into Terminal. No Node.js, git or build step needed.

### Where does my data go?
It stays on your computer: in the app's browser storage and in a `snapshot.json` file in your [data folder](#where-your-data-lives). No cloud sync, no accounts, no analytics.

### What about my AI API key?
It's stored on your computer and sent only to the provider you picked. It is never written to the sync file. You can encrypt it with a passphrase in Settings.

### Which AI provider should I pick if I want it free?
**Groq** for volume and speed, **Gemini** (watch the per-model daily limit), or **OpenRouter** `:free` models. Save several keys and switch when one hits its limit.

### Can I use OpenAdKit inside Claude?
Yes — through the [MCP server](docs/MCP.md). It works in Claude Desktop, Claude Code, Cursor and other MCP apps, with or without an AI key.

### How do I update?
Installed apps show an **"OpenAdKit vX is available"** notice when a new release is out. Windows updates in one click; on macOS / Linux run the install line again. Your data is kept.

### How do I move OpenAdKit to another computer?
Install it on the new computer, copy your [data folder](#where-your-data-lives) across, and open the app. Or use *Settings → Export* / Import. Re-enter your API keys.

### Can I run it for my whole team?
It's designed for one person per computer. The local server has no login, so don't expose it on a network. For a team, deploy your own hosted copy per person, or [ask DiceCodes](mailto:contact@dicecodes.com) to build a multi-user version.

### Does it work offline?
The app shell and pages you've opened before load offline. AI generation, URL reading and update checks need the internet.

### Can the AI read screenshots of my ads dashboard?
Yes, on vision-capable models (Claude, OpenAI, Gemini). Drop a screenshot into CTR Optimizer / Quality Score / Audience / Landing Page / Keywords / Bid Strategy / Ad Fatigue. If your active provider is text-only, OpenAdKit can use another provider you've saved a key for, just for that run.

### How is OpenAdKit different from ChatGPT or Claude itself?
A general chatbot writes ad copy if you prompt it, but you handle the framework, character limits, platform rules and structure yourself. OpenAdKit wraps the model in task-specific prompts (Schwartz awareness ladder, Google RSA limits, Meta primary-text rules, TikTok hook formulas, 4 U's), checks every result against a schema and the platform's character limits, and remembers each client's brand.

### How do I contribute?
See [CONTRIBUTING.md](CONTRIBUTING.md). Most new generators are one prompt file plus one page that uses the shared `GeneratorShell`.

### License?
**MIT.** Use it commercially, fork it, white-label it. Please keep the license notice.

---

## Support the project

### Why is it free?

OpenAdKit is built by **[DiceCodes](https://dicecodes.com)**, a small software studio in India. We make our living from custom software for clients, not from this tool — so OpenAdKit stays free, with no paid tier and no ads. If it saves you a subscription, here's how to help:

- ⭐ **[Star the repo](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/stargazers)** — it helps other marketers find it.
- 📣 **Tell another marketer, freelancer or agency** who's paying for an AI ad tool.
- 🐞 **[Report a bug or ask for a feature](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/issues/new)**.
- 🇮🇳 **UPI (India):** `princeramgarhiaa-1@okaxis` — or scan the QR code on the **Support** page inside the app.
- 🌍 **PayPal (international):** [Donate via PayPal](https://www.paypal.com/donate/?business=princeramgarhiaa@gmail.com&currency_code=USD&item_name=Support%20OpenAdKit)
- 🛠️ **Work with DiceCodes** — need custom software, a private fork or a white-label agency edition? 📧 [contact@dicecodes.com](mailto:contact@dicecodes.com) · [dicecodes.com](https://dicecodes.com)

Donations are a thank-you, not a licence fee — the software is yours either way.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pattern grounding: OpenAdKit prompts borrow patterns (with attribution) from open source skill repos — see [NOTICE.md](NOTICE.md).

What changed in this release: [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md) · full history: [CHANGELOG.md](CHANGELOG.md).

---

## About

OpenAdKit is built by **[DiceCodes](https://dicecodes.com)** — a digital studio combining creative design with technology for measurable business growth.

Need a private fork, a white-label agency edition, or something we haven't built? **[Get in touch →](https://dicecodes.com)** · 📧 [contact@dicecodes.com](mailto:contact@dicecodes.com) · 💬 [WhatsApp +91 98884 04991](https://wa.me/919888404991)

---

## License

MIT. See [LICENSE](LICENSE).

<div align="center">

<sub>**Made in India · [DiceCodes](https://dicecodes.com)** · Open source forever · No telemetry · Your key, your data, your computer.</sub>

</div>
