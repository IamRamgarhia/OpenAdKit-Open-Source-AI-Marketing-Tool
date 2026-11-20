import { describe, it, expect } from "vitest";
import { applyQueryOverrides, prefillFromSavedInput, persistableInput } from "../generator-prefill";
import type { InputField } from "../generator-config";

const fields: InputField[] = [
  { name: "product", label: "Product", kind: "text" },
  { name: "platform", label: "Platform", kind: "select", options: [{ value: "Meta Feed", label: "Meta Feed" }, { value: "Google Search", label: "Google Search" }] },
  { name: "count", label: "Count", kind: "number" },
  { name: "shot", label: "Screenshot", kind: "image" },
];

describe("applyQueryOverrides", () => {
  it("only applies declared, non-image fields", () => {
    const out = applyQueryOverrides({ product: "", platform: "Meta Feed" }, new URLSearchParams("product=Tea&ad_id=x&shot=abc&platform=Google+Search"), fields);
    expect(out).toEqual({ product: "Tea", platform: "Google Search" });
  });
  it("carry=0 skips overrides", () => {
    expect(applyQueryOverrides({ product: "a" }, new URLSearchParams("carry=0&product=b"), fields)).toEqual({ product: "a" });
  });
});

describe("prefillFromSavedInput", () => {
  it("copies matching fields and counts changes", () => {
    const { input, filled } = prefillFromSavedInput(
      { product: "", platform: "Meta Feed", count: 3, shot: null },
      { product: "Green tea", platform: "Google Search", count: 5, unrelated: "x", shot: "data" },
      fields
    );
    expect(input).toEqual({ product: "Green tea", platform: "Google Search", count: 5, shot: null });
    expect(filled).toBe(3);
  });
  it("ignores select values the field can't represent", () => {
    const { input } = prefillFromSavedInput({ platform: "Meta Feed" }, { platform: "Myspace" }, fields);
    expect(input.platform).toBe("Meta Feed");
  });
  it("tolerates missing saved input", () => {
    expect(prefillFromSavedInput({ product: "a" }, undefined, fields)).toEqual({ input: { product: "a" }, filled: 0 });
  });
});

describe("persistableInput", () => {
  it("drops __ keys", () => {
    expect(persistableInput({ a: 1, __hint: "x" })).toEqual({ a: 1 });
  });
});
