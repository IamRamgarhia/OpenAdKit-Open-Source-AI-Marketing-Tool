# Social preview image · spec for GitHub upload

GitHub uses the **Social preview** image when your repo is shared on Twitter / X, LinkedIn, Slack, Discord, Notion, Bluesky, or anywhere else that fetches OpenGraph cards. **Without one set, those shares show GitHub's gray default** — which kills click-through.

This file documents what to make + how to upload.

## Spec

| Property | Value |
|---|---|
| Format | PNG or JPG |
| Dimensions | **1280 × 640 px** (2:1 ratio) |
| Max file size | 1 MB |
| Color space | sRGB |
| Safe zone | Keep critical text within central 1100 × 540 px (some clients crop edges) |

## What to put on it

Mirror the `docs/banner.svg` design (already in this repo) but exported as PNG at 1280×640. Note: `docs/banner.svg` itself still says "17 generators" and "v0.1" — update those labels before exporting. Specifically:

- **Brand mark**: 80×80 saffron `#ffb020` square with italic serif "A" in `#08080a`
- **Wordmark**: "OpenAdKit" in Instrument Serif / Georgia italic, ~84 px, color `#e7e7ea`
- **Tagline (one line)**: "Open source AI marketing tool · every ad platform · BYOK · zero subscriptions" — `#e7e7ea`, 22 px, semibold
- **Feature row**: `● 18 generators · ● 11 optimizers · ● 9 AI providers · ● Windows · macOS · Linux · ● MIT · ● $0/month`
- **Bottom credit**: small mono caps — "BUILT BY DICECODES · DICECODES.COM"
- **Background**: near-black gradient (`#08080a → #101013`) with a subtle saffron radial glow at top-left and a faint grid pattern
- **Right third**: simplified ad-mockup card (saffron top stripe, gray placeholder rectangles, faux CTA button) — same as the banner SVG

## How to generate it

### Option A — quick (no design tool)
Open `docs/banner.svg` in your browser at 1280×320, screenshot the canvas, **double the height padding** to reach 640px (add empty space top + bottom of the existing layout). Save as PNG.

### Option B — from SVG (clean)
1. Open `docs/banner.svg` in Figma, Inkscape, or Affinity Designer
2. Change the viewBox to `0 0 1280 640`
3. Re-center the existing content vertically
4. Add 320 px of vertical breathing room (the banner is currently a wide horizontal strip; for the social card it needs to be a square-ish rectangle)
5. Export as PNG @ 2x for crispness

### Option C — quickest (drop-in tool)
Use [opengraph.dev](https://opengraph.dev) or [bannerbear.com](https://bannerbear.com) with the values above. Both have free tiers.

## How to upload to GitHub

1. Go to: <https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/settings>
2. Scroll to **Social preview**
3. Click **Edit** → drag the PNG in
4. Save

Verify by pasting `https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool` into <https://www.opengraph.xyz> after upload — you should see your custom card, not the GitHub default.

## When to refresh

- After any major release (e.g. v2.0.0)
- After significant feature additions worth front-page billing
- After branding changes
