/**
 * Small correctness fixes: subpage dedupe, smart-fill field mapping, stable
 * brand-brain ids, and product-name leakage into prompts.
 */
import { describe, it, expect } from "vitest";
import { subpageDedupeKey, subpageTargets } from "../url-ingest";
import { suggestFromBrain } from "../smart-fill";
import { emptyBrandBrain, normalizeBrandBrain, buildBrandSystemPrompt } from "../brand-brain";
import { FRAMEWORK_STACK } from "../prompts/framework-stack";
import type { InputField } from "../generator-config";

describe("url-ingest subpage dedupe", () => {
  it("treats /about and /about/ as the same page", () => {
    expect(subpageDedupeKey("/about")).toBe(subpageDedupeKey("/about/"));
    expect(subpageDedupeKey("/about//")).toBe("/about");
  });

  it("keeps the root path as /", () => {
    expect(subpageDedupeKey("/")).toBe("/");
    expect(subpageDedupeKey("//")).toBe("/");
  });

  it("subpageTargets drops the trailing-slash duplicate", () => {
    const t = subpageTargets("https://acme.test", ["/about", "/about/", "/pricing"], 10);
    expect(t).toEqual(["https://acme.test/about", "https://acme.test/pricing"]);
  });
});

describe("smart-fill geo + audience fields", () => {
  const field = (name: string): InputField => ({ name, label: name, kind: "text" });
  const brain = {
    ...emptyBrandBrain(),
    business_name: "Acme Plumbing",
    audience_who: "Homeowners with older houses",
    audience_demographics: "35-64, homeowners",
    service_area: "Austin, TX metro",
  };

  it("fills geo fields from service_area, not demographics", () => {
    for (const n of ["geo", "geo_targeting", "market", "region_or_timezone"]) {
      expect(suggestFromBrain(field(n), brain), n).toBe("Austin, TX metro");
    }
  });

  it("leaves geo empty for a non-local brand rather than guessing from demographics", () => {
    expect(suggestFromBrain(field("geo"), { ...brain, service_area: "" })).toBe("");
  });

  it("fills audience_age from demographics, not audience_who", () => {
    expect(suggestFromBrain(field("audience_age"), brain)).toBe("35-64, homeowners");
  });

  it("audience_role uses audience_who and never falls back to an age/demographic string", () => {
    expect(suggestFromBrain(field("audience_role"), brain)).toBe("Homeowners with older houses");
    expect(suggestFromBrain(field("audience_role"), { ...brain, audience_who: "" })).toBe("");
  });
});

describe("normalizeBrandBrain id stability", () => {
  it("gives an id-less brain the same id on every normalize", () => {
    const raw = { name: "Acme", business_name: "Acme", created_at: 1700000000000 };
    const a = normalizeBrandBrain(raw);
    const b = normalizeBrandBrain({ ...raw });
    expect(a.id).toBeTruthy();
    expect(a.id).toBe(b.id);
  });

  it("different brains get different ids", () => {
    const a = normalizeBrandBrain({ name: "Acme", created_at: 1 });
    const b = normalizeBrandBrain({ name: "Beta", created_at: 1 });
    const c = normalizeBrandBrain({ name: "Acme", created_at: 2 });
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });

  it("keeps an existing id untouched", () => {
    expect(normalizeBrandBrain({ id: "keep-me", name: "Acme" }).id).toBe("keep-me");
  });
});

describe("product name in prompts", () => {
  it("framework stack header uses OpenAdKit, not the old AdForge name", () => {
    expect(FRAMEWORK_STACK).toContain("OPENADKIT FRAMEWORK STACK");
    expect(FRAMEWORK_STACK).not.toMatch(/adforge/i);
    const prompt = buildBrandSystemPrompt({ ...emptyBrandBrain(), business_name: "Acme" });
    expect(prompt).not.toMatch(/adforge/i);
  });
});
