/**
 * UI wiring regressions (v2 phase 2).
 *
 * Every flow here runs against a production build with NO real AI calls:
 * where a flow needs generated output we seed IndexedDB / localStorage with a
 * realistic saved record — exactly what the app itself writes after a real
 * generation — instead of faking a model response.
 *
 * Run: BASE_URL=http://127.0.0.1:3061 npx playwright test tests/wiring.spec.ts
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import fs from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

const PROVIDER_HOSTS = [
  "anthropic.com",
  "openai.com",
  "generativelanguage.googleapis.com",
  "groq.com",
  "cerebras.ai",
  "together.xyz",
  "deepseek.com",
  "mistral.ai",
  "openrouter.ai",
];

const BRAND = {
  id: "brand-test-1",
  name: "Leaf & Co",
  business_name: "Leaf & Co Tea",
  website_url: "https://leafco.example",
  industry: "ecommerce",
  usp: "Single-origin loose-leaf tea shipped within 48h of harvest",
  audience_who: "Specialty tea drinkers in the US",
  tone: "warm, expert, no hype",
  content_pillars: ["Origin stories", "Brewing guides"],
  created_at: 1_760_000_000_000,
  updated_at: 1_760_000_000_000,
};

function metaAd(overrides: Record<string, unknown> = {}) {
  return {
    id: "ad-meta-1",
    brand_id: BRAND.id,
    platform: "meta",
    campaign_type: "Feed",
    title: "Meta · Harvest-fresh sampler",
    input: { product: "Harvest sampler", offer: "15% off first order" },
    output_json: {
      variants: [
        {
          angle: "freshness",
          primary_text: "Picked in May, in your cup by June. Taste tea the week it was harvested.",
          headline: "Harvest-fresh tea, shipped in 48h",
          cta: "Shop the sampler",
        },
      ],
    },
    output_text:
      '{"variants":[{"angle":"freshness","primary_text":"Picked in May, in your cup by June. Taste tea the week it was harvested.","headline":"Harvest-fresh tea, shipped in 48h","cta":"Shop the sampler"}]}',
    model_id: "llama-3.3-70b-versatile",
    provider_id: "groq",
    usage_input_tokens: 1840,
    usage_output_tokens: 412,
    cost_usd: 0.0013,
    starred: false,
    status: "draft",
    notes: "",
    created_at: 1_763_000_000_000,
    prompt: "Write 3 Meta feed ad variants for Leaf & Co's harvest sampler…",
    ...overrides,
  };
}

/** Seed a plausible provider key BEFORE any script runs. No "onboarded" flag
 *  on purpose: having a key is the onboarding signal now. */
async function withKey(context: BrowserContext, opts: { activeBrand?: string } = {}) {
  await context.addInitScript((brand) => {
    try {
      if (!localStorage.getItem("__seeded")) {
        localStorage.setItem("ados.active_provider", "groq");
        localStorage.setItem("ados.provider.groq.key", "gsk_test_AbCdEfGhIjKlMnOpQrStUv123456");
        localStorage.setItem("ados.tour_seen", "1");
        if (brand) localStorage.setItem("ados.active_brain", brand);
        localStorage.setItem("__seeded", "1");
      }
    } catch {
      /* about:blank */
    }
  }, opts.activeBrand ?? "");
}

/** Write rows straight into the app's Dexie database ("ados"). The DB must
 *  already exist, so visit an app page first. */
async function seedDb(page: Page, stores: Record<string, unknown[]>) {
  await page.evaluate(async (stores) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const r = indexedDB.open("ados");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    for (const [name, rows] of Object.entries(stores)) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(name, "readwrite");
        const st = tx.objectStore(name);
        for (const row of rows) st.put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  }, stores);
}

/** Open an app page so Dexie creates the DB, then seed and reload. */
async function bootAndSeed(page: Page, stores: Record<string, unknown[]>, path = "/history") {
  await page.goto(`${BASE_URL}${path}`);
  // Wait until Dexie has created the DB AND finished its upgrade (the version
  // shows up in databases() before the object stores exist). Never open the
  // DB before it exists — that would create an empty v1 database.
  // Poll inside the page (waitForFunction treats a returned Promise as
  // truthy). Never open the DB before Dexie has created it — that would make
  // an empty v1 database — and wait for its upgrade to finish (the version
  // shows up in databases() before the object stores exist).
  const ready = await page.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      const dbs = (await (indexedDB as any).databases?.()) ?? [];
      if (dbs.some((d: any) => d.name === "ados")) {
        const db: IDBDatabase = await new Promise((resolve, reject) => {
          const r = indexedDB.open("ados");
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        const ok = db.objectStoreNames.contains("ads") && db.objectStoreNames.contains("campaigns");
        db.close();
        if (ok) return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  });
  expect(ready, "app should have created its IndexedDB").toBe(true);
  await seedDb(page, stores);
}

test.describe("Public pages + landing", () => {
  test("/ renders a landing page without a key (no redirect)", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("open-source AI marketing tool");
    await expect(page.locator('main a[href="/setup"]').first()).toBeVisible();
    for (const href of ["/learn", "/benchmarks", "/platforms", "/providers"]) {
      await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
    }
  });

  test("landing HTML is server-rendered (crawlable)", async ({ request }) => {
    const html = await (await request.get(`${BASE_URL}/`)).text();
    expect(html).toContain("Get started");
  });

  const PUBLIC = [
    ["/benchmarks", /Benchmarks/],
    ["/learn", /Learn Paid Ads/],
    ["/learn/courses", /Courses/],
    ["/learn/frameworks", /Ad Copy School/],
    ["/platforms", /Ad Platform/],
    ["/platforms/meta", /Meta/],
    ["/learn/ctr", /CTR/],
    ["/learn/courses/google", /Google Ads/],
    ["/strategy/decision-tree", /Decision Tree/],
    ["/providers", /Which AI/],
  ] as const;

  for (const [route, title] of PUBLIC) {
    test(`${route} is public and has its own title`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForTimeout(800);
      expect(page.url(), `${route} must not bounce to /setup`).not.toContain("/setup");
      await expect(page).toHaveTitle(title);
      expect((await page.locator("main").innerText()).length).toBeGreaterThan(100);
    });
  }

  test("a course lesson is public", async ({ page }) => {
    await page.goto(`${BASE_URL}/learn/courses/google`);
    const first = page.locator('main a[href^="/learn/courses/google/"]').first();
    const href = await first.getAttribute("href");
    await page.goto(`${BASE_URL}${href}`);
    await page.waitForTimeout(600);
    expect(page.url()).not.toContain("/setup");
  });

  test("AI actions on public pages ask for a key instead of gating the page", async ({ page }) => {
    for (const route of ["/learn/frameworks", "/learn/ctr"]) {
      await page.goto(`${BASE_URL}${route}`);
      await expect(page.getByTestId("require-key")).toBeVisible();
      await expect(page.locator('[data-testid="require-key"] a')).toHaveAttribute("href", `/setup?next=${encodeURIComponent(route)}`);
    }
  });

  test("robots.txt repeats Disallow lines inside every AI-crawler group", async ({ request }) => {
    const txt = await (await request.get(`${BASE_URL}/robots.txt`)).text();
    // Field names are case-insensitive (Next writes "User-Agent").
    const groups = txt.split(/\n(?=User-agent:)/i).filter((g) => /^User-agent:/i.test(g));
    expect(groups.length).toBeGreaterThan(5);
    for (const g of groups) {
      expect(g, g.split("\n")[0]).toContain("Disallow: /generate/");
      expect(g, g.split("\n")[0]).toContain("Disallow: /settings");
    }
  });

  test("sitemap lists /providers and /alternatives", async ({ request }) => {
    const xml = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
    expect(xml).toMatch(/\/providers<\/loc>/);
    expect(xml).toMatch(/\/alternatives<\/loc>/);
  });

  test("manifest ships PNG + maskable icons", async ({ request }) => {
    const m = await (await request.get(`${BASE_URL}/manifest.webmanifest`)).json();
    const icons = m.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.some((i) => i.sizes === "192x192" && i.src.endsWith(".png"))).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    for (const i of icons) expect((await request.get(`${BASE_URL}${i.src}`)).status()).toBe(200);
  });
});

test.describe("Onboarding + dashboard", () => {
  test("any stored key counts as onboarded: / shows the dashboard", async ({ page, context }) => {
    await withKey(context);
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByText("Recent generations")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("returning users with a key never see the landing page flash", async ({ page, context }) => {
    await withKey(context);
    // Record whether the landing page was ever visible from the first paint on.
    await context.addInitScript(() => {
      (window as unknown as { __landingSeen: boolean }).__landingSeen = false;
      const check = () => {
        const el = document.querySelector(".oak-landing");
        if (el && getComputedStyle(el).visibility !== "hidden") {
          (window as unknown as { __landingSeen: boolean }).__landingSeen = true;
        }
      };
      new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true });
      document.addEventListener("DOMContentLoaded", check);
    });
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByText("Recent generations")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __landingSeen: boolean }).__landingSeen)).toBe(false);
  });

  test("new visitors (no key) see the landing page", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator(".oak-landing")).toBeVisible();
  });

  test("dashboard 'recent' links use /history?focus= and expand the row", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    await bootAndSeed(page, { brains: [BRAND], ads: [metaAd()] });
    await page.goto(`${BASE_URL}/`);
    const link = page.locator(`main a[href="/history?focus=ad-meta-1"]`);
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/history\?focus=ad-meta-1/);
    await expect(page.locator("#ad-meta-1 pre")).toContainText("Harvest-fresh tea");
  });
});

test.describe("History + campaigns", () => {
  test("add a saved ad to a new campaign, then Print/PDF opens", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    await bootAndSeed(page, { brains: [BRAND], ads: [metaAd()] });
    await page.goto(`${BASE_URL}/history?focus=ad-meta-1`);
    page.once("dialog", (d) => d.accept("Spring launch"));
    await page.locator("#ad-meta-1").getByTestId("campaign-picker").selectOption("__new__");
    await expect(page.locator("#ad-meta-1").getByRole("status")).toContainText("Added");

    await page.goto(`${BASE_URL}/campaigns`);
    await expect(page.getByText("Spring launch")).toBeVisible();
    await expect(page.getByRole("link", { name: "Meta · Harvest-fresh sampler" })).toBeVisible();

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.locator('button[title^="Open print-friendly view"]').click(),
    ]);
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator("h1")).toHaveText("Spring launch");
    await expect(popup.locator("body")).toContainText("Harvest-fresh tea, shipped in 48h");
    expect(await popup.evaluate(() => window.opener)).toBeNull();
  });

  test("campaigns: 'Add to a campaign' next step (?add=) and add-from-history both assign", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    const camp = { id: "camp-1", brand_id: BRAND.id, name: "Q3 tea push", goal: "", status: "planning", created_at: 1_763_000_000_000 };
    await bootAndSeed(page, {
      brains: [BRAND],
      campaigns: [camp],
      ads: [metaAd(), metaAd({ id: "ad-meta-2", title: "Meta · Gift box", created_at: 1_763_000_100_000 })],
    });
    await page.goto(`${BASE_URL}/campaigns?add=ad-meta-1`);
    const banner = page.getByTestId("pending-add");
    await expect(banner).toContainText("Meta · Harvest-fresh sampler");
    await banner.getByRole("button", { name: "Q3 tea push" }).click();
    await expect(page.getByText('Added "Meta · Harvest-fresh sampler" to Q3 tea push.')).toBeVisible();

    await page.getByRole("button", { name: "add from history" }).click();
    await page.getByTestId("add-from-history").getByRole("button", { name: "Add Meta · Gift box" }).click();
    await expect(page.getByRole("list", { name: "Ads in Q3 tea push" }).getByRole("listitem")).toHaveCount(2);
  });

  test("CSV export includes output_text, neutralises formulas, uses openadkit-* name", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    await bootAndSeed(page, { brains: [BRAND], ads: [metaAd({ title: '=HYPERLINK("http://x","y")' })] });
    await page.goto(`${BASE_URL}/history`);
    await page.locator("summary", { hasText: "export" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "csv" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^openadkit-history-\d+\.csv$/);
    const csv = fs.readFileSync((await download.path())!, "utf8");
    expect(csv.split("\r\n")[0]).toContain('"output_text"');
    expect(csv).toContain("Harvest-fresh tea, shipped in 48h");
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  test("regenerate warns that an image-based run can't resend its image", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    await bootAndSeed(page, { brains: [BRAND], ads: [metaAd({ has_image: true, max_tokens: 3500 })] });
    await page.goto(`${BASE_URL}/history`);
    await page.locator('#ad-meta-1 button[title^="Re-run this prompt"]').click();
    await expect(page.getByTestId("regen-image-warning")).toBeVisible();
  });
});

test.describe("Generators", () => {
  test("?ad_id= hydrates the form from the saved ad's inputs", async ({ page, context }) => {
    await withKey(context);
    const hashtagAd = metaAd({
      id: "ad-hash-1",
      platform: "tiktok",
      campaign_type: "Hashtags",
      title: "Hashtags · tiktok · Vegan recipes",
      input: { title: "Vegan recipes for beginners", platform: "tiktok", language: "Spanish", context: "" },
    });
    await bootAndSeed(page, { ads: [hashtagAd] });
    await page.goto(`${BASE_URL}/generate/hashtags?ad_id=ad-hash-1`);
    await expect(page.locator("#field-title")).toHaveValue("Vegan recipes for beginners");
    await expect(page.locator("#field-platform")).toHaveValue("tiktok");
    await expect(page.locator("#field-language")).toHaveValue("Spanish");
  });

  test("/suggestions shows the latest saved run and makes no LLM call on visit", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    const llmCalls: string[] = [];
    page.on("request", (r) => {
      if (PROVIDER_HOSTS.some((h) => new URL(r.url()).hostname.includes(h))) llmCalls.push(r.url());
    });
    const saved = metaAd({
      id: "ad-sugg-1",
      platform: "google",
      campaign_type: "Suggested Campaigns",
      title: "Suggestions · Leaf & Co",
      input: {},
      output_json: {
        campaigns: [
          {
            platform: "Meta",
            objective: "Sales",
            monthly_budget_usd: 1500,
            name: "Harvest-week sampler",
            why_this_brand: "Freshness is the brand's provable edge.",
            target_audience: "Specialty tea buyers 28-55",
            kpi_targets: { cpa: "under $25" },
            hooks: ["Tea picked last month, not last year"],
            adOS_workflow: [{ step: "Write the ads", url: "/generate/meta" }],
          },
        ],
      },
    });
    await bootAndSeed(page, { brains: [BRAND], ads: [saved] });
    await page.goto(`${BASE_URL}/suggestions`);
    await expect(page.getByTestId("suggestions-saved-at")).toBeVisible();
    await expect(page.getByText("Harvest-week sampler")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(llmCalls, "visiting /suggestions must not call a provider").toEqual([]);
  });

  test("A/B planner asks for baseline / MDE / traffic instead of letting the model guess", async ({ page, context }) => {
    await withKey(context);
    await page.goto(`${BASE_URL}/optimize/ab-test`);
    await expect(page.locator("#field-baseline_rate_pct")).toBeVisible();
    await expect(page.locator("#field-mde_pct")).toBeVisible();
    await expect(page.locator("#field-daily_visitors_per_variant")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("sidebar active state uses a segment boundary", async ({ page, context }) => {
    await withKey(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/generate/google-pmax`);
    await page.waitForTimeout(600);
    await expect(page.locator('aside a[href="/generate/google-pmax"]').first()).toHaveAttribute("aria-current", "page");
    for (const a of await page.locator('aside a[href="/generate/google"]').all()) {
      await expect(a).not.toHaveAttribute("aria-current", "page");
    }
  });

  test("duplicate entries: only the one whose ?platform= matches is active", async ({ page, context }) => {
    await withKey(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/generate/hashtags?platform=tiktok`);
    await page.waitForTimeout(600);
    const active = page.locator('aside a[aria-current="page"]');
    await expect(active.first()).toHaveAttribute("href", "/generate/hashtags?platform=tiktok");
    for (const a of await active.all()) await expect(a).toHaveAttribute("href", "/generate/hashtags?platform=tiktok");
  });

  test("mobile nav keeps the platform pre-selection query", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/alternatives`);
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.locator("#mobile-nav-drawer");
    await expect(drawer.locator('a[href="/generate/hashtags?platform=tiktok"]').first()).toBeVisible();
  });
});

test.describe("Offline", () => {
  test("uncached navigation offline gets the offline page, not '/' HTML", async ({ page, context }) => {
    await page.goto(`${BASE_URL}/about`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.goto(`${BASE_URL}/learn/courses/meta`).catch(() => null);
    await expect(page.locator("body")).toContainText("You're offline");
    await context.setOffline(false);
  });
});

test.describe("Hydration with a key + data", () => {
  // Smoke tests run key-less; the external-store / lazy-initializer refactor
  // matters most for keyed users, so check those renders are error-free too.
  test("keyed pages render without console or hydration errors", async ({ page, context }) => {
    await withKey(context, { activeBrand: BRAND.id });
    await bootAndSeed(page, { brains: [BRAND], ads: [metaAd()] });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (t.includes("Failed to load resource") || t.includes("Failed to fetch RSC payload")) return;
      errors.push(t);
    });
    for (const route of ["/", "/history", "/campaigns", "/settings", "/brand", "/suggestions", "/generate/meta", "/optimize/budget-planner", "/checklist/daily", "/learn/frameworks"]) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForTimeout(700);
      expect(page.url(), `${route} must not bounce`).not.toContain("/setup");
    }
    expect(errors).toEqual([]);
  });
});
