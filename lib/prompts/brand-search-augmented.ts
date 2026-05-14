/**
 * Search-augmented gap-fill prompt. Runs after the first-pass URL extraction
 * succeeds — we feed Google search results (about the brand we already
 * identified) back to the model to mine for additional signal: reviews,
 * competitor mentions, audience language, press, etc.
 *
 * The brand's own homepage rarely contains pain points, competitor names, or
 * real customer language. Search-result aggregators (review sites, forum
 * threads, news mentions) almost always do.
 */

export interface SearchAugmentedInput {
  business_name: string;
  industry?: string;
  niche?: string;
  usp?: string;
  /** Aggregated Google search-result text (via s.jina.ai → sidecar). */
  search_content: string;
  /** Fields that are still empty after pass 1 + gap-fill. */
  missing_fields: string[];
}

export function buildSearchAugmentedPrompt(input: SearchAugmentedInput): string {
  const facts = [
    `Business: ${input.business_name}`,
    input.industry ? `Industry: ${input.industry}` : "",
    input.niche ? `Positioning: ${input.niche}` : "",
    input.usp ? `USP: ${input.usp}` : "",
  ].filter(Boolean).join("\n");

  const fieldList = input.missing_fields.map((f) => `  "${f}": ...`).join(",\n");

  return `You are a senior brand strategist enriching a brand profile using Google search results.

WHAT YOU ALREADY KNOW (from their website):
${facts}

GOOGLE SEARCH RESULTS for this brand (review sites, mentions, forums, news):
"""
${(input.search_content ?? "").slice(0, 14000)}
"""

The search results above contain signals the homepage doesn't expose: customer reviews, competitor mentions, audience pain points + desires in real customer language, locations, press, partnerships. Mine them to fill the empty fields below.

Priorities when reading the search results:
- Review-site quotes → audience_pain_points, audience_desires, voc_pain_quotes, voc_success_quotes (only quote what's literally in the text — never invent)
- Competitor names that appear next to this brand → competitors
- Customer demographics described in reviews / forums → audience_who, audience_demographics
- Recurring themes across multiple results → content_pillars
- Words the brand or its customers repeatedly use → words_to_use
- Pricing tier signals (vs. competitor mentions) → price_positioning
- FAQ-style questions in forums about this brand → objections
- The brand's stated answers / claims → objection_handling, key_messages, key_benefits

If the search results are sparse, INFER from industry norms — but only for fields where inference is reasonable (tone, audience traits, generic pain points, competitor categories). NEVER invent specific numbers, named partnerships, awards, or testimonials that aren't literally in the text above.

Return ONLY valid JSON with EXACTLY these keys (no markdown fences, no prose around it):

{
${fieldList}
}

Match the schema's expected types: arrays for list fields (minimum 2 entries), strings for single-value fields (non-empty). Match objections[i] to objection_handling[i] by index.
`;
}
