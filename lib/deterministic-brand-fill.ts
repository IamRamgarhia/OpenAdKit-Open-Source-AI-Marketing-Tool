import type { BrandBrain } from "./brand-brain";
import type { IngestMetadata } from "./url-ingest";

/**
 * Pull every field we can from raw page metadata WITHOUT calling the AI.
 *
 * The AI is unreliable for things metadata already states explicitly. Pages
 * put their brand name in <title> + OG site_name. Their positioning in
 * <meta description>. Their address + email + logo in JSON-LD Organization.
 * FAQs sit in JSON-LD FAQPage and map cleanly onto objections / objection_handling.
 * None of that needs inference — it's already structured.
 *
 * This runs BEFORE the AI extraction. The AI then handles the inference-
 * heavy fields (tone, audience pain points, products list, content pillars)
 * with the pre-filled fields as anchor context.
 *
 * Returns a partial BrandBrain — only the fields it could derive. Caller
 * merges over the empty-brain defaults.
 */
export function deterministicFillFromMetadata(meta: IngestMetadata | undefined, fallbackUrl: string): Partial<BrandBrain> {
  if (!meta) return {};
  const out: Partial<BrandBrain> = {};

  // 1. Business name — OG site_name beats <title>, both beat hostname.
  //    <title> usually has the format "Real Name | Tagline" or "Tagline - Real Name".
  //    Split on common separators and pick the shortest non-tagline chunk.
  let bizName = meta.og?.site_name?.trim() || "";
  if (!bizName && meta.title) {
    const cleaned = decodeEntities(meta.title);
    const parts = cleaned.split(/\s+[|\-–—·:]\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      const ranked = parts
        .filter((p) => p.length >= 2 && !/^(home|welcome|index)$/i.test(p))
        .sort((a, b) => a.length - b.length);
      bizName = ranked[0] ?? parts[0] ?? cleaned;
    } else {
      bizName = cleaned;
    }
  }
  if (!bizName && fallbackUrl) {
    try { bizName = new URL(fallbackUrl).hostname.replace(/^www\./i, ""); } catch {}
  }
  if (bizName) {
    out.business_name = bizName;
    out.name = bizName;
  }

  // 2. JSON-LD Organization — most authoritative source. Extract everything.
  const orgs = (meta.json_ld ?? []).flatMap((ld) => extractOrganizations(ld));
  const primaryOrg = orgs[0];
  if (primaryOrg) {
    // legalName is more reliable than name (which is sometimes a person's name).
    if (primaryOrg.legalName) {
      out.business_name = primaryOrg.legalName;
      out.name = primaryOrg.legalName;
    } else if (primaryOrg.name && (!out.business_name || out.business_name.length > 60)) {
      out.business_name = primaryOrg.name;
      out.name = primaryOrg.name;
    }
    if (primaryOrg.logo) out.favicon_url = out.favicon_url || primaryOrg.logo;
    // Organization.address → service_area for local-business targeting.
    // (Audit finding #1: this is the BRAND's address, NOT the audience demographic.
    // We populate service_area, which the system prompt uses for geo-aware copy.)
    if (primaryOrg.address) out.service_area = primaryOrg.address;
    // Organization.description is often the cleanest one-sentence positioning
    // the site provides — better than the meta description because it's
    // explicitly written for machine consumption.
    if (primaryOrg.description) out.niche = primaryOrg.description;
    if (primaryOrg.sameAs?.length) {
      const social = bucketSocialFromUrls(primaryOrg.sameAs);
      if (Object.keys(social).length) out.social_links = { ...(out.social_links ?? {}), ...social };
    }
  }

  // 3. Niche fallback — meta description IS a one-sentence positioning.
  const desc = decodeEntities(meta.description || meta.og?.description || "").trim();
  if (desc && !out.niche) {
    out.niche = desc;
  }

  // 4. Industry — extracted from <title> by removing the brand part.
  if (meta.title && out.business_name) {
    const cleaned = decodeEntities(meta.title);
    const minusBrand = cleaned
      .replace(new RegExp(`\\s*[|\\-–—·:]\\s*${escapeRegex(out.business_name)}\\s*$`, "i"), "")
      .replace(new RegExp(`^\\s*${escapeRegex(out.business_name)}\\s*[|\\-–—·:]\\s*`, "i"), "")
      .trim();
    if (minusBrand && minusBrand !== cleaned && minusBrand.length < 200) {
      out.industry = minusBrand;
    }
  }

  // 5. USP — OG description usually IS the value-prop slogan.
  const ogDesc = decodeEntities(meta.og?.description || "").trim();
  if (ogDesc && ogDesc !== desc) {
    out.usp = ogDesc;
  } else if (desc && desc.length < 250 && !out.usp) {
    out.usp = desc;
  }

  // 6. Social links from footer anchor extraction (added on top of any
  //    JSON-LD sameAs values already merged above).
  if (meta.social_links && Object.values(meta.social_links).some((v) => v && String(v).trim())) {
    out.social_links = { ...(out.social_links ?? {}), ...(meta.social_links as any) };
  }

  // 7. FAQ schema → objections + objection_handling. FAQ questions ARE the
  //    customer's objections, almost verbatim. Answers are the brand's
  //    pre-written rebuttals. Zero AI needed.
  const faqs = (meta.json_ld ?? []).flatMap((ld) => extractFAQs(ld));
  if (faqs.length) {
    out.objections = faqs.map((f) => f.question);
    out.objection_handling = faqs.map((f) => f.answer);
  }

  // 8. Platforms — derived from which social_links have values.
  if (out.social_links) {
    const platformMap: Record<string, string> = {
      instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn",
      twitter: "X / Twitter", facebook: "Facebook", pinterest: "Pinterest", threads: "Threads",
    };
    const platforms = Object.entries(out.social_links)
      .filter(([, v]) => v && typeof v === "string" && v.trim())
      .map(([k]) => platformMap[k])
      .filter(Boolean);
    if (platforms.length) out.platforms = platforms;
  }

  // 9. Favicon — only when we don't already have a (higher-quality) logo.
  if (meta.favicon && !out.favicon_url) out.favicon_url = meta.favicon;

  return out;
}

interface ParsedOrganization {
  name?: string;
  legalName?: string;
  logo?: string;
  address?: string;
  description?: string;
  sameAs?: string[];
  email?: string;
  telephone?: string;
}

function extractOrganizations(ld: any, depth = 0): ParsedOrganization[] {
  const out: ParsedOrganization[] = [];
  if (!ld || depth > 10) return out; // guard against malformed nested @graph (audit finding #19)
  if (Array.isArray(ld)) { for (const x of ld) out.push(...extractOrganizations(x, depth + 1)); return out; }
  if (Array.isArray(ld["@graph"])) { for (const x of ld["@graph"]) out.push(...extractOrganizations(x, depth + 1)); }
  const types = Array.isArray(ld["@type"]) ? ld["@type"] : [ld["@type"]];
  if (types.some((t: any) => typeof t === "string" && /Organization|LocalBusiness|Corporation|Person/i.test(t))) {
    const logo = typeof ld.logo === "string" ? ld.logo : ld.logo?.url || ld.logo?.contentUrl;
    let address = "";
    if (ld.address) {
      if (typeof ld.address === "string") address = ld.address;
      else {
        const a = ld.address;
        address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
          .filter(Boolean).join(", ");
      }
    }
    const sameAs = Array.isArray(ld.sameAs) ? ld.sameAs.filter((x: any) => typeof x === "string") : (typeof ld.sameAs === "string" ? [ld.sameAs] : []);
    let telephone: string | undefined;
    if (ld.contactPoint) {
      const cp = Array.isArray(ld.contactPoint) ? ld.contactPoint[0] : ld.contactPoint;
      telephone = cp?.telephone;
    }
    if (!telephone && typeof ld.telephone === "string") telephone = ld.telephone;
    out.push({
      name: typeof ld.name === "string" ? ld.name : undefined,
      legalName: typeof ld.legalName === "string" ? ld.legalName : undefined,
      logo,
      address,
      description: typeof ld.description === "string" ? ld.description : undefined,
      sameAs,
      email: typeof ld.email === "string" ? ld.email : undefined,
      telephone,
    });
  }
  return out;
}

function extractFAQs(ld: any, depth = 0): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  if (!ld || depth > 10) return out;
  if (Array.isArray(ld)) { for (const x of ld) out.push(...extractFAQs(x, depth + 1)); return out; }
  if (Array.isArray(ld["@graph"])) { for (const x of ld["@graph"]) out.push(...extractFAQs(x, depth + 1)); }
  const types = Array.isArray(ld["@type"]) ? ld["@type"] : [ld["@type"]];
  if (types.some((t: any) => typeof t === "string" && /FAQPage/i.test(t)) && Array.isArray(ld.mainEntity)) {
    for (const q of ld.mainEntity) {
      if (q?.name && q.acceptedAnswer?.text) {
        out.push({ question: String(q.name), answer: String(q.acceptedAnswer.text) });
      }
    }
  }
  return out;
}

function bucketSocialFromUrls(urls: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of urls) {
    let u: URL;
    try { u = new URL(raw); } catch { continue; }
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const url = u.toString();
    if (!out.facebook && /(^|\.)facebook\.com$/.test(host)) out.facebook = url;
    else if (!out.instagram && /(^|\.)instagram\.com$/.test(host)) out.instagram = url;
    else if (!out.twitter && (/(^|\.)twitter\.com$/.test(host) || /(^|\.)x\.com$/.test(host))) out.twitter = url;
    else if (!out.linkedin && /(^|\.)linkedin\.com$/.test(host)) out.linkedin = url;
    else if (!out.youtube && (/(^|\.)youtube\.com$/.test(host) || /(^|\.)youtu\.be$/.test(host))) out.youtube = url;
    else if (!out.tiktok && /(^|\.)tiktok\.com$/.test(host)) out.tiktok = url;
    else if (!out.pinterest && /(^|\.)pinterest\.com$/.test(host)) out.pinterest = url;
    else if (!out.threads && /(^|\.)threads\.net$/.test(host)) out.threads = url;
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
