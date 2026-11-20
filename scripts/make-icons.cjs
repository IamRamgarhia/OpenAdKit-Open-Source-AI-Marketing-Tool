#!/usr/bin/env node
/**
 * Render the app icon (public/icon.svg) into the raster formats the desktop
 * installers need. Dev-time tool: outputs are committed, so builds and CI
 * never need a browser for this.
 *
 *   node scripts/make-icons.cjs
 *
 * Writes:
 *   installer/art/icon.ico      Windows exe + installer icon (16–256 px, PNG-in-ICO)
 *   installer/art/icon-512.png  macOS .app icon source (converted to .icns on
 *                               the Mac by the installer with sips/iconutil)
 *   installer/art/icon-256.png  Linux .desktop icon
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "installer", "art");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Build an ICO file whose images are stored as PNGs (supported since Vista). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); // palette
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

async function main() {
  const { chromium } = require("@playwright/test");
  const svg = fs.readFileSync(path.join(ROOT, "public", "icon.svg"), "utf8");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const render = async (size) => {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`,
      );
      return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    };
    const pngs = [];
    for (const size of SIZES) pngs.push({ size, data: await render(size) });
    fs.writeFileSync(path.join(OUT, "icon.ico"), buildIco(pngs));
    fs.writeFileSync(path.join(OUT, "icon-256.png"), pngs.find((p) => p.size === 256).data);
    fs.writeFileSync(path.join(OUT, "icon-512.png"), await render(512));
    console.log(`[make-icons] wrote ${path.relative(ROOT, OUT)}/icon.ico, icon-256.png, icon-512.png`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("[make-icons] failed:", e);
  process.exit(1);
});
