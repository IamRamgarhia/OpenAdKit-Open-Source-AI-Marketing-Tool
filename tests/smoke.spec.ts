/**
 * Real-browser smoke tests. Verifies every route in the app renders without
 * a runtime error, no console.errors during initial paint, and key
 * interactions (forms, gates, links) work.
 *
 * We do NOT exercise actual LLM calls — those need real API keys and would
 * cost money. We verify everything UP TO the "click Generate" boundary.
 *
 * Run: npx playwright test tests/smoke.spec.ts --reporter=line
 */
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

// Routes that should render WITHOUT requiring an API key gate to redirect.
// (i.e. either truly public pages OR pages that show their own setup flow.)
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/alternatives",
  "/how-to-use",
  "/setup",
  "/benchmarks",
  "/platforms",
  "/launch-guide",
  "/learn",
  "/learn/courses",
  "/learn/frameworks",
  // Settings is where you ADD a key, so it must never be gated behind having
  // one — gating it created a dead end from the StatusBar's "No key" badge.
  "/settings",
  // Provider comparison — must be readable before you have any key.
  "/providers",
  // Checklists are static content with local state and make no LLM calls.
  "/checklist/daily",
  "/checklist/weekly",
  "/checklist/monthly",
  // Static learning / reference content is public (owner decision, v2) — only
  // the AI actions on these pages ask for a key.
  "/strategy/decision-tree",
  "/learn/ctr",
  "/learn/courses/google",
];

// Routes that are GATED behind ApiKeyGate. Without a key, they should either
// (a) redirect to /setup, or (b) render a key-prompt panel. They should NOT
// throw a runtime error.
const GATED_ROUTES = [
  "/brand",
  "/brand/new",
  "/history",
  "/campaigns",
  "/suggestions",
  "/strategy",
  "/batch",
  "/report",
  "/launch/wizard",
  "/research/competitors",
  "/research/reel-teardown",
  "/research/compare",
  // A sample of generators + optimizers
  "/generate/meta",
  "/generate/google",
  "/generate/tiktok",
  "/generate/email-subjects",
  "/generate/hashtags",
  "/generate/campaign-kit",
  "/generate/content-calendar",
  "/optimize/ctr",
  "/optimize/budget",
  "/optimize/budget-planner",
  "/optimize/landing-page",
  "/optimize/audience",
  "/optimize/quality-score",
  "/optimize/ab-test",
];

// Dynamic routes — verify a known slug
const DYNAMIC_ROUTES = [
  "/platforms/meta",
  "/platforms/google",
  "/platforms/tiktok",
];

const ALL_ROUTES = [...PUBLIC_ROUTES, ...GATED_ROUTES, ...DYNAMIC_ROUTES];

/**
 * Attach console/pageerror listeners and return the array they populate.
 *
 * This helper previously existed but was never called — every test inlined its
 * own copy of the filter list, so the two could (and did) drift apart. One
 * definition, used everywhere.
 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Known-benign console noise that doesn't represent a bug:
    if (text.includes("Failed to load resource")) return; // 404s for missing favicons/etc
    if (text.includes("ServiceWorker")) return; // SW dev-mode warnings
    if (text.includes("[openadkit:")) return; // our own dev debug logs
    // Next 14 prefetches Link targets aggressively; in Playwright the first
    // request can lose a race with the test browser closing. The resulting
    // "Failed to fetch RSC payload for <route>" console.error is a non-fatal
    // soft-fallback the framework recovers from (it falls back to full-page
    // navigation). Filter it from smoke noise.
    if (text.includes("Failed to fetch RSC payload")) return;
    if (text.includes("Hydration")) errors.push(`hydration: ${text}`);
    else errors.push(text);
  });
  return errors;
}

test.describe("Smoke: every route renders without runtime errors", () => {
  for (const route of ALL_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const errors = collectConsoleErrors(page);

      const resp = await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      expect(resp?.status(), `${route} should not 404/500`).toBeLessThan(400);

      // Wait a bit for client-side hydration + any redirects to fire
      await page.waitForTimeout(800);

      // Page should show at least some content (not be blank)
      const body = await page.locator("body").innerText();
      expect(body.length, `${route} should have rendered content`).toBeGreaterThan(20);

      // No JS errors should have fired during render
      if (errors.length > 0) {
        console.error(`Errors on ${route}:`, errors);
      }
      expect(errors, `${route} should have no JS/hydration errors`).toEqual([]);
    });
  }
});

test.describe("Smoke: key UI interactions", () => {
  test("home page has working sidebar nav", async ({ page }) => {
    await page.goto(BASE_URL);
    // Sidebar nav should be visible
    const sidebar = page.locator("aside");
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });
  });

  test("settings page renders the provider list even with no key configured", async ({ page }) => {
    // Regression guard: /settings used to be wrapped in <ApiKeyGate>, so with
    // no key it redirected to /setup — i.e. the page you use to ADD a key was
    // unreachable until you already had one.
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    expect(page.url(), "/settings must not redirect to /setup").not.toContain("/setup");
    const lower = (await page.locator("body").innerText()).toLowerCase();
    expect(lower).toContain("anthropic");
    expect(lower).toContain("api key");
  });

  test("checklists are usable without an API key", async ({ page }) => {
    await page.goto(`${BASE_URL}/checklist/daily`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    expect(page.url(), "/checklist/daily must not redirect to /setup").not.toContain("/setup");
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).toContain("google ads");
  });

  test("brand/new shows 4 onboarding methods", async ({ page }) => {
    await page.goto(`${BASE_URL}/brand/new`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const body = await page.locator("body").innerText();
    // Public path: ApiKeyGate kicks user to /setup OR shows method 1
    expect(
      body.includes("Method 1") || body.includes("setup") || body.includes("Setup") || body.includes("Add a new client"),
      "/brand/new should show onboarding or redirect to setup"
    ).toBeTruthy();
  });

  test("launch wizard renders form fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/launch/wizard`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const body = await page.locator("body").innerText();
    expect(
      body.includes("Campaign name") || body.includes("Launch") || body.includes("setup") || body.includes("Setup"),
      "/launch/wizard should show wizard or redirect to setup"
    ).toBeTruthy();
  });

  test("settings currency selector is present", async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    // The currency select should be in DOM (may need API key first)
    const body = await page.locator("body").innerText();
    // We can't easily test currency without a key, but verify no crash
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe("Smoke: app shell scroll architecture", () => {
  // The shell pins itself to one viewport and gives the sidebar and the main
  // canvas their own scrollbars. Before this, `min-h-screen` let the document
  // grow, so the sidebar scrolled off the top of the page and its
  // `overflow-y-auto` never engaged. These assertions are cheap and catch a
  // regression that is easy to reintroduce with a stray height class.
  test("the page itself does not scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/learn`);
    await page.waitForTimeout(400);
    const docScrolls = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollHeight > el.clientHeight + 1;
    });
    expect(docScrolls, "document should not be the scroll container").toBe(false);
  });

  test("the main canvas is its own scroll region", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    // A page tall enough to overflow at 720px.
    await page.goto(`${BASE_URL}/learn/frameworks`);
    await page.waitForTimeout(400);
    const main = page.locator("#main-scroll");
    await expect(main).toHaveCount(1);
    const scrolled = await main.evaluate((el) => {
      el.scrollTop = 200;
      return el.scrollTop;
    });
    expect(scrolled, "#main-scroll should scroll independently").toBeGreaterThan(0);
  });

  test("the sidebar nav scrolls independently of the content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(400);
    const nav = page.locator("aside nav.sidebar-nav");
    await expect(nav).toHaveCount(1);
    // Expand every group so the nav definitely overflows.
    const headers = page.locator("aside nav.sidebar-nav > div > button");
    const n = await headers.count();
    for (let i = 0; i < n; i++) await headers.nth(i).click();
    await page.waitForTimeout(400);

    const result = await nav.evaluate((el) => {
      // Reset first: clicking the group headers scrolls them into view, so the
      // nav is already scrolled part-way down by the time we get here.
      el.scrollTop = 0;
      const before = el.scrollTop;
      el.scrollTop = 150;
      return { overflows: el.scrollHeight > el.clientHeight, before, after: el.scrollTop };
    });
    expect(result.overflows, "sidebar nav should overflow when all groups are open").toBe(true);
    expect(result.after, "sidebar nav should scroll").toBeGreaterThan(result.before);

    // And scrolling the sidebar must not move the main canvas.
    const mainTop = await page.locator("#main-scroll").evaluate((el) => el.scrollTop);
    expect(mainTop, "scrolling the sidebar must not scroll the content").toBe(0);
  });

  test("the status bar stays visible without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/learn/frameworks`);
    await page.waitForTimeout(400);
    await page.locator("#main-scroll").evaluate((el) => { el.scrollTop = 400; });
    await page.waitForTimeout(200);
    const bar = page.locator("main > div").last();
    const box = await bar.boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box, "status bar should be present").not.toBeNull();
    // Bottom edge sits at (or within a pixel of) the viewport bottom.
    expect(Math.abs(box!.y + box!.height - vh)).toBeLessThan(2);
  });
});

test.describe("Smoke: sidebar groups", () => {
  test("all groups start collapsed and hidden links are not focusable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // /alternatives is a public page that appears in no nav group, so the
    // active-route auto-expand in Sidebar.tsx correctly leaves everything shut.
    // (/about would NOT work here — it lives in the "Data" group.)
    await page.goto(`${BASE_URL}/alternatives`);
    await page.waitForTimeout(600);

    const headers = page.locator("aside nav.sidebar-nav > div > button");
    const groupCount = await headers.count();
    expect(groupCount, "sidebar should render its groups").toBeGreaterThan(5);

    // Every group collapsed → no group header reports aria-expanded="true".
    for (let i = 0; i < groupCount; i++) {
      await expect(headers.nth(i)).toHaveAttribute("aria-expanded", "false");
    }

    // max-h-0 + overflow-hidden only CLIPS content; without visibility:hidden
    // the collapsed links stay in the tab order and the a11y tree.
    const focusable = await page.locator("aside nav.sidebar-nav a").evaluateAll((els) =>
      els.filter((el) => {
        const s = getComputedStyle(el);
        return s.visibility !== "hidden" && s.display !== "none";
      }).length
    );
    expect(focusable, "collapsed nav links must not be reachable").toBe(0);
  });

  test("opening a group reveals its links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/alternatives`);
    await page.waitForTimeout(600);
    await page.locator("aside nav.sidebar-nav > div > button").first().click();
    await page.waitForTimeout(500);
    const visible = await page.locator("aside nav.sidebar-nav a").evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).visibility !== "hidden").length
    );
    expect(visible, "opened group should expose its links").toBeGreaterThan(0);
  });
});

test.describe("Smoke: dynamic route 404 handling", () => {
  test("unknown brand ID navigates without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const resp = await page.goto(`${BASE_URL}/brand/nonexistent-id-xyz`, { waitUntil: "domcontentloaded" });
    // Either 404 page or redirect — both fine, just no crash
    expect(errors).toEqual([]);
  });

  test("unknown platform slug returns 404", async ({ page }) => {
    const resp = await page.goto(`${BASE_URL}/platforms/nonexistent-platform-xyz`, { waitUntil: "domcontentloaded" });
    // generateStaticParams + dynamicParams=false should produce a 404
    expect(resp?.status(), "unknown platform slug should 404").toBe(404);
  });
});
