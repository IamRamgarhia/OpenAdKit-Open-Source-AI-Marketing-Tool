import { ANTI_FABRICATION_RULE, HASHTAG_COUNTS } from "./common-rules";

export interface HashtagInput {
  title: string;
  platform: "instagram" | "tiktok" | "twitter" | "linkedin" | "youtube" | "pinterest" | "any";
  language: string;
  context?: string;
}

export function buildHashtagPrompt(input: HashtagInput): string {
  return `Generate a tiered hashtag strategy for: "${input.title}"
Platform: ${input.platform}
Language: ${input.language}
Context: ${input.context || "(not provided)"}

LANGUAGE RULES:
- Generate hashtags in ${input.language}.
- If ${input.language} uses a non-Latin script (Hindi, Arabic, Japanese, etc.), include BOTH the native-script version AND a romanized/transliterated variant for cross-platform reach.
- Where there's a widely-used English equivalent (#travel, #fashion), include that too for discovery — clearly labeled.

PLATFORM RULES — hashtags per post (apply the ones relevant to ${input.platform}):
${HASHTAG_COUNTS}
- YouTube: a few relevant tags in the description; the first 3 show above the title
- Pinterest: a few relevant tags at most; keywords in the description matter more
- "any": the tiers are a master list; recommended_set follows the strictest cap above (≤ 5)

TIERS (return all four):

1. **Broad / discovery** (millions of posts) — for top-of-funnel reach
2. **Medium / topical** (100k - 1M posts) — sweet spot for actual visibility
3. **Niche / micro-community** (under 100k) — highest engagement rates, lowest competition
4. **Branded / campaign-specific** — your own brand tag(s) the audience could adopt

RULES:
- No spaces, no special chars except _ where allowed.
- Lowercase by default — some platforms prefer CamelCase for accessibility (#BlackFriday vs #blackfriday) — include both versions for the top tier.
- No banned/shadow-banned tags. Common banned examples include overused engagement-bait tags like #followme #like4like #f4f — never include these.
- Branded tags should match the brand from context; if no brand provided, suggest tag patterns based on the title.
- DO NOT generate hashtags about restricted topics (illegal substances, weapons, hate, adult content).

${ANTI_FABRICATION_RULE}

HASHTAG-VOLUME RULE (most important — read carefully):
You do NOT have live access to current hashtag post counts. Stating "10M+ posts" or "850k posts" as a fact is fabrication. Use the "volume_estimate" enum below instead — it captures the tier without inventing precision:
- "high"    → broadly used, 1M+ posts (use for top-of-funnel discovery tags)
- "mid"     → moderately used, ~100k–1M (use for the bulk of your post mix)
- "low"     → niche, < ~100k (use for engaged-community tags)
- "unknown" → you genuinely don't know, do not guess

Return ONLY valid JSON:
{
  "language_used": "string e.g. 'Spanish (es)' or 'Hindi (hi) — with English romanization'",
  "tiers": {
    "broad": [
      { "tag": "#string", "volume_estimate": "high|mid|low|unknown", "use_for": "string", "casing_variant": "string or null (e.g. CamelCase version)" }
    ],
    "medium": [
      { "tag": "#string", "volume_estimate": "high|mid|low|unknown", "use_for": "string", "casing_variant": "string or null" }
    ],
    "niche": [
      { "tag": "#string", "volume_estimate": "high|mid|low|unknown", "use_for": "string", "casing_variant": "string or null" }
    ],
    "branded": [
      { "tag": "#string", "usage_hint": "string" }
    ]
  },
  "english_crossover": [
    { "tag": "#string", "use_for": "string (when to add this for international reach)" }
  ],
  "recommended_set": ["#string — the set to paste for ${input.platform}, within its cap above"],
  "avoid": [
    { "tag": "string (no #)", "reason": "string" }
  ],
  "platform_specific_notes": "string — 2-3 sentence guidance specific to ${input.platform}"
}`;
}
