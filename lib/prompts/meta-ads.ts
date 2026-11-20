export const META_LIMITS = {
  primary_above_fold: 125,
  primary_max: 500,
  headline_mobile: 27,
  headline_desktop: 40,
  description: 27,
  carousel_headline: 40,
  carousel_description: 20,
} as const;

export interface MetaInput {
  objective: string;
  format: string;
  product: string;
  offer: string;
  cta: string;
}

import { WAVE_BATCH_RULE, VIDEO_HOOK_RULE, RETARGETING_MATRIX, CHAR_COUNT_SELF_VALIDATION, ANTI_FABRICATION_RULE } from "./common-rules";

export function buildMetaPrompt(input: MetaInput): string {
  const isVideo = ["video", "reels", "stories"].includes(input.format);
  return `Generate a complete Meta (Facebook + Instagram) ad.

${WAVE_BATCH_RULE}

${isVideo ? VIDEO_HOOK_RULE + "\n\n" : ""}${RETARGETING_MATRIX}


PLATFORM SPECS — never violate:
- Primary text: ${META_LIMITS.primary_above_fold} chars above the fold (visible without "See more"), max ${META_LIMITS.primary_max}.
- Headline: ${META_LIMITS.headline_mobile} chars (mobile), ${META_LIMITS.headline_desktop} max (desktop).
- Description: ${META_LIMITS.description} chars.
- Carousel card: headline ${META_LIMITS.carousel_headline} chars, description ${META_LIMITS.carousel_description} chars.

INPUT:
- Objective: ${input.objective}
- Ad format: ${input.format}
- Product / offer: ${input.product}
- Promotion: ${input.offer || "(none)"}
- Preferred CTA: ${input.cta || "(let Claude pick)"}

GENERATE 3 variants × this structure, each labeled by angle:
- Variant A — pain-point lead
- Variant B — desire / aspiration lead
- Variant C — social proof / VOC lead (use the Brand Brain's VOC quotes and proof only; if none exist, lead with a concrete, verifiable promise instead — never invent reviews, ratings or numbers)

For each variant include:
- primary_text (front-load the hook in the first ${META_LIMITS.primary_above_fold} chars)
- headline (≤ ${META_LIMITS.headline_mobile} chars)
- description (≤ ${META_LIMITS.description} chars)
- cta_button (one of: Shop Now, Learn More, Sign Up, Subscribe, Download, Get Offer, Book Now)
- char_counts: { primary, headline, description }

${CHAR_COUNT_SELF_VALIDATION}

For each variant, after writing the copy, also emit a "status" field per text field:
- primary_status: "ok" if char_counts.primary ≤ ${META_LIMITS.primary_max} else "over"
- headline_status: "ok" if char_counts.headline ≤ ${META_LIMITS.headline_mobile} else "over"
- description_status: "ok" if char_counts.description ≤ ${META_LIMITS.description} else "over"
- If any field is "over": include a "*_trimmed_alt" field with a version that fits.

${ANTI_FABRICATION_RULE}

If format is "video" or "reels" or "stories" include:
- video_script: { hook_0_3s, value_3_15s, cta_final_5s, b_roll: [], overlays: [{ time, text }] }

If format is "carousel" include:
- cards: [{ position, role: "problem|feature|proof|cta", headline, description, image_prompt }]

Return ONLY valid JSON:
{
  "variants": [
    {
      "label": "A | B | C",
      "angle": "pain | desire | proof",
      "primary_text": "string",
      "headline": "string",
      "description": "string",
      "cta_button": "string",
      "char_counts": { "primary": 0, "headline": 0, "description": 0 },
      "primary_status": "ok|over",
      "headline_status": "ok|over",
      "description_status": "ok|over",
      "primary_trimmed_alt": "string or null",
      "headline_trimmed_alt": "string or null",
      "description_trimmed_alt": "string or null",
      "video_script": null,
      "cards": null
    }
  ],
  "audience_hint": "one-sentence targeting suggestion",
  "best_placement_recommendation": "string"
}`;
}
