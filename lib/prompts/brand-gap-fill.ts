/**
 * Second-pass prompt for filling fields the first extraction left empty.
 *
 * The first AI pass is general-purpose — schema, honesty floor, every field.
 * Gemini Flash and other lighter models often return many inference fields
 * blank under that prompt because the honesty constraints make them risk-averse.
 *
 * This pass is narrow: takes the known facts about the brand + the raw website
 * content, lists exactly which fields are empty, and asks the model to infer
 * them. The schema example below uses LITERAL example values for each field
 * type so the model returns the right shape — earlier versions stringified
 * guidance text, which caused Gemini Flash to return strings for array fields.
 * (Audit finding #5.)
 */

export interface BrandGapFillInput {
  business_name: string;
  industry?: string;
  niche?: string;
  usp?: string;
  website_content?: string;
  /** Names of fields that came back empty from the first pass. */
  missing_fields: string[];
}

/** Literal example values shown to the model so it returns the right JSON shape.
 *  Strings stay strings, arrays stay arrays, descriptions stay separate. */
const FIELD_EXAMPLES: Record<string, unknown> = {
  tone: "Confident, direct, slightly irreverent",
  personality_traits: ["Direct", "Analytical", "Anti-fluff"],
  writing_style: "Short punchy sentences, concrete numbers, no corporate hedging",
  audience_who: "Bootstrapped ecommerce founders doing $1M-$10M ARR who manage their own paid ads",
  audience_pain_points: ["Can't tell which channel drove the sale", "Spreadsheet hell every Monday", "Tools cost more than they return"],
  audience_desires: ["A dashboard they actually trust", "Time back from weekly reporting", "Confidence to scale spend"],
  audience_demographics: "30-45, English-speaking, US/UK/AU, technically literate ecommerce operators",
  products: ["Core dashboard", "Attribution module", "Cohort exports"],
  platforms: ["Instagram", "LinkedIn", "YouTube"],
  content_pillars: ["Attribution clarity", "Retention math", "Founder stories", "Tool teardowns"],
  key_benefits: ["Stop double-counting revenue", "Cut reporting time from 4 hours to 10 minutes", "See which ad drove last week's revenue"],
  key_messages: ["Attribution that respects how customers actually buy", "Built for operators, not analysts"],
  words_to_use: ["actually", "the math", "compounding", "leverage", "honest"],
  words_to_avoid: ["synergy", "best-in-class", "world-class"],
  competitors: ["Triple Whale", "Northbeam"],
  differentiators: ["Founder-built, not VC-built", "Flat pricing, not revenue-share"],
  price_positioning: "Mid-market — premium to free tools, cheaper than enterprise platforms",
  objections: ["Will this work with my existing stack?", "How long until we see signal?", "How is this different from Triple Whale?"],
  objection_handling: ["Plugs into Shopify, GA4, Meta Ads, Klaviyo on day one — no engineering required.", "Most stores see clean attribution within 14 days.", "We're founder-built and don't lock you into rev-share pricing."],
};

const FIELD_GUIDANCE: Record<string, string> = {
  tone: "2-4 adjectives describing the brand's voice. Read the writing style and pick.",
  personality_traits: "2-4 adjective strings.",
  writing_style: "One sentence describing sentence length, vocabulary, structure.",
  audience_who: "One sentence describing the ideal customer. Infer from offer shape, price signals, terminology.",
  audience_pain_points: "3-5 problems this audience has. Infer from what the offer solves.",
  audience_desires: "3-5 outcomes this audience wants. Infer from outcome language.",
  audience_demographics: "Age range, geography, language, technical sophistication. Infer reasonably.",
  products: "3+ products/services/offers. Pull from navigation, hero, services list, pricing tables.",
  platforms: "Social platforms the brand uses. Canonical names: Instagram, TikTok, YouTube, LinkedIn, X / Twitter, Facebook, Pinterest, Threads.",
  content_pillars: "4-6 recurring themes the brand talks about.",
  key_benefits: "3-5 concrete benefits the offer delivers.",
  key_messages: "2-4 core repeatable claims the brand makes.",
  words_to_use: "5+ literal words the brand uses in its own copy.",
  words_to_avoid: "Words this brand would NOT use. 0-5 entries — empty array OK if uncertain.",
  competitors: "1-3 likely competitors. Infer from industry + positioning.",
  differentiators: "2-4 things this brand emphasizes over alternatives.",
  price_positioning: "Short phrase: budget / mid-market / premium / enterprise, with reasoning.",
  objections: "3-5 likely customer objections.",
  objection_handling: "Same-indexed array of rebuttals. Index 0 rebuts objection 0.",
};

export function buildBrandGapFillPrompt(input: BrandGapFillInput): string {
  const ctx = [
    input.business_name ? `Business: ${input.business_name}` : "",
    input.industry ? `Industry: ${input.industry}` : "",
    input.niche ? `Positioning: ${input.niche}` : "",
    input.usp ? `USP: ${input.usp}` : "",
  ].filter(Boolean).join("\n");

  // Build the schema example block with LITERAL values for each requested field.
  // The model receives a real JSON object showing the exact shape expected.
  const schemaPairs = input.missing_fields.map((f) => {
    const example = FIELD_EXAMPLES[f] ?? "Fill based on the content.";
    return `  "${f}": ${JSON.stringify(example)}`;
  });
  const schema = schemaPairs.join(",\n");

  // Build a separate guidance section so the description text doesn't pollute
  // the schema example and confuse the model about value types.
  const guidance = input.missing_fields
    .map((f) => `- ${f}: ${FIELD_GUIDANCE[f] ?? "Fill based on the content."}`)
    .join("\n");

  return `You are a senior brand strategist filling out a brand profile worksheet.

WHAT YOU KNOW about the brand:

${ctx}

OPTIONAL — page content for additional signal:
"""
${(input.website_content ?? "").slice(0, 8000)}
"""

YOUR JOB: complete the worksheet below. These are STRATEGIST INFERENCES — not factual claims requiring proof. Treat it like a creative director sketching a brand brief: make reasonable, opinionated guesses based on what brands in this industry typically look like.

Empty fields are unacceptable. If the page content doesn't tell you, INFER FROM INDUSTRY NORMS. Examples:
- "Web agency in Punjab" → tone is "Professional, regional-pride, partnership-oriented"; pain points include "Working with overseas devs who disappear", "Cheap freelancers who deliver garbage", "Big-city agency prices"; competitors include "Freelance marketplaces", "Other local digital agencies".
- "Cricket equipment brand" → tone is "Passionate, performance-focused, club-friendly"; pain points include "Cheap imports that break in one season", "Sizing inconsistency", "Pro-grade gear is overpriced"; competitors include "SS", "SG", "Kookaburra".
- "Bootstrapped SaaS" → tone is "Direct, anti-fluff, founder-voice"; pain points include "Bigger competitors with VC budgets", "Trust signals are limited", "Demos vs free trial debate".

The point: never return empty arrays. Reasonable industry-norm inference is the EXPECTED behavior, not fabrication.

FIELD-BY-FIELD GUIDANCE:
${guidance}

Return ONLY valid JSON in EXACTLY this shape (no markdown fences, no prose around it). The values below are EXAMPLES from a different industry — REPLACE every value with this brand's specifics. Match the SHAPE: arrays stay arrays with multiple entries, strings stay non-empty.

{
${schema}
}

Hard rules:
- Arrays must contain at least 2 entries (3+ where guidance says so).
- Strings must be non-empty (a single sentence minimum).
- Match objections[i] to objection_handling[i] by index — same length.
- The ONLY thing you may NOT invent: specific numbers (e.g. "10,000 customers"), real testimonial quotes, real customer names, certifications, awards. Inference about audience traits, pain points, competitors, tone, words = expected and required.`;
}
