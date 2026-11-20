/**
 * Output-eval checks (tests/eval/checks.ts) must judge the ad COPY, not the
 * model's strategy notes or image prompts: "best-before date" is not hype,
 * "text overlay under 20% of frame" in a visual brief is not an invented stat.
 */
import { describe, it, expect } from "vitest";
import { checkOutput, isCopyPath, bannedWordsIn } from "../../tests/eval/checks";
import { AI_TOOL_BY_NAME } from "../tools/registry";

const meta = AI_TOOL_BY_NAME.generate_meta_ads;
const pad = "Book a consultation for teeth whitening at Sunrise Dental. ".repeat(5);
const check = (data: unknown, name: string) => checkOutput(meta, data, {}, null).find((c) => c.name === name)!;

describe("banned-word check", () => {
  it("skips hyphenated compounds", () => {
    expect(bannedWordsIn("Check the best-before date. Our best-performing angle.")).toEqual([]);
  });
  it("still catches the standalone word", () => {
    expect(bannedWordsIn("The best dentist in Pune")).toEqual(["best"]);
    expect(bannedWordsIn("A world-class team")).toEqual(["world-class"]);
  });
  it("only scans copy fields, not rationale / notes / visual / prompt", () => {
    const data = {
      variants: [{ primary_text: pad, headline: "Whiter teeth, written price", rationale: "Leading with price is the best angle", image_concept: "best smile" }],
      audience_hint: "optimize for leads",
    };
    expect(check(data, "no banned hype words").pass).toBe(true);
    const bad = { variants: [{ primary_text: pad, headline: "The best whitening in Pune" }] };
    expect(check(bad, "no banned hype words").pass).toBe(false);
  });
});

describe("invented-stat check", () => {
  it("ignores percentages in layout / visual / prompt fields", () => {
    const data = {
      variants: [{ primary_text: pad, headline: "Whiter teeth", visual_brief: "Text overlay under 20% of frame", image_prompt: "logo at 15% width" }],
    };
    expect(check(data, "no invented stats in copy").pass).toBe(true);
  });
  it("flags a percentage in the copy itself", () => {
    const data = { variants: [{ primary_text: pad, headline: "98% of patients feel no pain" }] };
    const c = check(data, "no invented stats in copy");
    expect(c.pass).toBe(false);
    expect(c.detail).toContain("98%");
  });
});

describe("isCopyPath", () => {
  it.each([
    ["variants[0].headline", true],
    ["tweets[2].text", true],
    ["variants[0].rationale", false],
    ["creatives[1].image_concept", false],
    ["static_image_prompts[0].prompt", false],
    ["self_check.notes", false],
    ["ideas[0].visual_brief", false],
    ["strategy", false],
  ])("%s → %s", (p, want) => {
    expect(isCopyPath(p)).toBe(want);
  });
});
