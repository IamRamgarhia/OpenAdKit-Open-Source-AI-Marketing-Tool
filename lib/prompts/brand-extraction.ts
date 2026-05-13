export interface BrandExtractionInput {
  website_content?: string;
  description: string;
  audience_notes?: string;
  reviews?: string;
}

export function buildBrandExtractionPrompt(input: BrandExtractionInput): string {
  return `You are a senior brand strategist and direct-response copywriter with 20 years experience.
Analyze the provided business content and extract a complete brand intelligence profile.

Input:
WEBSITE / LANDING CONTENT:
${input.website_content?.trim() || "(not provided)"}

BUSINESS DESCRIPTION:
${input.description?.trim() || "(not provided)"}

AUDIENCE NOTES:
${input.audience_notes?.trim() || "(not provided)"}

CUSTOMER REVIEWS / TESTIMONIALS:
${input.reviews?.trim() || "(not provided)"}

Return ONLY valid JSON. No prose, no markdown fences. Use this exact schema:
{
  "business_name": "",
  "industry": "",
  "niche": "",
  "products": [],
  "platforms": [],
  "content_pillars": [],
  "social_links": {
    "instagram": "", "tiktok": "", "youtube": "", "linkedin": "",
    "twitter": "", "facebook": "", "pinterest": "", "threads": "", "other": ""
  },
  "tone": "",
  "personality_traits": [],
  "writing_style": "",
  "words_to_use": [],
  "words_to_avoid": [],
  "audience_who": "",
  "audience_pain_points": [],
  "audience_desires": [],
  "audience_demographics": "",
  "usp": "",
  "key_benefits": [],
  "key_messages": [],
  "objections": [],
  "objection_handling": [],
  "competitors": [],
  "differentiators": [],
  "price_positioning": "",
  "voc_phrases": [],
  "voc_pain_quotes": [],
  "voc_success_quotes": [],
  "best_performing_angles": [],
  "failed_angles": []
}

Extraction rules for the new onboarding fields:
- "niche" — one specific sentence positioning the business beyond its industry ("DTC sleep brand selling weighted blankets to women 35-55", not just "ecommerce").
- "products" — 1-8 concrete product / service names you can see on the site. Skip generic categories.
- "platforms" — Social platforms the brand is ACTIVE on, detected from social-icon links in the page footer / header / contact section. Use canonical names: Instagram, TikTok, YouTube, LinkedIn, X, Facebook, Pinterest, Threads. If you can't find any social links in the content, return an empty array (do NOT guess).
- "content_pillars" — 4-6 short, repeatable themes the brand consistently talks about (e.g. "Founder stories", "Behind the scenes", "Customer wins", "Product education"). Infer from blog topics, About text, or featured headings. Empty array if not enough signal.
- "social_links" — Full URLs (or @handles) you actually find in the content. Leave each platform string empty if the URL/handle is not present. DO NOT fabricate handles.

General rules:
- Match every objection in "objections" with a same-index rebuttal in "objection_handling".
- "voc_phrases" must be REAL phrases from the reviews — exact wording, not paraphrased.
- If a field is truly unknown from the input, return an empty string or empty array — never invent details.`;
}
