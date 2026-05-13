import { describe, it, expect } from "vitest";
import { suggestFromBrain, applySmartFill } from "../smart-fill";
import { emptyBrandBrain, type BrandBrain } from "../brand-brain";
import type { InputField } from "../generator-config";

function makeBrain(overrides: Partial<BrandBrain> = {}): BrandBrain {
  return { ...emptyBrandBrain(), business_name: "Acme Tax", industry: "fintech", ...overrides };
}

const field = (name: string, overrides: Partial<InputField> = {}): InputField => ({
  name,
  label: name,
  kind: "text",
  ...overrides,
});

describe("suggestFromBrain — field-name mapping", () => {
  it("returns null when no brain is active", () => {
    expect(suggestFromBrain(field("anything"), null)).toBeNull();
  });

  it("maps business_name aliases", () => {
    const b = makeBrain({ business_name: "Acme Tax" });
    expect(suggestFromBrain(field("business_name"), b)).toBe("Acme Tax");
    expect(suggestFromBrain(field("company"), b)).toBe("Acme Tax");
    expect(suggestFromBrain(field("company_name"), b)).toBe("Acme Tax");
    expect(suggestFromBrain(field("brand"), b)).toBe("Acme Tax");
    expect(suggestFromBrain(field("brand_name"), b)).toBe("Acme Tax");
  });

  it("maps industry aliases including vertical/business_type", () => {
    const b = makeBrain({ industry: "fintech" });
    expect(suggestFromBrain(field("industry"), b)).toBe("fintech");
    expect(suggestFromBrain(field("category"), b)).toBe("fintech");
    expect(suggestFromBrain(field("vertical"), b)).toBe("fintech");
    expect(suggestFromBrain(field("business_type"), b)).toBe("fintech");
  });

  it("USP aliases pull from brain.usp", () => {
    const b = makeBrain({ usp: "Files your taxes in 10 minutes." });
    expect(suggestFromBrain(field("usp"), b)).toBe("Files your taxes in 10 minutes.");
    expect(suggestFromBrain(field("brand_promise"), b)).toBe("Files your taxes in 10 minutes.");
    expect(suggestFromBrain(field("primary_offer"), b)).toBe("Files your taxes in 10 minutes.");
  });

  it("audience field variants all pull audience_who, falling back to demographics", () => {
    const b = makeBrain({ audience_who: "Solo freelancers", audience_demographics: "US, 28-45" });
    for (const n of ["audience", "audience_who", "audience_context", "audience_one_liner", "audience_role", "target_audience"]) {
      expect(suggestFromBrain(field(n), b)).toBe("Solo freelancers");
    }
    const noWho = makeBrain({ audience_who: "", audience_demographics: "US, 28-45" });
    expect(suggestFromBrain(field("audience"), noWho)).toBe("US, 28-45");
  });

  it("platforms field returns comma-separated brain.platforms", () => {
    const b = makeBrain({ platforms: ["Instagram", "TikTok", "LinkedIn"] });
    expect(suggestFromBrain(field("platforms"), b)).toBe("Instagram, TikTok, LinkedIn");
    expect(suggestFromBrain(field("social_platforms"), b)).toBe("Instagram, TikTok, LinkedIn");
  });

  it("pillars prefers content_pillars, falls back to key_messages", () => {
    const withPillars = makeBrain({ content_pillars: ["Founder stories", "Customer wins"] });
    expect(suggestFromBrain(field("pillars"), withPillars)).toBe("Founder stories · Customer wins");
    expect(suggestFromBrain(field("themes"), withPillars)).toBe("Founder stories · Customer wins");

    const fallback = makeBrain({ content_pillars: [], key_messages: ["Honest pricing", "No surprises"] });
    expect(suggestFromBrain(field("pillars"), fallback)).toBe("Honest pricing · No surprises");
  });

  it("product fields prefer first brain.products entry, fall back to business_name", () => {
    const withProducts = makeBrain({ products: ["TaxPro Plus", "TaxPro Lite"] });
    expect(suggestFromBrain(field("product"), withProducts)).toBe("TaxPro Plus");
    expect(suggestFromBrain(field("offer"), withProducts)).toBe("TaxPro Plus");

    const noProducts = makeBrain({ products: [], business_name: "Acme Tax" });
    expect(suggestFromBrain(field("product"), noProducts)).toBe("Acme Tax");
  });

  it("per-platform social handle fields pull from social_links", () => {
    const b = makeBrain({ social_links: { instagram: "@acme", tiktok: "@acmetik", linkedin: "" } });
    expect(suggestFromBrain(field("instagram"), b)).toBe("@acme");
    expect(suggestFromBrain(field("tiktok_handle"), b)).toBe("@acmetik");
    expect(suggestFromBrain(field("linkedin_url"), b)).toBeFalsy(); // empty string from social_links
  });

  it("competitors field comma-joins multiple", () => {
    const b = makeBrain({ competitors: ["TurboTax", "FreshBooks"] });
    expect(suggestFromBrain(field("competitors"), b)).toBe("TurboTax, FreshBooks");
    expect(suggestFromBrain(field("competitor_name"), b)).toBe("TurboTax");
  });

  it("intentional blanks: goal / cta / campaign_name return empty string", () => {
    const b = makeBrain({ usp: "any" });
    expect(suggestFromBrain(field("goal"), b)).toBe("");
    expect(suggestFromBrain(field("cta"), b)).toBe("");
    expect(suggestFromBrain(field("campaign_name"), b)).toBe("");
  });

  it("unknown field names return null (not empty string)", () => {
    const b = makeBrain();
    expect(suggestFromBrain(field("totally_unknown_field"), b)).toBeNull();
  });
});

describe("applySmartFill — never overwrites user-typed values", () => {
  it("fills empty fields from brain", () => {
    const fields: InputField[] = [field("industry"), field("usp")];
    const b = makeBrain({ industry: "fintech", usp: "instant" });
    const out = applySmartFill(fields, { industry: "", usp: "" }, b);
    expect(out).toEqual({ industry: "fintech", usp: "instant" });
  });

  it("preserves a value the user already typed", () => {
    const fields: InputField[] = [field("industry"), field("usp")];
    const b = makeBrain({ industry: "fintech", usp: "instant" });
    const out = applySmartFill(fields, { industry: "real-estate", usp: "" }, b);
    expect(out.industry).toBe("real-estate"); // user wins
    expect(out.usp).toBe("instant");          // empty was filled
  });

  it("no-op when brain is null", () => {
    const fields: InputField[] = [field("industry")];
    const out = applySmartFill(fields, { industry: "" }, null);
    expect(out).toEqual({ industry: "" });
  });
});
