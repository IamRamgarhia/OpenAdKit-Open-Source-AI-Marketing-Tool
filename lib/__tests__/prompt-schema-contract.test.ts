/**
 * Prompt ↔ schema contract.
 *
 * Every JSON generator ships two halves that must agree: the prompt shows the
 * model an example JSON shape ("Return ONLY valid JSON: {...}"), and a Zod
 * schema validates the reply. They drifted: prompts said `"trimmed_alt":
 * "string or null"` / `"lead_form": null` while the schemas used z.string()
 * inside .partial(), which rejects null — so a model that followed the prompt
 * to the letter triggered a schema-retry on almost every run.
 *
 * For each prompt builder + schema pair this test extracts the example JSON
 * from the prompt text, fills placeholders the way a model following the
 * template would (including the literal `null` the prompt permits), and
 * requires the schema to accept it.
 *
 * Coverage guard: every `schema: XSchema` wired into an app page must have a
 * contract entry here, so a new generator can't skip the check.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ZodTypeAny } from "zod";

import * as G from "../schemas/generators";
import { CampaignKitSchema } from "../schemas/campaign-kit";
import { ContentCalendarSchema } from "../schemas/content-calendar";
import { CreativeScoreSchema } from "../schemas/creative-score";

import { buildGoogleRsaPrompt } from "../prompts/google-ads";
import { buildPmaxPrompt } from "../prompts/google-pmax";
import { buildShoppingPrompt } from "../prompts/google-shopping";
import { buildMetaPrompt } from "../prompts/meta-ads";
import { buildTikTokPrompt } from "../prompts/tiktok-ads";
import { buildTwitterPrompt } from "../prompts/twitter-ads";
import { buildYouTubePrompt } from "../prompts/youtube-ads";
import { buildLinkedInPrompt } from "../prompts/linkedin-ads";
import { buildDisplayPrompt } from "../prompts/display-ads";
import { buildEmailSubjectsPrompt } from "../prompts/email-subjects";
import { buildHashtagPrompt } from "../prompts/hashtags";
import { buildLeadFormPrompt } from "../prompts/lead-form";
import { buildReelIdeasPrompt } from "../prompts/reel-ideas";
import { buildSparkAdsPrompt } from "../prompts/tiktok-spark";
import { buildBhcPrompt } from "../prompts/tiktok-bhc";
import { buildCreativePromptPrompt } from "../prompts/creative-prompts";
import { buildCampaignKitPrompt } from "../prompts/campaign-kit";
import { buildContentCalendarPrompt } from "../prompts/content-calendar";
import { buildAbTestPrompt } from "../prompts/ab-test";
import { buildFatiguePrompt } from "../prompts/ad-fatigue";
import { buildAudienceTargetingPrompt } from "../prompts/audience-targeting";
import { buildBidStrategyPrompt } from "../prompts/bid-strategy";
import { buildBudgetPlannerPrompt } from "../prompts/budget-planner";
import { buildBudgetWastePrompt } from "../prompts/budget-waste";
import { buildCreativeScorePrompt } from "../prompts/creative-score";
import { buildCtrPrompt } from "../prompts/ctr-optimizer";
import { buildKeywordPrompt } from "../prompts/keyword-strategy";
import { buildLandingPrompt } from "../prompts/landing-page";
import { buildQualityScorePrompt } from "../prompts/quality-score";
import { buildCompetitorStealPrompt } from "../prompts/competitor-steal";
import { buildSuggestedCampaignsPrompt } from "../prompts/suggested-campaigns";
import { buildBrandExtractionPrompt } from "../prompts/brand-extraction";

// ---------------------------------------------------------------------------
// Input: a forgiving stand-in so we don't hand-maintain 30 input fixtures.
// Explicit overrides win (used to select prompt modes); any other property is
// a "sample" value that stringifies, iterates as empty, and survives method
// calls — enough for a builder to render its template.
// ---------------------------------------------------------------------------
function sample(): any {
  const fn = function () {};
  return new Proxy(fn, {
    get(_t, key) {
      if (key === Symbol.toPrimitive) return (hint: string) => (hint === "number" ? 1 : "sample");
      if (key === Symbol.iterator) return function* () {};
      if (key === "toString" || key === "valueOf") return () => "sample";
      if (key === "length") return 1;
      if (key === "then") return undefined; // not a thenable
      return sample();
    },
    apply() {
      return sample();
    },
  });
}

function input(overrides: Record<string, unknown> = {}): any {
  return new Proxy(overrides, {
    get(t, key) {
      if (typeof key === "string" && key in t) return t[key];
      if (key === "then") return undefined;
      return sample();
    },
    has() {
      return true;
    },
  });
}

// ---------------------------------------------------------------------------
// Template extraction + placeholder filling
// ---------------------------------------------------------------------------
const MARKER = /return only valid json/gi;

/** Balanced {...} starting at `start`, string-aware. */
function balancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function extractTemplates(prompt: string): string[] {
  const out: string[] = [];
  for (const m of prompt.matchAll(MARKER)) {
    const brace = prompt.indexOf("{", m.index! + m[0].length);
    if (brace < 0) continue;
    const obj = balancedObject(prompt, brace);
    if (obj) out.push(obj);
  }
  return out;
}

/** Strip comments, ellipses and trailing commas outside of strings. */
function normalize(src: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i++;
      } else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += c;
  }
  // Apply placeholder rewrites to the non-string stretches only, so a string
  // value like "1.91:1 | 1:1" is never touched.
  const parts = out.split(/("(?:[^"\\]|\\.)*")/);
  return parts
    .map((seg, i) => (i % 2 === 1 ? seg : rewritePlaceholders(seg)))
    .join("")
    .replace(/,\s*([\]}])/g, "$1");
}

function rewritePlaceholders(seg: string): string {
  return seg
    .replace(/,\s*(\.\.\.|…)\s*(?=[\]}])/g, "") // `, ...]`
    .replace(/(\[|\{)\s*(\.\.\.|…)\s*(?=[\]}])/g, "$1") // `[...]`
    .replace(/,\s*(\.\.\.|…)\s*,/g, ",")
    .replace(/:\s*(?:<[^>]*>|number|integer|float)(?=\s*[,}\]])/g, ": 0") // bare number placeholders
    .replace(/:\s*(?:true\s*\|\s*false|boolean)(?=\s*[,}\]])/g, ": true")
    .replace(/:\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*-?\d+(?:\.\d+)?(?=\s*[,}\]])/g, ": $1") // ranges 0-100
    .replace(/:\s*(-?\d+(?:\.\d+)?)\s*\|[^,}\]\n]*(?=[,}\]])/g, ": $1") // 1|2|3
    .replace(/,\s*([\]}])/g, "$1");
}

/** Fill the way a template-following model would. `nullMode` turns every
 *  "... or null" placeholder into a literal null (what the prompt allows). */
function fill(v: unknown, nullMode: boolean): unknown {
  if (Array.isArray(v)) return v.map((x) => fill(x, nullMode));
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = fill(x, nullMode);
    return o;
  }
  if (typeof v === "string") {
    if (nullMode && /\bor null\b|\|\s*null\b|^null$/i.test(v)) return null;
    if (/^(number|integer|int|float|<number>|0-9+)$/i.test(v.trim())) return 0;
    if (/^(boolean|true\|false|true or false)$/i.test(v.trim())) return true;
  }
  return v;
}

export function parseTemplate(tpl: string): unknown {
  return JSON.parse(normalize(tpl));
}

// ---------------------------------------------------------------------------
// Pairs
// ---------------------------------------------------------------------------
interface Pair {
  name: string;
  schemaName: string;
  schema: ZodTypeAny;
  prompts: string[];
}

const P = (name: string, schemaName: string, schema: ZodTypeAny, ...prompts: string[]): Pair => ({ name, schemaName, schema, prompts });

const PAIRS: Pair[] = [
  P("google rsa", "GoogleSchema", G.GoogleSchema, buildGoogleRsaPrompt(input())),
  P("google pmax", "GooglePmaxSchema", G.GooglePmaxSchema, buildPmaxPrompt(input())),
  P("google shopping", "GoogleShoppingSchema", G.GoogleShoppingSchema, buildShoppingPrompt(input())),
  P("meta", "MetaSchema", G.MetaSchema, buildMetaPrompt(input())),
  P("tiktok", "TiktokSchema", G.TiktokSchema, buildTikTokPrompt(input({ format: "hooks" })), buildTikTokPrompt(input({ format: "scripts" }))),
  P(
    "twitter",
    "TwitterSchema",
    G.TwitterSchema,
    buildTwitterPrompt(input({ format: "thread" })),
    buildTwitterPrompt(input({ format: "promoted_tweet", audience_geo: "" })),
    buildTwitterPrompt(input({ format: "website_card" }))
  ),
  P(
    "youtube",
    "YoutubeSchema",
    G.YoutubeSchema,
    buildYouTubePrompt(input({ format: "bumper" })),
    buildYouTubePrompt(input({ format: "discovery" })),
    buildYouTubePrompt(input({ format: "in_stream" }))
  ),
  P("linkedin", "LinkedinSchema", G.LinkedinSchema, buildLinkedInPrompt(input())),
  P("display", "DisplaySchema", G.DisplaySchema, buildDisplayPrompt(input())),
  P("email subjects", "EmailSubjectsSchema", G.EmailSubjectsSchema, buildEmailSubjectsPrompt(input())),
  P("hashtags", "HashtagsSchema", G.HashtagsSchema, buildHashtagPrompt(input())),
  P("lead form", "LeadFormSchema", G.LeadFormSchema, buildLeadFormPrompt(input())),
  P("reel ideas", "ReelIdeasSchema", G.ReelIdeasSchema, buildReelIdeasPrompt(input())),
  P("spark ads", "SparkAdsSchema", G.SparkAdsSchema, buildSparkAdsPrompt(input())),
  P("branded hashtag challenge", "BrandedHashtagChallengeSchema", G.BrandedHashtagChallengeSchema, buildBhcPrompt(input())),
  P("creative prompts", "CreativePromptsSchema", G.CreativePromptsSchema, buildCreativePromptPrompt(input())),
  P("campaign kit", "CampaignKitSchema", CampaignKitSchema, buildCampaignKitPrompt(input())),
  P("content calendar", "ContentCalendarSchema", ContentCalendarSchema, buildContentCalendarPrompt(input({ duration: "1_week" }))),
  P("ab test", "AbTestSchema", G.AbTestSchema, buildAbTestPrompt(input())),
  P("ad fatigue", "AdFatigueSchema", G.AdFatigueSchema, buildFatiguePrompt(input())),
  P("audience", "AudienceSchema", G.AudienceSchema, buildAudienceTargetingPrompt(input())),
  P("bid strategy", "BidStrategySchema", G.BidStrategySchema, buildBidStrategyPrompt(input())),
  P("budget planner", "BudgetPlannerSchema", G.BudgetPlannerSchema, buildBudgetPlannerPrompt(input())),
  P("budget waste", "BudgetWasteSchema", G.BudgetWasteSchema, buildBudgetWastePrompt(input())),
  P("creative score", "CreativeScoreSchema", CreativeScoreSchema, buildCreativeScorePrompt(input())),
  P("ctr", "CtrSchema", G.CtrSchema, buildCtrPrompt(input())),
  P("keywords", "KeywordsSchema", G.KeywordsSchema, buildKeywordPrompt(input())),
  P("landing page", "LandingPageSchema", G.LandingPageSchema, buildLandingPrompt(input())),
  P("quality score", "QualityScoreSchema", G.QualityScoreSchema, buildQualityScorePrompt(input())),
  P("competitor steal", "CompetitorStealSchema", G.CompetitorStealSchema, buildCompetitorStealPrompt(input())),
  P("suggestions", "SuggestionsSchema", G.SuggestionsSchema, buildSuggestedCampaignsPrompt(input())),
  P("brand extraction", "BrandExtractionSchema", G.BrandExtractionSchema, buildBrandExtractionPrompt(input({ description: "sample", website_content: "sample", metadata: undefined, prefilled: undefined }))),
];

describe("prompt template ↔ schema contract", () => {
  for (const pair of PAIRS) {
    pair.prompts.forEach((prompt, idx) => {
      const label = pair.prompts.length > 1 ? `${pair.name} (variant ${idx + 1})` : pair.name;
      it(`${label}: example JSON in the prompt parses through ${pair.schemaName}`, () => {
        const templates = extractTemplates(prompt);
        expect(templates.length, "no 'Return ONLY valid JSON' template found").toBeGreaterThan(0);
        const raw = parseTemplate(templates[templates.length - 1]);
        for (const nullMode of [false, true]) {
          const filled = fill(raw, nullMode);
          const res = pair.schema.safeParse(filled);
          if (!res.success) {
            throw new Error(
              `${pair.schemaName} rejected the prompt's own example (nullMode=${nullMode}):\n` +
                res.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")
            );
          }
        }
      });
    });
  }
});

describe("contract coverage", () => {
  it("every schema wired into an app page has a contract entry", () => {
    const root = path.resolve(__dirname, "../../app");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "page.tsx") files.push(p);
      }
    };
    walk(root);
    const used = new Set<string>();
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/schema:\s*([A-Z][A-Za-z]+Schema)\b/g)) used.add(m[1]);
    }
    const covered = new Set(PAIRS.map((p) => p.schemaName));
    const missing = [...used].filter((s) => !covered.has(s));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(20);
  });
});
