export const PMAX_LIMITS = {
  headline: 30,
  long_headline: 90,
  description: 90,
  business_name: 25,
  required_headlines: 5,
  required_long_headlines: 5,
  required_descriptions: 1,
  max_descriptions: 5,
  max_images: 20,
  image_min: "128×128",
} as const;

export const PMAX_IMAGE_RATIOS = [
  { ratio: "1.91:1", size: "1200×628", required: true },
  { ratio: "1:1", size: "1200×1200", required: true },
  { ratio: "4:5", size: "960×1200", required: false },
];

export interface PmaxInput {
  goal: string;
  product: string;
  audience: string;
  business_name: string;
  landing_url?: string;
}

export function buildPmaxPrompt(input: PmaxInput): string {
  return `Generate a complete Google Performance Max asset group.

PLATFORM SPECS (Google official — never violate):
- Headlines: 30 chars · ${PMAX_LIMITS.required_headlines} required, up to 15 allowed
- Long headlines: 90 chars · ${PMAX_LIMITS.required_long_headlines} required, up to 5
- Descriptions: 90 chars · 1 required, up to 5
- Business name: 25 chars
- Images: 1200×628 (landscape) + 1200×1200 (square) required, 960×1200 (portrait) recommended
- Video: 10s+ landscape/square/vertical (auto-generated if not provided)

COMBINABILITY (Google Copycat clause, authoritative):
Every asset will be RECOMBINED by Google's algorithm. Each headline / long headline / description must read well standalone AND alongside any other. No sequence dependencies.

INPUT:
- Goal: ${input.goal}
- Product / service: ${input.product}
- Audience signal: ${input.audience}
- Business name: ${input.business_name}
- Landing page: ${input.landing_url || "(not provided)"}

GENERATE — minimum requirements + best-practice maximums:
1. 15 headlines (30 chars). Mix: 5 keyword-led / 4 benefit-led / 3 social-proof / 2 CTA / 1 brand.
2. 5 long headlines (90 chars). Mix: 2 problem→solution / 2 feature→outcome / 1 social-proof statement.
   SOCIAL PROOF: use reviews, ratings, customer counts, awards or named clients only if the brand brain lists them. Otherwise write those slots as verifiable product / process facts (what's included, how it works, a stated guarantee) — still tag them "social_proof" only when they are real proof, else "benefit".
3. 5 descriptions (90 chars).
4. 3 image prompts — one per required ratio. Describe a STILL composition that survives at thumbnail scale, with text-safe space.
5. 1 video script (10–15s) — hook (0-3s), value (3-10s), CTA (10-15s).
6. 5 audience signals (Google calls these "audience signals" not "targeting" in PMax): in-market segments, custom intent signals, lookalike-style seeds.

SELF-VALIDATE: every line emits its char count. status="over" → trimmed_alt mandatory.

Return ONLY valid JSON:
{
  "headlines": [{ "text": "", "chars": 0, "angle": "keyword|benefit|social_proof|cta|brand", "status": "ok|over", "trimmed_alt": null }],
  "long_headlines": [{ "text": "", "chars": 0, "angle": "problem_solution|feature_outcome|social_proof", "status": "ok|over", "trimmed_alt": null }],
  "descriptions": [{ "text": "", "chars": 0, "status": "ok|over", "trimmed_alt": null }],
  "business_name": "",
  "image_prompts": [{ "ratio": "1.91:1 | 1:1 | 4:5", "size": "", "prompt": "" }],
  "video_script": {
    "hook_0_3s": { "vo": "", "visual": "" },
    "value_3_10s": { "vo": "", "visual": "" },
    "cta_10_15s": { "vo": "", "visual": "" }
  },
  "audience_signals": [
    { "type": "in_market | custom_intent | lookalike_seed | demographic", "value": "", "rationale": "" }
  ],
  "self_check": { "combinable": true, "all_required_assets_present": true, "notes": "" }
}`;
}
