export const GOOGLE_RSA_LIMITS = {
  headline: 30,
  description: 90,
  long_headline: 90,
  sitelink_title: 25,
  sitelink_desc: 35,
  callout: 25,
  snippet_value: 25,
  display_path: 15,
} as const;

export interface GoogleRsaInput {
  goal: string;
  product: string;
  keyword: string;
  landing_url?: string;
  offer?: string;
}

export interface GoogleRsaOutput {
  angles: { label: string; motivation: string }[];
  headlines: { text: string; chars: number; angle: string; status: "ok" | "over"; trimmed_alt?: string }[];
  descriptions: { text: string; chars: number; angle: string; status: "ok" | "over"; trimmed_alt?: string }[];
  sitelinks: { title: string; desc1: string; desc2: string }[];
  callouts: string[];
  structured_snippets: { header: string; values: string[] };
  display_paths: { path1: string; path2: string };
  quality_score_tips: string[];
  self_check: { combinable: boolean; headline_mix_balanced: boolean; notes: string };
}

import { WAVE_BATCH_RULE } from "./common-rules";

export function buildGoogleRsaPrompt(input: GoogleRsaInput): string {
  return `Generate a complete Google Responsive Search Ad with extensions.

${WAVE_BATCH_RULE}


MODE: scratch (no historical winners provided)

CHARACTER LIMITS — Google's official specs. Treat as inviolable:
- Headlines: ${GOOGLE_RSA_LIMITS.headline} chars (spaces count)
- Descriptions: ${GOOGLE_RSA_LIMITS.description} chars
- Long headlines (Performance Max): ${GOOGLE_RSA_LIMITS.long_headline} chars
- Sitelink title: ${GOOGLE_RSA_LIMITS.sitelink_title} chars
- Sitelink description (each of 2 lines): ${GOOGLE_RSA_LIMITS.sitelink_desc} chars
- Callouts: ${GOOGLE_RSA_LIMITS.callout} chars
- Structured snippet values: ${GOOGLE_RSA_LIMITS.snippet_value} chars
- Display path segments: ${GOOGLE_RSA_LIMITS.display_path} chars each

COMBINABILITY CLAUSE (Google's own guidance):
Headlines and descriptions will be RECOMBINED automatically by Google's algorithm. Each headline must (a) make sense standalone and (b) make sense alongside ANY other headline. Same for descriptions. Avoid pronouns that depend on context from another asset. Avoid headlines that only work in a specific sequence.

INPUT:
- Campaign goal: ${input.goal}
- Product / service: ${input.product}
- Target keyword: ${input.keyword}
- Landing page: ${input.landing_url || "(not provided)"}
- Special offer: ${input.offer || "(none)"}

WORKFLOW (do these in order):

STEP 1 — Declare angles.
Emit an angles[] array with 5 angles, each {label, motivation}. Labels must be drawn from:
pain | outcome | social_proof | curiosity | comparison | urgency | identity | contrarian

STEP 2 — Generate 15 headlines with this exact mix (enforced):
- 4 keyword-led (include "${input.keyword}" naturally — never stuff)
- 4 benefit-led (an outcome the audience wants)
- 3 social-proof / specificity-led — proof ONLY from the Brand Brain (VOC quotes, key benefits, differentiators). If none is given, use verifiable specifics instead (location, hours, process, guarantee). Never invent numbers, ratings or customer counts.
- 3 CTA / offer-led
- 1 brand / differentiator

STEP 3 — Generate 4 descriptions with mix:
- 1 benefit + proof
- 1 feature + outcome
- 1 social-proof + CTA
- 1 urgency + CTA

STEP 4 — Generate extensions:
- 6 sitelinks (title + 2 descriptions each)
- 10 callouts
- 5 structured snippet values under one relevant header
- 2 display path segments (≤ 15 chars each)

STEP 5 — Self-validate.
For every headline and description, count chars yourself. If you exceed the limit, set status="over" and provide a trimmed_alt that fits. Then re-do the count for trimmed_alt before returning.

STEP 6 — Quality Score tips: 3 specific, actionable improvements for THIS campaign (not generic advice).

RULES:
- Never use "best" or "#1" without proof — Google disapproves unverifiable superlatives.
- Vary the opening word across headlines (algorithm penalizes near-duplicates).
- No exclamation marks in headlines (Google removes them; one allowed in descriptions).
- No double spaces, no trailing periods on headlines.
- Special Ad Categories (housing, employment, credit, finance) auto-disable narrow targeting — if any of those apply, note it in self_check.notes.

Return ONLY valid JSON. No prose. No markdown fences:
{
  "angles": [{ "label": "string", "motivation": "string" }],
  "headlines": [
    { "text": "string", "chars": 0, "angle": "keyword|benefit|social_proof|cta|brand",
      "status": "ok|over", "trimmed_alt": "string or null" }
  ],
  "descriptions": [
    { "text": "string", "chars": 0, "angle": "benefit_proof|feature_outcome|social_cta|urgency_cta",
      "status": "ok|over", "trimmed_alt": "string or null" }
  ],
  "sitelinks": [{ "title": "string", "desc1": "string", "desc2": "string" }],
  "callouts": ["string"],
  "structured_snippets": { "header": "string", "values": ["string"] },
  "display_paths": { "path1": "string", "path2": "string" },
  "quality_score_tips": ["string"],
  "self_check": {
    "combinable": true,
    "headline_mix_balanced": true,
    "notes": "Brief note on policies (Special Ad Categories, restricted terms, etc.) or empty string."
  }
}`;
}
