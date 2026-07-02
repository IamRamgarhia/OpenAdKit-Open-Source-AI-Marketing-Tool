import { INDUSTRY_TEMPLATES } from "./industry-templates";
import type { BrandBrain } from "./brand-brain";

/** Last-resort defaults applied when no industry template keyword matches AND
 *  the AI passes left fields empty. Values are deliberately generic but
 *  non-empty so the form never ships with blank inference fields.
 *  User can edit anything before saving. */
const GENERIC_FALLBACK: Partial<BrandBrain> = {
  tone: "Confident, clear, customer-focused",
  personality_traits: ["Helpful", "Knowledgeable", "Direct"],
  writing_style: "Short, plain-language sentences. Lead with the customer benefit.",
  audience_who: "Decision-makers researching options in this category",
  audience_pain_points: ["Not enough time to evaluate every option", "Hard to tell real differentiators from marketing fluff", "Worried about wasting budget"],
  audience_desires: ["A clear answer that fits their situation", "Confidence in the choice", "Results, not just promises"],
  audience_demographics: "Adult consumers / professionals (25-55), English-speaking, online-savvy",
  key_benefits: ["Solves the core problem in this category", "Saves time vs alternatives", "Backed by people who actually know what they're doing"],
  key_messages: ["We focus on what actually matters for your outcome", "Built for real-world use, not marketing demos"],
  words_to_use: ["actually", "specifically", "what matters", "real results", "in practice"],
  words_to_avoid: ["world-class", "best-in-class", "synergy", "leverage", "transform"],
  competitors: ["Larger incumbents", "DIY / free alternatives", "Other specialists in this category"],
  differentiators: ["Personal attention vs. assembly-line operations", "Real outcomes over impressive promises"],
  price_positioning: "Mid-market — fair value for what you get",
  objections: ["How long does this take?", "What if it doesn't work for my situation?", "What does it actually cost?"],
  objection_handling: [
    "Most customers see results within the first cycle — specific timelines depend on inputs you provide upfront.",
    "We start with discovery so we can confirm fit before any commitment.",
    "Pricing is transparent and scoped to what you actually need — we'll quote before work starts.",
  ],
  content_pillars: ["Educational deep-dives", "Customer outcomes + case studies", "Behind-the-scenes / how we work", "Industry commentary"],
};

/**
 * After the AI extraction passes finish, some inference fields commonly stay
 * empty when the model is light (Gemini Flash, free-tier Llama). Rather than
 * showing the user a half-empty cross-check screen, we backfill missing fields
 * from the closest matching industry template.
 *
 * This is explicitly a FALLBACK — the user can edit anything before saving.
 * The point is: the form is never blank.
 *
 * Matching strategy: keyword match against industry + niche text. We score each
 * template's signals (industry name, slug words, sample tone words) against the
 * brain's industry+niche text. Highest score wins.
 */

interface TemplateSignal {
  slug: string;
  /** Keywords that strongly suggest this template applies. */
  keywords: string[];
}

const TEMPLATE_KEYWORDS: TemplateSignal[] = [
  { slug: "local_restaurant", keywords: ["restaurant", "cafe", "café", "coffee", "coffee shop", "espresso", "brewery", "bakery", "bar", "kitchen", "bistro", "diner", "eatery", "food", "menu", "chef", "dining"] },
  { slug: "b2b_saas", keywords: ["saas", "platform", "software", "api", "integration", "dashboard", "enterprise", "b2b", "workflow", "automation", "crm", "erp"] },
  { slug: "ecommerce_fashion", keywords: ["fashion", "apparel", "clothing", "shoes", "jewelry", "accessories", "boutique", "wardrobe", "outfit", "shop"] },
  { slug: "local_service", keywords: ["plumber", "plumbing", "dentist", "dental", "lawyer", "attorney", "electrician", "hvac", "contractor", "repair", "clinic", "law firm", "service", "local"] },
  { slug: "consumer_app", keywords: ["app", "mobile", "ios", "android", "consumer", "user", "freemium", "download", "tap", "swipe"] },
  { slug: "course_creator", keywords: ["course", "coach", "coaching", "academy", "mentor", "training", "lesson", "curriculum", "student", "learn", "program", "cohort"] },
  { slug: "agency", keywords: ["agency", "consultancy", "consulting", "design studio", "marketing agency", "creative", "branding", "web design", "seo", "digital marketing", "advertising", "studio"] },
  { slug: "info_product", keywords: ["ebook", "guide", "template", "download", "playbook", "toolkit", "digital product", "info product", "pdf", "swipe file"] },
  { slug: "marketplace", keywords: ["marketplace", "two-sided", "buyers", "sellers", "vendors", "listings", "directory", "platform connects"] },
  { slug: "real_estate", keywords: ["real estate", "realtor", "broker", "property", "listing", "homes", "houses", "apartment", "rent", "buy", "mls"] },
];

/** Word-boundary keyword match so short signals ("app", "bar", "shop", "local")
 *  don't match inside unrelated words. `haystack` is already lowercased. */
function matchesKeyword(haystack: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(haystack);
}

export function pickClosestTemplate(industry: string, niche: string): string | null {
  const haystack = `${industry} ${niche}`.toLowerCase();
  let bestSlug: string | null = null;
  let bestScore = 0;
  for (const sig of TEMPLATE_KEYWORDS) {
    let score = 0;
    for (const kw of sig.keywords) {
      if (matchesKeyword(haystack, kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = sig.slug;
    }
  }
  return bestScore > 0 ? bestSlug : null;
}

/**
 * Apply industry-template defaults to any field in `brain` that is still empty.
 * Returns a new brain with the fallback values merged in for missing fields only.
 * Fields that already have AI-extracted values are preserved untouched.
 */
export function applyIndustryFallback(brain: BrandBrain): { brain: BrandBrain; filled: string[]; templateSlug: string | null } {
  const slug = pickClosestTemplate(brain.industry || "", brain.niche || "");
  let filled: Partial<BrandBrain>;
  let usedSlug: string | null = slug;

  if (slug) {
    const template = INDUSTRY_TEMPLATES.find((t) => t.slug === slug);
    if (template) {
      filled = template.apply({ business_name: brain.business_name || "Your Brand" });
    } else {
      filled = GENERIC_FALLBACK;
      usedSlug = "generic";
    }
  } else {
    // No keyword match — use generic defaults so the user is never left with
    // a blank form. Better a generic non-empty starting point than empty.
    filled = GENERIC_FALLBACK;
    usedSlug = "generic";
  }
  const out: any = { ...brain };
  const touched: string[] = [];

  for (const [k, v] of Object.entries(filled)) {
    // Skip fields the user has saved overrides for (id, timestamps, identity).
    if (k === "id" || k === "created_at" || k === "updated_at" || k === "deleted_at") continue;
    if (k === "business_name" || k === "name" || k === "website_url" || k === "favicon_url") continue;
    if (k === "industry" || k === "niche" || k === "usp") continue; // Always keep AI-extracted positioning
    if (k === "social_links") continue; // Deterministic-extracted

    const current = (out as any)[k];
    const isEmpty =
      current == null ||
      (Array.isArray(current) && current.length === 0) ||
      (typeof current === "string" && !current.trim());

    if (isEmpty && v != null) {
      const isFilled =
        (Array.isArray(v) && v.length > 0) ||
        (typeof v === "string" && v.trim() !== "");
      if (isFilled) {
        out[k] = v;
        touched.push(k);
      }
    }
  }

  return { brain: out as BrandBrain, filled: touched, templateSlug: usedSlug };
}
