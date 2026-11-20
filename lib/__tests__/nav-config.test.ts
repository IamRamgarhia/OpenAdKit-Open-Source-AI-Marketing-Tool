/**
 * Sidebar navigation integrity.
 *
 * Two classes of bug this catches, both of which were live:
 *
 *  1. A `query` naming a value the target page's select doesn't offer. The
 *     Google group linked Bid Strategy with `platform=Google`, but that tool's
 *     options are "Google Ads" / "Meta Ads" / "TikTok Ads" — so the dropdown
 *     rendered blank and the pre-selection silently did nothing. Nothing failed
 *     loudly; the link just quietly stopped doing its job.
 *
 *  2. A `href` pointing at a route that doesn't exist (typo, or a page moved).
 *
 * Reads the page files off disk rather than importing them — they're React
 * client components pulling in next/navigation, which won't load in a plain
 * Node test env.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NAV_GROUPS } from "../../components/nav-config";
import { suggestNextSteps, NON_FIELD_CARRY_KEYS } from "../next-steps";

const APP_DIR = path.resolve(__dirname, "..", "..", "app");

function pageFileFor(href: string): string | null {
  const rel = href === "/" ? "page.tsx" : path.join(...href.split("/").filter(Boolean), "page.tsx");
  const full = path.join(APP_DIR, rel);
  return fs.existsSync(full) ? full : null;
}

/** Option values declared for `fieldName` on that page, if it has such a field. */
function optionValuesFor(source: string, fieldName: string): string[] | null {
  const at = source.indexOf(`name: "${fieldName}"`);
  if (at < 0) return null;
  // Options live in the same field object; a generous window covers even the
  // longest platform lists without bleeding into the next field.
  const window = source.slice(at, at + 2000);
  const values = [...window.matchAll(/value:\s*"([^"]*)"/g)].map((m) => m[1]);
  return values;
}

const allItems = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

describe("nav-config: every href resolves to a real page", () => {
  for (const item of allItems) {
    it(`${item.group} → ${item.href}`, () => {
      expect(pageFileFor(item.href), `${item.href} has no app/**/page.tsx`).not.toBeNull();
    });
  }
});

describe("nav-config: every query pre-selects a value the target actually offers", () => {
  const withQuery = allItems.filter((i) => i.query);
  it("has at least one query to check (guards against the suite silently no-op'ing)", () => {
    expect(withQuery.length).toBeGreaterThan(0);
  });

  for (const item of withQuery) {
    it(`${item.group} → ${item.href}?${item.query}`, () => {
      const file = pageFileFor(item.href)!;
      const source = fs.readFileSync(file, "utf8");
      for (const [field, value] of new URLSearchParams(item.query!)) {
        const options = optionValuesFor(source, field);
        expect(options, `${item.href} has no "${field}" field, so ?${field}= does nothing`).not.toBeNull();
        expect(
          options,
          `${item.href}?${field}=${value} — "${value}" is not one of: ${options!.join(" | ")}`
        ).toContain(value);
      }
    });
  }
});

describe("nav-config: hygiene", () => {
  it("uses a consistent label per route", () => {
    // "Display banners" in one group and "Display Banners" in another reads as
    // two different tools.
    const byHref = new Map<string, Set<string>>();
    for (const i of allItems) {
      if (!byHref.has(i.href)) byHref.set(i.href, new Set());
      byHref.get(i.href)!.add(i.label);
    }
    const inconsistent = [...byHref.entries()]
      .filter(([, labels]) => new Set([...labels].map((l) => l.toLowerCase())).size !== labels.size)
      .map(([href, labels]) => `${href}: ${[...labels].join(" / ")}`);
    expect(inconsistent, "same route labelled with different casing").toEqual([]);
  });

  it("never repeats the identical link inside one group", () => {
    for (const g of NAV_GROUPS) {
      const keys = g.items.map((i) => `${i.href}?${i.query ?? ""}`);
      expect(new Set(keys).size, `duplicate entry in "${g.title}"`).toBe(keys.length);
    }
  });

  it("starts with every group collapsed", () => {
    // Twelve expanded groups pushed everything useful below the fold.
    // Sidebar.tsx still auto-expands the group holding the current route.
    const open = NAV_GROUPS.filter((g) => g.defaultOpen).map((g) => g.title);
    expect(open, "no group should be open by default").toEqual([]);
  });

  it("has no empty groups", () => {
    for (const g of NAV_GROUPS) expect(g.items.length, `"${g.title}" is empty`).toBeGreaterThan(0);
  });
});

describe("next-steps: every carried query pre-selects a value the target actually offers", () => {
  // Same class of bug as the sidebar: lib/next-steps.ts used to send Google
  // RSA users to Bid Strategy with platform=Google (not an option there).
  const toolRoutes = ["generate", "optimize"].flatMap((top) =>
    fs
      .readdirSync(path.join(APP_DIR, top), { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(APP_DIR, top, d.name, "page.tsx")))
      .map((d) => `/${top}/${d.name}`)
  );

  it("found the tool routes", () => {
    expect(toolRoutes.length).toBeGreaterThan(20);
  });

  for (const route of toolRoutes) {
    it(`${route} → next steps`, () => {
      const own = fs.readFileSync(pageFileFor(route)!, "utf8");
      // Exercise each platform the source tool itself offers, plus "none".
      const samples: (string | undefined)[] = [undefined, ...(optionValuesFor(own, "platform") ?? [])];
      for (const platform of samples) {
        const steps = suggestNextSteps({ route, ad_id: "ad-1", input: platform ? { platform } : {} });
        for (const s of steps) {
          const target = pageFileFor(s.href);
          expect(target, `${route} → ${s.href} has no page`).not.toBeNull();
          if (!s.carry) continue;
          const source = fs.readFileSync(target!, "utf8");
          for (const [field, value] of Object.entries(s.carry)) {
            if (NON_FIELD_CARRY_KEYS.has(field)) continue;
            const options = optionValuesFor(source, field);
            expect(options, `${route} → ${s.href}?${field}= : target has no "${field}" field`).not.toBeNull();
            expect(options, `${route} → ${s.href}?${field}=${value} not in: ${options?.join(" | ")}`).toContain(value);
          }
        }
      }
    });
  }
});
