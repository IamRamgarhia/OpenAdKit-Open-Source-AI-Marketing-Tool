/**
 * Real-user scenarios against the full local stack: the production web app
 * AND the local-sync sidecar, exactly as the launchers/installers run them.
 * No AI calls — every step is something a user does by hand.
 *
 * Run (the sidecar starts the web app itself):
 *   (start from an empty snapshot.json in <tmp> so legacy-data migration has nothing to copy)
 *   OPENADKIT_SYNC_PORT=47801 PORT=47800 OPENADKIT_DATA_DIR=<tmp> OPENADKIT_NO_BROWSER=1 node scripts/local-sync.cjs
 *   BASE_URL=http://127.0.0.1:47800 SIDECAR_URL=http://127.0.0.1:47801 npx playwright test tests/scenarios.spec.ts
 *
 * Skipped unless SIDECAR_URL is set.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:47800";
const SIDECAR_URL = process.env.SIDECAR_URL ?? "";

test.skip(!SIDECAR_URL, "needs the local-sync sidecar (set SIDECAR_URL)");
test.describe.configure({ mode: "serial" });

const BUSINESS = `Sunrise Dental Clinic ${Date.now().toString(36)}`;

async function freshContext(browser: import("@playwright/test").Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      if (!localStorage.getItem("__seeded")) {
        localStorage.setItem("ados.active_provider", "groq");
        localStorage.setItem("ados.provider.groq.key", "gsk_test_AbCdEfGhIjKlMnOpQrStUv123456");
        localStorage.setItem("ados.tour_seen", "1");
        localStorage.setItem("__seeded", "1");
      }
    } catch {
      /* about:blank */
    }
  });
  return context;
}

async function snapshotBrains(): Promise<{ business_name?: string; deleted_at?: number }[]> {
  const res = await fetch(`${SIDECAR_URL}/snapshot`, { cache: "no-store" });
  if (!res.ok) return [];
  const snap = await res.json().catch(() => null);
  return (snap?.brains ?? []) as { business_name?: string; deleted_at?: number }[];
}

async function brandCard(page: Page) {
  await page.goto(`${BASE_URL}/brand`, { waitUntil: "networkidle" });
  return page.getByText(BUSINESS, { exact: false }).first();
}

test("freelancer adds a client by hand and it is saved to disk by the sidecar", async ({ browser }) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/brand/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /open the manual form/i }).click();
  await page.getByLabel(/^Business name/).fill(BUSINESS);
  await page.getByLabel(/^Industry/).fill("Healthcare / dental");
  // Only the business name is required; the rest can be filled later.
  await page.getByRole("button", { name: /save brand brain/i }).click();
  await page.waitForURL(/\/brand$/);
  await expect(page.getByText(BUSINESS).first()).toBeVisible();

  // The app debounce-pushes to the sidecar; the snapshot on disk must have it.
  await expect
    .poll(async () => (await snapshotBrains()).some((b) => b.business_name === BUSINESS && !b.deleted_at), {
      timeout: 20_000,
    })
    .toBe(true);
  await context.close();
});

test("a fresh browser profile (new machine / cleared cache) gets the client back from the sidecar", async ({ browser }) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  // First load pulls the snapshot into the empty IndexedDB.
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await expect.poll(async () => (await brandCard(page)).isVisible(), { timeout: 20_000 }).toBe(true);
  await context.close();
});

test("deleting the client in one browser stays deleted everywhere (no resurrection)", async ({ browser }) => {
  const a = await freshContext(browser);
  const pageA = await a.newPage();
  await pageA.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const card = await brandCard(pageA);
  await expect.poll(async () => card.isVisible(), { timeout: 20_000 }).toBe(true);
  pageA.on("dialog", (d) => d.accept());
  const row = pageA.locator("div", { has: pageA.getByText(BUSINESS) }).filter({ has: pageA.getByTitle(/delete/i) }).last();
  await row.getByTitle(/delete/i).click();
  await expect(pageA.getByText(BUSINESS)).toHaveCount(0, { timeout: 10_000 });

  await expect
    .poll(async () => (await snapshotBrains()).some((b) => b.business_name === BUSINESS && !b.deleted_at), {
      timeout: 20_000,
    })
    .toBe(false);
  await a.close();

  const b = await freshContext(browser);
  const pageB = await b.newPage();
  await pageB.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await pageB.goto(`${BASE_URL}/brand`, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(2000);
  await expect(pageB.getByText(BUSINESS)).toHaveCount(0);
  await b.close();
});

test("API keys are never written to the sync file", async () => {
  const res = await fetch(`${SIDECAR_URL}/snapshot`, { cache: "no-store" });
  const body = await res.text();
  expect(body).not.toContain("gsk_test_AbCdEfGhIjKlMnOpQrStUv123456");
  expect(body).not.toMatch(/ados\.provider\.[a-z]+\.key/);
});
