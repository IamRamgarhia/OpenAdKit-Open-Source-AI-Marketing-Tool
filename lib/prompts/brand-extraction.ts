export interface BrandExtractionInput {
  website_content?: string;
  description: string;
  audience_notes?: string;
  reviews?: string;
}

export function buildBrandExtractionPrompt(input: BrandExtractionInput): string {
  return `You are a senior brand strategist + direct-response copywriter with 20 years experience. Your job is to extract a COMPLETE brand intelligence profile from the content below. The user pasted this content trusting you to populate everything you can reasonably deduce — empty fields are a worse outcome than thoughtful inferences.

INPUT — WEBSITE / LANDING CONTENT (this is the primary source — read every word):
"""
${input.website_content?.trim() || "(not provided)"}
"""

INPUT — BUSINESS DESCRIPTION:
${input.description?.trim() || "(not provided)"}

INPUT — AUDIENCE NOTES:
${input.audience_notes?.trim() || "(not provided)"}

INPUT — CUSTOMER REVIEWS / TESTIMONIALS:
${input.reviews?.trim() || "(not provided)"}

═══════════════════════════════════════════════════════════════
HOW TO EXTRACT — read carefully, this is the difference between
a useful brand brain and a useless one
═══════════════════════════════════════════════════════════════

INFERENCE IS ENCOURAGED, NOT FORBIDDEN.
The content rarely says "our industry is X" or "our USP is Y" verbatim. You're a strategist — your job is to READ the content and DEDUCE what isn't spelled out. Examples of valid inferences:

- "We do Website Design, SEO, Graphic Design, Digital Marketing, E-commerce, UI/UX, Mobile App Development" → industry = "Digital agency / web development", niche = "Full-service digital agency offering web, design, marketing, and mobile app development", products = ["Website Design", "SEO Services", "Graphic Design", "Digital Marketing", "E-commerce", "UI/UX Design", "Mobile App Development"]
- "Transforming Vision into Virtual Reality: Your Digital Dream Team" + service list → usp = "Full-service digital partner that turns your business vision into a live web presence", tone = "Confident, visionary, partnership-oriented"
- "Fb. Tw. Li." in the page footer → platforms = ["Facebook", "Twitter / X", "LinkedIn"]
- A list of services for "Small businesses" + portfolio of mid-market clients → audience_who = "Small-to-mid-size businesses needing a full digital stack without juggling 5 agencies"
- "Free Consultation" CTA + "Contact us" everywhere → audience_pain_points likely include "Don't know which agency to trust", "Budget anxiety", "Past bad experiences with developers"

RULES:
1. **Always populate business_name and industry.** These are derivable from any homepage. If business_name isn't explicit, use the apparent brand name (logo text, page title, hostname). If industry isn't explicit, infer from products/services/tagline.

2. **Always populate niche (one-sentence positioning).** Combine industry + audience + key differentiator into one sentence. Never leave this blank for any real business.

3. **Always populate tone.** Read the writing style. Is it formal, playful, technical, warm, urgent, authoritative? Pick 2-4 adjectives.

4. **Populate USP whenever there's a tagline, slogan, or value statement.** Translate marketing-speak into a clear sentence. "Transforming Vision into Virtual Reality" → USP about turning ideas into real digital products.

5. **Populate audience_who if there's ANY signal.** Even "We help businesses grow" tells you "B2B, growth-stage businesses". Be specific where you can, broad where you can't, but never empty.

6. **Products / offers should be a list of every named service, product, or package.** Look at navigation, service pages, pricing tables, features lists.

7. **Platforms is for social-media presence.** Look for footer icons, "Follow us on X", links like instagram.com/X or facebook.com/X. Use canonical names: Instagram, TikTok, YouTube, LinkedIn, X, Facebook, Pinterest, Threads. Empty array only if you find ZERO social links.

8. **Content pillars are themes the brand consistently talks about.** Infer from blog topics, hero copy, repeated buzzwords, customer testimonial themes.

9. **Words to use / avoid** — extract literal words from the content into "use", and infer "avoid" from the absence of cliched corporate-speak. ("avoid" empty array is fine.)

═══════════════════════════════════════════════════════════════
HONESTY FLOOR (never crossable — different from inference):
═══════════════════════════════════════════════════════════════
- NEVER invent specific numbers, percentages, customer counts, awards, certifications, or named partnerships.
- NEVER invent specific testimonials or quotes the content doesn't have.
- "voc_phrases" must be REAL phrases from the reviews — exact wording. If no reviews provided, return [].
- Inference (deducing the obvious from explicit content) is fine. Fabrication (making up unverifiable facts) is not.
- When unsure between two interpretations, pick the more conservative one BUT STILL FILL THE FIELD.

═══════════════════════════════════════════════════════════════

Return ONLY valid JSON in this exact schema (no markdown fences, no prose):
{
  "business_name": "string — ALWAYS populate",
  "industry": "string — ALWAYS populate (infer from services)",
  "niche": "string — ALWAYS populate (one-sentence positioning)",
  "products": [],
  "platforms": [],
  "content_pillars": [],
  "social_links": {
    "instagram": "", "tiktok": "", "youtube": "", "linkedin": "",
    "twitter": "", "facebook": "", "pinterest": "", "threads": "", "other": ""
  },
  "tone": "string — ALWAYS populate (2-4 adjectives)",
  "personality_traits": [],
  "writing_style": "string",
  "words_to_use": [],
  "words_to_avoid": [],
  "audience_who": "string — ALWAYS populate (infer from signals)",
  "audience_pain_points": [],
  "audience_desires": [],
  "audience_demographics": "",
  "usp": "string — populate whenever a tagline/slogan/value-prop exists",
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

Additional rules:
- Match every entry in "objections" with a same-index rebuttal in "objection_handling".
- For audience-related fields, infer from the SHAPE of the offer + tone + price signals. A free consultation suggests price-sensitive; enterprise terminology suggests B2B mid-market; etc.
- Content pillars: 4-6 themes the brand consistently posts about. Infer from repeated topics, blog categories, About-page emphasis.`;
}
