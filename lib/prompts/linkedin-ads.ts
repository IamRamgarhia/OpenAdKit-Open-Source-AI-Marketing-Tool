export const LINKEDIN_LIMITS = {
  intro_recommended: 150,
  intro_max: 600,
  headline_recommended: 70,
  headline_max: 200,
  description_recommended: 100,
  description_max: 300,
  carousel_intro: 255,
  carousel_card_headline: 45,
} as const;

export interface LinkedInInput {
  format: "sponsored_content" | "message_ad" | "dynamic_ad" | "text_ad" | "lead_gen_form";
  objective: string;
  product: string;
  audience: string;
  cta: string;
}

import { WAVE_BATCH_RULE } from "./common-rules";

export function buildLinkedInPrompt(input: LinkedInInput): string {
  return `Generate a LinkedIn ${input.format.replace(/_/g, " ")} campaign.

${WAVE_BATCH_RULE}


PLATFORM SPECS (do not violate):
- Intro: ${LINKEDIN_LIMITS.intro_recommended} chars recommended, ${LINKEDIN_LIMITS.intro_max} max
- Headline: ${LINKEDIN_LIMITS.headline_recommended} chars recommended, ${LINKEDIN_LIMITS.headline_max} max
- Description: ${LINKEDIN_LIMITS.description_recommended} chars recommended, ${LINKEDIN_LIMITS.description_max} max

B2B TONE RULES:
- LinkedIn is a professional context. Speak to decision-makers, not consumers.
- Lead with industry insight or specific business outcome, not a generic hook.
- Numbers and named companies beat adjectives every time.
- Avoid emoji. Avoid hashtag stacking. Avoid "transform your business" boilerplate.

INPUT:
- Format: ${input.format}
- Objective: ${input.objective}
- Product: ${input.product}
- Audience (role + industry + seniority): ${input.audience}
- Preferred CTA: ${input.cta || "(pick from LinkedIn's set)"}

GENERATE 3 variants × these angles:
- Variant A: Industry-specific outcome (data-led only with data from the Brand Brain or input; otherwise state the concrete outcome without numbers)
- Variant B: Thought-leadership angle (perspective / contrarian POV)
- Variant C: Peer / community proof (name customers ONLY if the Brand Brain lists them; otherwise speak to peer roles and the integrations/process they already use — never invent customer names)

For each variant include:
- intro_text (front-load value before the "see more" cut at 150 chars)
- headline
- description
- cta_button (one of: Apply Now, Download, Get Quote, Learn More, Sign Up, Subscribe, Register, Request Demo)
- char_counts: { intro, headline, description }

If format is "lead_gen_form", also include:
- form_intro (≤ 70 chars)
- 4 qualifying questions appropriate to ${input.audience}, each with field type (text|email|phone|select) and optional options[]

If format is "carousel", also include:
- cards: 5 cards, each { position, headline (≤ 45), image_prompt }
- carousel_intro (≤ 255)

Self-validate char counts. If a line goes over the recommended length, mark status="rec_over" but show it anyway; only mark "max_over" if past the absolute max and provide trimmed_alt.

Return ONLY valid JSON:
{
  "variants": [
    {
      "label": "A | B | C",
      "angle": "industry_outcome | thought_leadership | peer_proof",
      "intro_text": "string",
      "headline": "string",
      "description": "string",
      "cta_button": "string",
      "char_counts": { "intro": 0, "headline": 0, "description": 0 },
      "status": { "intro": "ok|rec_over|max_over", "headline": "ok|rec_over|max_over", "description": "ok|rec_over|max_over" }
    }
  ],
  "lead_form": null,
  "carousel": null,
  "audience_targeting": {
    "job_titles": ["3-5 specific titles"],
    "seniority": ["string"],
    "industries": ["3-5"],
    "skills": ["3-5"],
    "company_size": "string",
    "exclusions": ["string"]
  }
}`;
}
