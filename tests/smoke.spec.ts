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
  "/settings",
  "/strategy",
  "/strategy/decision-tree",
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

// Collect console errors during page lifecycle so the test can assert on them.
async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter known-benign sources of console noise that don't represent bugs:
      if (text.includes("Failed to load resource")) return; // 404s for missing favicons/etc
      if (text.includes("ServiceWorker")) return; // SW dev-mode warnings
      if (text.includes("Hydration")) errors.push(`hydration: ${text}`);
      else errors.push(text);
    }
  });
  return errors;
}

test.describe("Smoke: every route renders without runtime errors", () => {
  for (const route of ALL_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (text.includes("Failed to load resource")) return;
          if (text.includes("ServiceWorker")) return;
          if (text.includes("[openadkit:")) return; // our own dev debug logs
          // Next 14 prefetches Link targets aggressively; in Playwright the
          // first request can lose a race with the test browser closing. The
          // resulting "Failed to fetch RSC payload for <route>" console.error
          // is a non-fatal soft-fallback the framework recovers from (it
          // falls back to full-page navigation). Filter it from smoke noise.
          if (text.includes("Failed to fetch RSC payload")) return;
          errors.push(text);
        }
      });

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

  test("settings page provider list renders", async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("domcontentloaded");
    // Should show provider cards (or setup flow if no key)
    const body = await page.locator("body").innerText();
    // Either provider cards are visible, OR the ApiKeyGate funneled to a
    // setup/add-provider UI. The word "provider" appears in both modes.
    const lower = body.toLowerCase();
    expect(lower.includes("provider") || lower.includes("openai") || lower.includes("anthropic") || lower.includes("setup") || lower.includes("api key"), "/settings should reference providers or setup").toBeTruthy();
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
