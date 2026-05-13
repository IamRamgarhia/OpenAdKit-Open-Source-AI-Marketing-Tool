import type { Platform } from "./storage";

export interface NextStep {
  href: string;
  label: string;
  reason: string;
  /** Optional query params (passed through). Page-side reads them with useSearchParams. */
  carry?: Record<string, string>;
}

/**
 * Given a freshly generated asset, return 3-5 follow-up tools that make
 * sense in context. Mapping is deterministic, brand-aware, and tied to
 * the user's actual workflow ("you just made a Meta ad → here are the
 * 3 things people do next: score it, plan an A/B test, generate hashtags").
 *
 * Used by GeneratorShell to render a "What's next" footer after save.
 */
export function suggestNextSteps(args: {
  platform: Platform;
  campaign_type: string;
  ad_id: string;
}): NextStep[] {
  const { platform, campaign_type, ad_id } = args;
  const carry = { ad_id };

  // Optimizer outputs → push toward Generate or A/B
  if (/optimize|optimizer|improve|score/i.test(campaign_type)) {
    return [
      { href: `/generate/${platform}`, label: `Apply rewrite as a new ${platform} variant`, reason: "Take the AI's rewrite and ship it as a new ad", carry },
      { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Run the rewrite against the original" },
      { href: "/campaigns", label: "Save to a campaign", reason: "Group this with related work" },
    ];
  }

  // Platform-specific next-steps for new ad generations
  const byPlatform: Record<string, NextStep[]> = {
    meta: [
      { href: "/generate/reel-ideas", label: "Reel ideas for this brand", reason: "Same pillars, hook-first variants for Reels", carry: { ...carry, platform: "instagram_reels" } },
      { href: "/optimize/creative-score", label: "Score the creative", reason: "Before you spend, predict performance" },
      { href: "/optimize/ctr", label: "CTR Optimizer", reason: "Tear down + rewrite specific levers", carry: { ...carry, platform: "Meta Feed" } },
      { href: "/generate/hashtags", label: "Generate hashtags", reason: "Layer in 5-10 niche hashtags" },
      { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test this against a variant" },
      { href: "/optimize/audience", label: "Audience targeting", reason: "Lock in who sees it" },
    ],
    google: [
      { href: "/optimize/quality-score", label: "Quality Score Improver", reason: "Lift QS → lower CPC" },
      { href: "/optimize/keywords", label: "Keyword Builder", reason: "Expand the keyword set" },
      { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Match LP to the ad promise" },
      { href: "/optimize/bid-strategy", label: "Bid Strategy", reason: "Pick the right bid for the goal", carry: { ...carry, platform: "Google" } },
      { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test headline variants" },
    ],
    tiktok: [
      { href: "/generate/reel-ideas", label: "Organic Reel ideas", reason: "Cheaper reach — generate 12 ideas using the same brand brain", carry: { ...carry, platform: "tiktok" } },
      { href: "/generate/spark-ads", label: "Spark Ads variant", reason: "Boost a creator post instead of running standalone" },
      { href: "/optimize/creative-score", label: "Score the creative", reason: "Hook-strength check before spend" },
      { href: "/generate/hashtags", label: "Hashtags", reason: "Trending + niche stack" },
      { href: "/optimize/ad-fatigue", label: "Ad Fatigue plan", reason: "TikTok burns ads fast — plan refreshes" },
    ],
    linkedin: [
      { href: "/generate/lead-form", label: "Lead Form", reason: "Capture the click with native form" },
      { href: "/optimize/audience", label: "Audience targeting", reason: "Tighten job-title + company-size filters" },
      { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "B2B LPs need different proof — recheck yours" },
      { href: "/optimize/ctr", label: "CTR Optimizer", reason: "LinkedIn CTRs run lower; squeeze every lever", carry: { ...carry, platform: "LinkedIn Sponsored" } },
    ],
    youtube: [
      { href: "/optimize/creative-score", label: "Score the creative", reason: "Predict skip-through risk before launch" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Generate the visual brief next" },
    ],
    twitter: [
      { href: "/generate/hashtags", label: "Hashtags", reason: "X is less hashtag-driven — keep it to 1-2" },
      { href: "/generate/content-calendar", label: "Content Calendar", reason: "Plan organic posts around the ad" },
    ],
    display: [
      { href: "/optimize/creative-score", label: "Score the creative", reason: "Display lives or dies on visual clarity" },
      { href: "/optimize/ctr", label: "CTR Optimizer", reason: "Display CTRs are tiny — every pixel matters", carry: { ...carry, platform: "Google Display" } },
      { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Cold display traffic needs a strong LP" },
    ],
  };

  return byPlatform[platform] ?? [
    { href: "/optimize/creative-score", label: "Score the creative", reason: "Universal pre-launch check" },
    { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test before you scale" },
    { href: "/campaigns", label: "Save to a campaign", reason: "Group this with related work" },
  ];
}

/** Stash the most recent asset in localStorage so the Dashboard + headers can show it. */
export function rememberLastGenerated(meta: {
  id: string;
  title: string;
  platform: Platform;
  campaign_type: string;
  brand_id: string;
  saved_at: number;
}): void {
  try {
    localStorage.setItem("ados.last_generated", JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent("ados:last-generated-changed", { detail: meta }));
  } catch {
    /* ignore */
  }
}

export interface LastGenerated {
  id: string;
  title: string;
  platform: Platform;
  campaign_type: string;
  brand_id: string;
  saved_at: number;
}

export function getLastGenerated(): LastGenerated | null {
  try {
    const raw = localStorage.getItem("ados.last_generated");
    return raw ? (JSON.parse(raw) as LastGenerated) : null;
  } catch {
    return null;
  }
}
