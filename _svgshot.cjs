const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  for (const [f, o] of [["docs/architecture.svg", "arch.png"], ["docs/banner.svg", "banner.png"]]) {
    await p.goto("file:///" + require("path").resolve(f).replace(/\/g, "/"));
    await p.screenshot({ path: process.argv[2] + "/" + o, fullPage: true });
  }
  await b.close();
})();
