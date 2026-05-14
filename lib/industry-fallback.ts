import { INDUSTRY_TEMPLATES } from "./industry-templates";
import type { BrandBrain } from "./brand-brain";

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
  { slug: "local_restaurant", keywords: ["restaurant", "cafe", "café", "bakery", "bar", "kitchen", "bistro", "diner", "eatery", "food", "menu", "chef", "dining"] },
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

export function pickClosestTemplate(industry: string, niche: string): string | null {
  const haystack = `${industry} ${niche}`.toLowerCase();
  let bestSlug: string | null = null;
  let bestScore = 0;
  for (const sig of TEMPLATE_KEYWORDS) {
    let score = 0;
    for (const kw of sig.keywords) {
      if (haystack.includes(kw)) score += kw.length;
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
  if (!slug) return { brain, filled: [], templateSlug: null };

  const template = INDUSTRY_TEMPLATES.find((t) => t.slug === slug);
  if (!template) return { brain, filled: [], templateSlug: null };

  // Get the template's filled values by applying it with no overrides.
  const filled = template.apply({ business_name: brain.business_name || "Your Brand" });
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

  return { brain: out as BrandBrain, filled: touched, templateSlug: slug };
}
