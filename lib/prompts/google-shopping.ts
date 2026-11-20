export const SHOPPING_LIMITS = {
  title: 150,
  title_optimal_min: 70,
  description: 5000,
  description_optimal_min: 500,
  description_optimal_max: 1500,
} as const;

export interface ShoppingInput {
  product_title: string;
  current_description: string;
  brand: string;
  product_category: string;
  attributes: string;
  price: string;
}

export function buildShoppingPrompt(input: ShoppingInput): string {
  return `Optimize a Google Shopping product listing for search visibility AND conversion.

GOOGLE SHOPPING TITLE RULES (in priority order — first elements get the most algorithmic weight):
1. Brand (if recognizable)
2. Product type / category
3. Key attribute (size, color, material, model)
4. Distinguishing feature (the buyer's likely search modifier)
5. Use case

CHARACTER LIMITS:
- Title: ${SHOPPING_LIMITS.title} chars max · ${SHOPPING_LIMITS.title_optimal_min}-${SHOPPING_LIMITS.title} optimal (longer titles match more long-tail queries)
- Description: ${SHOPPING_LIMITS.description} chars max · ${SHOPPING_LIMITS.description_optimal_min}-${SHOPPING_LIMITS.description_optimal_max} optimal

INPUT:
- Current title: ${input.product_title}
- Current description: ${input.current_description}
- Brand: ${input.brand}
- Category: ${input.product_category}
- Key attributes (size, color, material, etc.): ${input.attributes}
- Price: ${input.price || "(not provided — do not invent pricing)"}

GENERATE:
1. Optimized title — apply the priority rule order. Self-count.
2. Optimized description — open with the buyer-facing answer (NOT "Welcome to our store"), include attributes naturally, end with a guarantee, return policy or review figure only if the brand brain or input lists it; otherwise end with a concrete product fact (origin, what's in the box, care instructions). Never invent ratings or reviews.
3. Highlight bullets — 5 short attribute hits (≤ 60 chars each).
4. Recommended additional structured-data attributes the user should populate in Merchant Center (Item GTIN, MPN, Color, Size, Material, Age Group, Gender, etc.) — name the field + suggested value or "needs source".
5. Top 10 long-tail search queries this listing should rank for, based on the attributes.
6. 5 negative-keyword candidates (queries you do NOT want this listing to match).

RULES:
- No marketing fluff. Shopping users are buying, not learning your brand story.
- No exclamation marks. Google penalizes them in feeds.
- Don't use ALL CAPS on words longer than 3 chars.
- Title cannot include promotional text ("free shipping", "sale", "best") — that's a Merchant Center disapproval trigger.

Return ONLY valid JSON:
{
  "title": { "text": "", "chars": 0, "status": "ok|over|under_optimal" },
  "description": { "text": "", "chars": 0, "status": "ok|over|under_optimal" },
  "highlights": ["string ≤ 60 chars"],
  "merchant_center_attributes": [
    { "field": "string", "value_or_action": "string", "priority": "high|medium|low" }
  ],
  "long_tail_queries_to_rank_for": ["string"],
  "negative_keywords": ["string"],
  "policy_warnings": ["empty array if none — flag promotional language, restricted terms, etc."]
}`;
}
