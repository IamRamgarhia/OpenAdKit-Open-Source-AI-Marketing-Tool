#!/usr/bin/env node
/**
 * Renders public/og-image.svg → public/og-image.png at 1200×630.
 *
 * Why this exists: Facebook/Open Graph rejects SVG OG images. Twitter and
 * LinkedIn accept SVG, but for max compatibility we ship both — SVG for
 * crisp resolution-independent rendering, PNG for OG consumers that need
 * raster. Run via `node scripts/render-og.cjs` whenever og-image.svg
 * changes (`npm run og:render`). Not part of `npm run build`: it needs a
 * headless browser, which end-user installs and Docker images do not have.
 *
 * Uses Playwright (already a dev-dep for smoke tests) so no extra dependency.
 */
const path = require("path");
const fs = require("fs");

async function main() {
  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch {
    console.warn("[render-og] @playwright/test not installed — skipping. Install + rerun: npm i -D @playwright/test");
    return;
  }
  const svgPath = path.join(__dirname, "..", "public", "og-image.svg");
  const pngPath = path.join(__dirname, "..", "public", "og-image.png");
  if (!fs.existsSync(svgPath)) {
    console.warn(`[render-og] missing ${svgPath} — skipping`);
    return;
  }
  const svg = fs.readFileSync(svgPath, "utf8");
  // Inline the SVG into a 1200×630 HTML viewport so the rendered raster
  // matches the source exactly (no DOM scaling, no font fallback drift).
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#0a0a0c}
    svg{display:block;width:1200px;height:630px}
  </style></head><body>${svg}</body></html>`;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // Wait a beat for fallback fonts to settle (display=swap would otherwise
    // race with screenshot timing in CI).
    await page.waitForTimeout(200);
    await page.screenshot({
      path: pngPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 630 },
      omitBackground: false,
    });
    console.log(`[render-og] wrote ${pngPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  // Non-fatal — build still succeeds without the PNG. SVG fallback in metadata
  // covers most consumers; Facebook just falls back to its own image scrape.
  console.warn(`[render-og] failed (non-fatal): ${e?.message ?? e}`);
  process.exit(0);
});
