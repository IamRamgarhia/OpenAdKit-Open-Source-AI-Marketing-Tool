# OpenAdKit MCP server — use OpenAdKit inside Claude Desktop, Claude Code and Cursor

OpenAdKit ships an **MCP server** (Model Context Protocol). It lets AI assistants such as **Claude Desktop**, **Claude Code** and **Cursor** call OpenAdKit's ad generators, optimizers and research tool directly, using the client brands you saved in the OpenAdKit app.

Ask Claude something like:

> *"Using OpenAdKit, write Google search ads for my client Bright Smile Dental."*

Claude looks up the saved brand, runs OpenAdKit's Google RSA tool, and checks every headline against Google's 30-character limit before showing it to you.

- [What's included](#whats-included)
- [Two modes: with or without an AI key](#two-modes-with-or-without-an-ai-key)
- [Where the server is on your computer](#where-the-server-is-on-your-computer)
- [Claude Desktop](#claude-desktop)
- [Claude Code](#claude-code)
- [Cursor and other MCP apps](#cursor-and-other-mcp-apps)
- [Environment variables](#environment-variables)
- [From source](#from-source)
- [Troubleshooting](#troubleshooting)

---

## What's included

**30 AI tools** — the same tools as the app (each one maps to a page in OpenAdKit):

**Generate (18)**

| Tool | What it does |
|---|---|
| `generate_meta_ads` | Meta (Facebook + Instagram) ad variants within Meta's character limits |
| `generate_google_search_ads` | 15 headlines (≤30 chars) and 4 descriptions (≤90 chars) for a Google responsive search ad |
| `generate_google_pmax_assets` | Performance Max asset group: headlines, long headlines, descriptions, audience signals |
| `generate_google_shopping_feed` | Google Shopping / Merchant Center product title and description |
| `generate_tiktok_ads` | TikTok hooks or a full UGC-style video script |
| `generate_tiktok_spark_ads` | Turn an organic TikTok post into a Spark Ad |
| `generate_tiktok_hashtag_challenge` | TikTok Branded Hashtag Challenge concept, creator brief and rollout |
| `generate_x_twitter_ads` | X (Twitter) promoted posts, video, website cards, follower ads or threads (optional `landing_url`, `audience_geo`) |
| `generate_youtube_ads` | YouTube in-stream, bumper (6s) or discovery ad scripts and copy |
| `generate_linkedin_ads` | LinkedIn sponsored content, message ads, dynamic ads, text ads or lead-gen forms |
| `generate_display_ads` | Google responsive display ad headlines, descriptions and banner copy |
| `generate_email_subject_lines` | Email subject lines and preview text |
| `generate_hashtags` | Tiered hashtag set (broad / niche / branded) |
| `generate_lead_form` | Lead-form intro, questions and thank-you screen (Meta, LinkedIn, Google, TikTok) |
| `generate_content_calendar` | Dated social posting calendar with hooks, formats and captions |
| `generate_creative_prompts` | Ready-to-paste prompts for image and video AI tools (Midjourney, Runway, …) |
| `generate_campaign_kit` | Multi-platform campaign: strategy, budget split and copy per channel |
| `generate_reel_ideas` | Hook-first Reels / TikTok / Shorts ideas with scripts and on-screen text |

**Optimize (11)**

| Tool | What it does |
|---|---|
| `optimize_ctr` | Diagnose a low click-through rate from real numbers and rewrite the ad — **CTR / CVR / CPC / CPA computed in code** |
| `optimize_quality_score` | Find what drags a keyword's Google Quality Score down and how to fix it — **CTR / CVR / CPA computed in code** |
| `optimize_audience_targeting` | Audience structure, exclusions and testing plan |
| `optimize_ad_fatigue` | Decide whether an ad is fatigued from week-over-week numbers — **week-1 vs latest changes computed in code** |
| `optimize_bid_strategy` | Recommend a bid strategy from conversion volume, targets and history — **budget ÷ target CPA feasibility computed in code** |
| `optimize_keywords` | Keyword groups, match types and negatives |
| `optimize_landing_page` | Grade a landing page against the ad promise, with prioritized fixes — **conversion rate and bounce band computed in code** |
| `optimize_ab_test` | A/B test plan — **sample size and duration computed in code** (two-proportion formula, 95% confidence, 80% power) |
| `optimize_budget_planner` | Split a monthly budget across platforms — **projections and break-even CPA computed in code** from your numbers (optional `gross_margin_pct`) or labelled benchmark midpoints |
| `optimize_creative_score` | Score ad copy and get specific rewrites (any CTR band is a directional AI estimate) |
| `optimize_budget_waste` | Find where ad spend leaks and what to fix first; optional `conversion_tracking` (yes / no / unsure) — unconfirmed tracking still gets the structural audit, with a warning |

**Research (1)**

| Tool | What it does |
|---|---|
| `research_competitor_ads` | Tear down pasted competitor ads and write counter-positioned ads for your product |

Every AI tool also accepts these optional inputs:

| Input | Meaning |
|---|---|
| `client` | A saved client brand (id or business name from `list_brands`). Its tone, offers, audience and proof are used. |
| `output_language` | Language for the generated copy, e.g. `Spanish`, `Hindi`. Default English. |
| `tone_override` | Override the brand's tone for this run. |
| `mode` | `auto` (default), `generate` (require a key) or `prompt` (always return the prompt). |

**Plus 4 helper tools:**

| Tool | What it does |
|---|---|
| `list_brands` | Client brands (Brand Brains) saved in the OpenAdKit app on this computer |
| `get_brand` | The full Brand Brain for one client |
| `validate_output` | Check JSON written for a tool against that tool's output schema **and** the ad platforms' character limits |
| `openadkit_status` | Which provider and model will be used, the mode, where client data is read from, and how many brands were found |

---

## Two modes: with or without an AI key

**Without an AI key (prompt mode)** — nothing to pay OpenAdKit or a second provider.
The tool returns OpenAdKit's exact system prompt, task prompt and the JSON Schema of the expected result. The assistant (for example Claude in Claude Desktop) writes the result itself and then calls `validate_output`. That check covers the output's shape and hard platform limits — Google headlines (30), descriptions (90), sitelinks, callouts and display paths; Performance Max headlines and descriptions; display headlines, descriptions and CTA buttons (per banner size) and responsive display assets; Meta headlines (40); LinkedIn intro text (600) and headlines (200); X posts (280, every link counted as 23) and website-card headlines (70); TikTok and Spark Ads captions (100) and hashtag-challenge Discover copy; Google Shopping titles (150) and highlights (60); campaign-kit RSA / Meta / X copy; Quality Score headline suggestions (30); YouTube in-feed headlines (100). Too-long text is rejected unless a shorter `trimmed_alt` that fits is supplied.

**With an AI key (generate mode)** — set one of the key variables below in the server's environment.
OpenAdKit calls that provider itself, validates the reply (schema + character limits), retries once with the exact problems if it fails, and returns the validated result along with the provider, model, attempts, token usage and estimated cost.

In both modes, arithmetic is done in code and returned as `computed_in_code` — the model never makes those numbers up: A/B sample size and duration, budget projections and break-even CPA, CTR / conversion rate / CPC / CPA (CTR optimizer, Quality Score), landing-page conversion rate and bounce band, week-over-week fatigue changes, and bid-strategy feasibility (budget ÷ target CPA). The same values are written into the prompt as facts.

When a `client` brand is given, the tool's prompt also sees that brand (as in the web app) — for example, the campaign kit plans budget across the brand's own platforms.

---

## Where the server is on your computer

The installers put a ready-to-run copy of the server (`openadkit-mcp.mjs`) next to the app:

| Computer | Node | MCP server |
|---|---|---|
| **Windows** | `%LOCALAPPDATA%\Programs\OpenAdKit\node\node.exe` | `%LOCALAPPDATA%\Programs\OpenAdKit\app\mcp\openadkit-mcp.mjs` |
| **macOS** | `~/Library/Application Support/OpenAdKit/runtime/node/bin/node` if the installer downloaded Node, otherwise your own `node` (`which node`) | `~/Library/Application Support/OpenAdKit/runtime/app/mcp/openadkit-mcp.mjs` |
| **Linux** | `~/.local/share/openadkit/node/bin/node` if the installer downloaded Node, otherwise your own `node` | `~/.local/share/openadkit/app/mcp/openadkit-mcp.mjs` |

The server needs Node.js 20.9 or newer. Config files need **full paths** — replace `YOU` below with your user name.

---

## Claude Desktop

### The easy way

- **Windows:** tick **"Connect OpenAdKit to Claude Desktop"** in the OpenAdKit installer. The option appears when Claude Desktop is installed; uninstalling OpenAdKit removes the entry again.
- **macOS / Linux:** when the install line finds Claude Desktop, answer **Y** to *"Connect OpenAdKit to it?"*. If you skip it, the installer prints the command to run later.
- **Copy from the app:** open **Settings** in OpenAdKit. The MCP section shows the exact Claude Desktop / Cursor config and the Claude Code command for your computer, with a copy button.

The installers add an `openadkit` entry to Claude Desktop's config without touching your other servers (the old file is backed up as `claude_desktop_config.json.openadkit-backup`). **Restart Claude Desktop** afterwards.

### By hand

Open Claude Desktop's config file (Claude Desktop → Settings → Developer → Edit Config):

| Computer | Config file |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add `openadkit` under `mcpServers` (keep any servers already there):

**Windows**

```json
{
  "mcpServers": {
    "openadkit": {
      "command": "C:\\Users\\YOU\\AppData\\Local\\Programs\\OpenAdKit\\node\\node.exe",
      "args": ["C:\\Users\\YOU\\AppData\\Local\\Programs\\OpenAdKit\\app\\mcp\\openadkit-mcp.mjs"]
    }
  }
}
```

**macOS**

```json
{
  "mcpServers": {
    "openadkit": {
      "command": "/Users/YOU/Library/Application Support/OpenAdKit/runtime/node/bin/node",
      "args": ["/Users/YOU/Library/Application Support/OpenAdKit/runtime/app/mcp/openadkit-mcp.mjs"]
    }
  }
}
```

(If the installer used your own Node, put the output of `which node` in `command`.)

**Linux**

```json
{
  "mcpServers": {
    "openadkit": {
      "command": "/home/YOU/.local/share/openadkit/node/bin/node",
      "args": ["/home/YOU/.local/share/openadkit/app/mcp/openadkit-mcp.mjs"]
    }
  }
}
```

**Optional: generate mode.** Add an `env` block with one AI key:

```json
{
  "mcpServers": {
    "openadkit": {
      "command": "C:\\Users\\YOU\\AppData\\Local\\Programs\\OpenAdKit\\node\\node.exe",
      "args": ["C:\\Users\\YOU\\AppData\\Local\\Programs\\OpenAdKit\\app\\mcp\\openadkit-mcp.mjs"],
      "env": {
        "GEMINI_API_KEY": "your-key-here",
        "OPENADKIT_PROVIDER": "google"
      }
    }
  }
}
```

Restart Claude Desktop. Ask *"What's the OpenAdKit status?"* — Claude calls `openadkit_status` and tells you the mode and how many saved brands it found.

---

## Claude Code

```bash
claude mcp add openadkit -- node "/full/path/to/openadkit-mcp.mjs"
```

Use the Node and server paths from [the table above](#where-the-server-is-on-your-computer) — for example on Windows:

```bash
claude mcp add openadkit -- "C:\Users\YOU\AppData\Local\Programs\OpenAdKit\node\node.exe" "C:\Users\YOU\AppData\Local\Programs\OpenAdKit\app\mcp\openadkit-mcp.mjs"
```

To use generate mode, pass a key with `-e`:

```bash
claude mcp add openadkit -e ANTHROPIC_API_KEY=sk-ant-... -- node "/full/path/to/openadkit-mcp.mjs"
```

The macOS / Linux installer prints the exact `claude mcp add` line for your machine at the end of the install.

---

## Cursor and other MCP apps

Cursor reads `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` for all projects). The format is the same as Claude Desktop's:

```json
{
  "mcpServers": {
    "openadkit": {
      "command": "node",
      "args": ["/full/path/to/openadkit-mcp.mjs"],
      "env": {}
    }
  }
}
```

Any app that supports MCP servers over **stdio** works the same way: command = Node, argument = the path to `openadkit-mcp.mjs`.

---

## Environment variables

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google Gemini |
| `GROQ_API_KEY` | Groq |
| `CEREBRAS_API_KEY` | Cerebras |
| `OPENROUTER_API_KEY` | OpenRouter |
| `TOGETHER_API_KEY` | Together AI |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `MISTRAL_API_KEY` | Mistral |
| `OPENADKIT_PROVIDER` | Which provider to use when several keys are set: `anthropic`, `openai`, `google`, `groq`, `cerebras`, `openrouter`, `together`, `deepseek`, `mistral`. Without it, the first key found in the order above wins. |
| `OPENADKIT_MODEL` | Override the provider's default model. |
| `OPENADKIT_DATA_DIR` | Folder that holds the app's `snapshot.json`, if it isn't in the default place. |

No key set → prompt mode. Keys you set here are used only by the MCP server; the OpenAdKit app keeps its own keys separately and never writes them to the sync file.

### Where brands come from

`list_brands` and `get_brand` read the `snapshot.json` that the OpenAdKit app's sync sidecar writes:

| Computer | Default folder |
|---|---|
| Windows | `%APPDATA%\OpenAdKit` |
| macOS | `~/Library/Application Support/OpenAdKit` |
| Linux | `~/.config/openadkit` |

Open the OpenAdKit desktop app at least once after adding a client so it's saved there. Deleted clients are left out. The hosted (Vercel) and Docker versions have no sidecar, so they don't write this file — pass details straight to each tool instead.

---

## From source

```bash
npm install
npm run build:mcp            # writes mcp/dist/openadkit-mcp.mjs (one file, no node_modules needed)
node mcp/dist/openadkit-mcp.mjs   # or: npm run mcp
```

Point your MCP app at the full path of `mcp/dist/openadkit-mcp.mjs`. The server logs to stderr only (stdout carries the MCP protocol), and on start prints which mode it is in.

---

## Troubleshooting

- **Claude doesn't show OpenAdKit tools** — restart Claude Desktop after editing the config. Check the paths exist and that the JSON is valid (no trailing commas). Windows paths in JSON need double backslashes.
- **`list_brands` returns no brands** — open the OpenAdKit app so it syncs your clients, or set `OPENADKIT_DATA_DIR`. `openadkit_status` shows the exact file it reads.
- **`mode='generate' needs an AI key`** — you asked for generate mode without a key in the server's `env`. Add one, or use `auto` / `prompt`.
- **`OPENADKIT_PROVIDER="…" is not a known provider`** — use one of the names in the table above.
- **`validate_output` says text is too long** — shorten the field to the limit it names, or add a `trimmed_alt` that fits.

Found a bug? [Open an issue](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/issues/new).

---

<sub>OpenAdKit is free and MIT licensed · built by [DiceCodes](https://dicecodes.com) · [Support the project](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool#support-the-project)</sub>
