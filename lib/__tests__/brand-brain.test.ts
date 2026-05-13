import { describe, it, expect } from "vitest";
import { emptyBrandBrain, normalizeBrandBrain, buildBrandSystemPrompt } from "../brand-brain";

describe("emptyBrandBrain", () => {
  it("fills every field the BrandBrain interface declares", () => {
    const b = emptyBrandBrain();
    expect(b.id).toBeTruthy();
    expect(typeof b.id).toBe("string");
    expect(b.business_name).toBe("");
    expect(Array.isArray(b.platforms)).toBe(true);
    expect(Array.isArray(b.content_pillars)).toBe(true);
    expect(b.social_links).toEqual({});
    expect(Array.isArray(b.pending_user_input)).toBe(true);
    expect(b.created_at).toBeGreaterThan(0);
    expect(b.updated_at).toBeGreaterThan(0);
  });
});

describe("normalizeBrandBrain — defensive read for older brains", () => {
  it("fills missing fields on a partial brain saved before the schema grew", () => {
    // Simulate an old brain in IndexedDB that pre-dates the platforms / pillars / social_links fields.
    const old: any = {
      id: "legacy-1",
      business_name: "Legacy Co",
      industry: "saas",
      usp: "We do the thing",
      created_at: 1700000000000,
      updated_at: 1700000000000,
    };
    const out = normalizeBrandBrain(old);
    expect(out.business_name).toBe("Legacy Co");
    expect(out.industry).toBe("saas");
    expect(out.usp).toBe("We do the thing");
    // New fields default to empties — no `undefined.length` crashes downstream.
    expect(out.platforms).toEqual([]);
    expect(out.content_pillars).toEqual([]);
    expect(out.products).toEqual([]);
    expect(out.social_links).toEqual({});
    expect(out.pending_user_input).toEqual([]);
  });

  it("never strips fields the legacy object has", () => {
    const partial: any = { id: "p", business_name: "B", weird_extra_field: "kept" };
    const out: any = normalizeBrandBrain(partial);
    expect(out.weird_extra_field).toBe("kept");
  });
});

describe("buildBrandSystemPrompt", () => {
  it("returns the generic system prompt when no brain is configured", () => {
    const prompt = buildBrandSystemPrompt(null);
    expect(prompt).toContain("not configured a Brand Brain");
    expect(prompt).toContain("HONESTY");
  });

  it("returns the generic system prompt when business_name is empty", () => {
    const b = { ...emptyBrandBrain(), business_name: "" };
    const prompt = buildBrandSystemPrompt(b);
    expect(prompt).toContain("not configured a Brand Brain");
  });

  it("returns the branded prompt when business_name is set", () => {
    const b = { ...emptyBrandBrain(), business_name: "Acme Tax", industry: "fintech", usp: "instant" };
    const prompt = buildBrandSystemPrompt(b);
    expect(prompt).toContain("Acme Tax");
    expect(prompt).toContain("fintech");
    expect(prompt).toContain("instant");
    expect(prompt).toContain("BRAND BRAIN");
  });

  it("includes the framework stack by default", () => {
    const b = { ...emptyBrandBrain(), business_name: "Acme" };
    const prompt = buildBrandSystemPrompt(b);
    expect(prompt).toContain("ADFORGE FRAMEWORK STACK");
    // Schwartz's awareness ladder is the cornerstone of the stack.
    expect(prompt).toContain("AWARENESS LEVEL");
  });

  it("suppresses the framework stack when skip_framework_stack is true", () => {
    const b = { ...emptyBrandBrain(), business_name: "Acme" };
    const prompt = buildBrandSystemPrompt(b, { skip_framework_stack: true });
    expect(prompt).not.toContain("ADFORGE FRAMEWORK STACK");
    expect(prompt).not.toContain("AWARENESS LEVEL");
    // But the brand brain block still renders.
    expect(prompt).toContain("Acme");
  });

  it("respects language override", () => {
    const b = { ...emptyBrandBrain(), business_name: "Acme" };
    const prompt = buildBrandSystemPrompt(b, { language: "Spanish" });
    expect(prompt).toContain("Output ALL generated copy in Spanish");
  });

  it("does NOT inject a language override when language is English (the default)", () => {
    const b = { ...emptyBrandBrain(), business_name: "Acme" };
    const prompt = buildBrandSystemPrompt(b, { language: "English" });
    expect(prompt).not.toContain("Output ALL generated copy in");
  });
});
