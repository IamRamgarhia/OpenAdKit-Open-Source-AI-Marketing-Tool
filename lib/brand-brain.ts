export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  pinterest?: string;
  threads?: string;
  other?: string;
}

export interface BrandBrain {
  id: string;
  name: string;
  business_name: string;
  industry: string;
  niche: string;
  website_url?: string;
  /** Public URL of the favicon scraped during onboarding. Rendered next to the
   *  client's name on cards and in the sidebar's quick-switcher. */
  favicon_url?: string;
  products: string[];
  platforms: string[];
  content_pillars: string[];
  social_links: SocialLinks;
  tone: string;
  personality_traits: string[];
  writing_style: string;
  words_to_use: string[];
  words_to_avoid: string[];
  audience_who: string;
  audience_pain_points: string[];
  audience_desires: string[];
  audience_demographics: string;
  /** Geographic service area derived from JSON-LD Place / LocalBusiness schema.
   *  Used by the system prompt for local-targeted copy (e.g., "{biz_name} serves
   *  {service_area}"). Empty string for non-local brands. */
  service_area?: string;
  usp: string;
  key_benefits: string[];
  key_messages: string[];
  objections: string[];
  objection_handling: string[];
  competitors: string[];
  differentiators: string[];
  price_positioning: string;
  voc_phrases: string[];
  voc_pain_quotes: string[];
  voc_success_quotes: string[];
  best_performing_angles: string[];
  failed_angles: string[];
  // Field names the user explicitly marked "fill later" during onboarding.
  // Used to suppress soft warnings + show a follow-up nudge in the dashboard.
  pending_user_input: string[];
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export function emptyBrandBrain(): BrandBrain {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: "",
    business_name: "",
    industry: "",
    niche: "",
    website_url: "",
    favicon_url: "",
    products: [],
    platforms: [],
    content_pillars: [],
    social_links: {},
    tone: "",
    personality_traits: [],
    writing_style: "",
    words_to_use: [],
    words_to_avoid: [],
    audience_who: "",
    audience_pain_points: [],
    audience_desires: [],
    audience_demographics: "",
    service_area: "",
    usp: "",
    key_benefits: [],
    key_messages: [],
    objections: [],
    objection_handling: [],
    competitors: [],
    differentiators: [],
    price_positioning: "",
    voc_phrases: [],
    voc_pain_quotes: [],
    voc_success_quotes: [],
    best_performing_angles: [],
    failed_angles: [],
    pending_user_input: [],
    created_at: now,
    updated_at: now,
  };
}

/**
 * Defensive read for brains saved before a field was added to the schema —
 * IndexedDB doesn't enforce missing properties.
 */
export function normalizeBrandBrain(b: any): BrandBrain {
  const merged = { ...emptyBrandBrain(), ...(b ?? {}) };
  // Shallow-merge lets an explicit `null` array field survive the `[]` default,
  // which then crashes any `.length`/`.map` downstream. Coerce every array-typed
  // field back to `[]` when it isn't an array.
  const ARRAY_FIELDS: (keyof BrandBrain)[] = [
    "products", "platforms", "content_pillars",
    "personality_traits", "words_to_use", "words_to_avoid",
    "audience_pain_points", "audience_desires",
    "key_benefits", "key_messages",
    "objections", "objection_handling",
    "competitors", "differentiators",
    "voc_phrases", "voc_pain_quotes", "voc_success_quotes",
    "best_performing_angles", "failed_angles",
    "pending_user_input",
  ];
  for (const f of ARRAY_FIELDS) {
    if (!Array.isArray((merged as any)[f])) (merged as any)[f] = [];
  }
  return merged;
}

const list = (arr: string[] | null | undefined) => (arr && arr.length ? arr.join(" | ") : "(none specified)");

import { FRAMEWORK_STACK } from "./prompts/framework-stack";

export interface SystemPromptOverrides {
  language?: string;
  tone_override?: string;
  /** Suppress the 1.1k-token framework stack — used by short-form generators
   *  (hashtags, email subjects, concept explainers) where the full strategic
   *  framework would dwarf the actual output. */
  skip_framework_stack?: boolean;
}

export function buildBrandSystemPrompt(brain: BrandBrain | null, overrides?: SystemPromptOverrides): string {
  const lang = overrides?.language && overrides.language !== "English" ? `\n\nLANGUAGE: Output ALL generated copy in ${overrides.language}. Variant labels, JSON field names, and metadata stay in English.` : "";
  const toneOverride = overrides?.tone_override ? `\n\nTONE OVERRIDE (replaces brand default): ${overrides.tone_override}` : "";
  const framework = overrides?.skip_framework_stack ? "" : `\n${FRAMEWORK_STACK}\n`;
  if (!brain || !brain.business_name) {
    return `You are an expert direct-response copywriter and paid media specialist.
The user has not configured a Brand Brain yet. Write professional, conversion-focused copy
that respects all platform character limits given in the user prompt.
${framework}
HONESTY: Never fabricate stats, testimonials, named partnerships, awards, or certifications.
AVOID: streamline, optimize, innovative, utilize, leverage, synergy, transform, "best", "#1", "leading" — unless verifiable.
WEAK CTAs to replace: "Submit", "Sign Up", "Learn More", "Click Here", "Get Started" → use outcome-named action verbs ("Start My Free Trial", "Get the Checklist").${lang}${toneOverride}`;
  }
  const objectionBlock = brain.objections?.length
    ? brain.objections
        .map((o, i) => `- ${o} → ${brain.objection_handling[i] ?? "(handle thoughtfully)"}`)
        .join("\n")
    : "(none provided)";
  const socialHandles = Object.entries(brain.social_links ?? {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return `You are an expert direct-response copywriter and paid media specialist.
You write exclusively for ${brain.business_name}.

=== BRAND BRAIN: READ BEFORE WRITING ANYTHING ===

BUSINESS: ${brain.business_name} (${brain.industry || "industry unspecified"})
NICHE: ${brain.niche || "(not specified — fall back to industry)"}
PRODUCTS / OFFERS: ${list(brain.products ?? [])}
PRIMARY SOCIAL PLATFORMS: ${list(brain.platforms ?? [])}
CONTENT PILLARS (recurring themes): ${list(brain.content_pillars ?? [])}
SOCIAL HANDLES: ${socialHandles || "(none provided)"}
TONE: ${brain.tone || "(default: confident, clear, conversion-focused)"}
PERSONALITY: ${list(brain.personality_traits)}
WRITING STYLE: ${brain.writing_style || "(default: short punchy sentences, action verbs first)"}

AUDIENCE:
- Who: ${brain.audience_who || "(unspecified)"}
- Demographics: ${brain.audience_demographics || "(unspecified)"}
- Pain points: ${list(brain.audience_pain_points)}
- Desires: ${list(brain.audience_desires)}${brain.service_area ? `

SERVICE AREA (location-aware copy):
- Brand operates out of: ${brain.service_area}
- When writing geo-targeted copy, name the area + lean into local proof points.` : ""}

PRODUCT/OFFER:
- USP: ${brain.usp || "(unspecified)"}
- Key benefits: ${list(brain.key_benefits)}
- Core messages: ${list(brain.key_messages)}

OBJECTIONS TO ADDRESS:
${objectionBlock}

COMPETITORS: ${list(brain.competitors)}
WHAT MAKES US BETTER: ${list(brain.differentiators)}

REAL CUSTOMER LANGUAGE (use naturally, never force):
${list(brain.voc_phrases)}

WORDS TO USE: ${list(brain.words_to_use)}
WORDS TO NEVER USE: ${list(brain.words_to_avoid)}

PROVEN ANGLES: ${list(brain.best_performing_angles)}
ANGLES TO AVOID: ${list(brain.failed_angles)}

=== END BRAND BRAIN ===
${framework}
RULES:
1. Always write in the exact tone and style above.
2. Use VOC phrases naturally — never force them.
3. Never sound generic — every word should feel like this brand.
4. Always address a pain point or desire.
5. Reference competitors only indirectly (never name them negatively).
6. Respect all platform character limits exactly. Validate your output before returning.
7. When asked for JSON, return ONLY valid JSON — no prose, no markdown fences.

HONESTY CONSTRAINT (non-negotiable):
- Never fabricate statistics, testimonials, customer quotes, or named partnerships.
- Fabricated proof points create legal liability and erode trust the moment they're detected.
- If a benefit cannot be supported by the brand brain, frame it as a claim ("designed to…") rather than a result ("does…").
- Never invent industry awards, certifications, or third-party validations.

WORDS / PHRASES TO AVOID (flagged as low-quality output):
- Vague verbs: streamline, optimize, innovative, utilize, facilitate, leverage, synergy, transform
- Hedge words: almost, very, really, quite, somewhat, pretty
- Generic CTAs: "Submit", "Sign Up", "Learn More", "Click Here", "Get Started" — replace with action verbs that name the outcome ("Start My Free Trial", "Get the Checklist").
- Superlatives without proof: "best", "#1", "leading", "world-class", "cutting-edge" — only when the brand brain has verifiable evidence.${lang}${toneOverride}`;
}
