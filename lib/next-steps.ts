import type { Platform } from "./storage";

export interface NextStep {
  href: string;
  label: string;
  reason: string;
  /** Optional query params (passed through). Page-side reads them with useSearchParams. */
  carry?: Record<string, string>;
}

/**
 * Query keys that are NOT form fields: `ad_id` lets the receiving generator
 * hydrate its form from the saved ad (GeneratorShell reads it), `add` asks
 * /campaigns to offer the just-saved ad for assignment. Every other carry key
 * must be a real field on the target page with a real option value —
 * lib/__tests__/nav-config.test.ts enforces that.
 */
export const NON_FIELD_CARRY_KEYS = new Set(["ad_id", "add"]);

/** Universal last step: lands on /campaigns with the ad pre-offered. */
function campaignStep(ad_id: string): NextStep {
  return {
    href: "/campaigns",
    label: "Add to a campaign",
    reason: "Group this with related work for hand-off",
    carry: { add: ad_id },
  };
}

/** Normalise a pathname / scope to the bare route, e.g. "/generate/meta/" → "generate/meta". */
export function normalizeRoute(route: string): string {
  return route.split("?")[0].replace(/^\/+|\/+$/g, "");
}

/**
 * Map a free-text platform label (an optimizer's "Meta Feed", "Google
 * Search", "LinkedIn Sponsored" …) to the generator that writes that format.
 */
export function generatorForPlatformLabel(label: unknown, fallback = "/generate/meta"): string {
  const l = String(label ?? "").toLowerCase();
  if (l.includes("display")) return "/generate/display";
  if (l.includes("google")) return "/generate/google";
  if (l.includes("meta") || l.includes("facebook") || l.includes("instagram")) return "/generate/meta";
  if (l.includes("tiktok")) return "/generate/tiktok";
  if (l.includes("linkedin")) return "/generate/linkedin";
  if (l.includes("youtube")) return "/generate/youtube";
  if (l.includes("twitter") || l === "x") return "/generate/twitter";
  return fallback;
}

/** Storage platform for a free-text format label ("TikTok In-Feed", "Twitter / X"…). */
export function storagePlatformForLabel(label: unknown, fallback: Platform = "meta"): Platform {
  const l = String(label ?? "").toLowerCase();
  if (l.includes("display")) return "display";
  if (l.includes("google")) return "google";
  if (l.includes("meta") || l.includes("facebook") || l.includes("instagram")) return "meta";
  if (l.includes("tiktok")) return "tiktok";
  if (l.includes("linkedin")) return "linkedin";
  if (l.includes("youtube")) return "youtube";
  if (l.includes("twitter") || /(^|[^a-z])x([^a-z]|$)/.test(l)) return "twitter";
  return fallback;
}

/** Storage platform for a hashtags-generator input value. */
export function platformForHashtagInput(v: unknown): Platform {
  switch (String(v ?? "")) {
    case "tiktok":
      return "tiktok";
    case "twitter":
      return "twitter";
    case "linkedin":
      return "linkedin";
    case "youtube":
      return "youtube";
    // instagram / pinterest / any → closest stored bucket is meta (IG is Meta).
    default:
      return "meta";
  }
}

/** Storage platform for a reel-ideas input value. */
export function platformForReelInput(v: unknown): Platform {
  switch (String(v ?? "")) {
    case "tiktok":
      return "tiktok";
    case "youtube_shorts":
      return "youtube";
    default:
      // instagram_reels / facebook_reels
      return "meta";
  }
}

const REEL_TO_HASHTAG: Record<string, string> = {
  instagram_reels: "instagram",
  facebook_reels: "instagram",
  tiktok: "tiktok",
  youtube_shorts: "youtube",
};
const REEL_TO_PROMPT_FORMAT: Record<string, string> = {
  instagram_reels: "Instagram Reels",
  facebook_reels: "Meta Reels / Stories",
  tiktok: "TikTok In-Feed",
  youtube_shorts: "YouTube Shorts",
};
const HASHTAG_TO_REEL: Record<string, string> = {
  instagram: "instagram_reels",
  tiktok: "tiktok",
  youtube: "youtube_shorts",
};
const AUDIENCE_PLATFORMS = ["meta", "google", "linkedin", "tiktok"];

/**
 * Given a freshly saved asset, return follow-up tools that make sense for
 * THAT tool's output.
 *
 * Keyed by the route that produced it (not by `platform`): many tools store a
 * nominal platform ("google" for the A/B planner, keyword plan, LP grader…),
 * so a platform-keyed table sent users from the Keyword Plan back to the
 * Keyword Builder they had just used, from the LP grade to the LP grader, etc.
 * A regex over campaign_type also misfired ("QS Improve" matched /improve/).
 *
 * Rules: never link a tool to itself; every carry value must be an option the
 * target page actually offers; always end with "Add to a campaign".
 */
export function suggestNextSteps(args: {
  route: string;
  ad_id: string;
  input?: Record<string, unknown>;
}): NextStep[] {
  const route = normalizeRoute(args.route);
  const { ad_id } = args;
  const input = args.input ?? {};
  const withAd = { ad_id };
  let steps: NextStep[];
  switch (route) {
    // ---------------- generators ----------------
    case "generate/meta":
      steps = [
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Before you spend, predict performance", carry: { ...withAd, platform: "Meta Feed" } },
        { href: "/optimize/ctr", label: "CTR Optimizer", reason: "Tear down + rewrite specific levers", carry: { ...withAd, platform: "Meta Feed" } },
        { href: "/generate/reel-ideas", label: "Reel ideas for this brand", reason: "Same pillars, hook-first variants for Reels", carry: { platform: "instagram_reels" } },
        { href: "/generate/hashtags", label: "Generate hashtags", reason: "Layer in 5-10 niche hashtags", carry: { platform: "instagram" } },
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test this against a variant", carry: { platform: "Meta Feed" } },
        { href: "/optimize/audience", label: "Audience targeting", reason: "Lock in who sees it", carry: { platform: "meta" } },
      ];
      break;
    case "generate/google":
      steps = [
        { href: "/optimize/quality-score", label: "Quality Score Improver", reason: "Lift QS → lower CPC", carry: withAd },
        { href: "/optimize/keywords", label: "Keyword Builder", reason: "Expand the keyword set" },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Match LP to the ad promise" },
        { href: "/optimize/bid-strategy", label: "Bid Strategy", reason: "Pick the right bid for the goal", carry: { platform: "Google Ads" } },
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test headline variants", carry: { platform: "Google Search" } },
      ];
      break;
    case "generate/google-pmax":
    case "generate/google-shopping":
      steps = [
        { href: "/optimize/bid-strategy", label: "Bid Strategy", reason: "PMax/Shopping live or die on the bid target", carry: { platform: "Google Ads" } },
        { href: "/optimize/budget-planner", label: "Budget Planner", reason: "Size the daily budget before launch" },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Feed/asset promise must match the page" },
        { href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Asset groups need visuals", carry: { platform: "Google Performance Max" } },
      ];
      break;
    case "generate/tiktok":
      steps = [
        { href: "/generate/reel-ideas", label: "Organic Reel ideas", reason: "Cheaper reach — generate ideas from the same brand brain", carry: { platform: "tiktok" } },
        { href: "/generate/spark-ads", label: "Spark Ads variant", reason: "Boost a creator post instead of running standalone" },
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Hook-strength check before spend", carry: { ...withAd, platform: "TikTok In-Feed" } },
        { href: "/generate/hashtags", label: "Hashtags", reason: "Trending + niche stack", carry: { platform: "tiktok" } },
        { href: "/optimize/ad-fatigue", label: "Ad Fatigue plan", reason: "TikTok burns ads fast — plan refreshes", carry: { platform: "TikTok In-Feed" } },
      ];
      break;
    case "generate/spark-ads":
      steps = [
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Hook-strength check before boosting", carry: { platform: "TikTok In-Feed" } },
        { href: "/generate/hashtags", label: "Hashtags", reason: "Trending + niche stack", carry: { platform: "tiktok" } },
        { href: "/optimize/ad-fatigue", label: "Ad Fatigue plan", reason: "Plan refreshes before the post burns out", carry: { platform: "TikTok In-Feed" } },
      ];
      break;
    case "generate/branded-hashtag-challenge":
      steps = [
        { href: "/generate/reel-ideas", label: "Reel ideas", reason: "Seed the challenge with your own entries", carry: { platform: "tiktok" } },
        { href: "/generate/hashtags", label: "Hashtags", reason: "Supporting tags around the branded one", carry: { platform: "tiktok" } },
      ];
      break;
    case "generate/linkedin":
      steps = [
        { href: "/generate/lead-form", label: "Lead Form", reason: "Capture the click with a native form", carry: { platform: "linkedin" } },
        { href: "/optimize/audience", label: "Audience targeting", reason: "Tighten job-title + company-size filters", carry: { platform: "linkedin" } },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "B2B LPs need different proof — recheck yours" },
        { href: "/optimize/ctr", label: "CTR Optimizer", reason: "LinkedIn CTRs run lower; squeeze every lever", carry: { ...withAd, platform: "LinkedIn Sponsored" } },
      ];
      break;
    case "generate/youtube":
      steps = [
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Predict skip-through risk before launch", carry: { ...withAd, platform: "YouTube In-Stream" } },
        { href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Generate the visual brief next", carry: { platform: "YouTube In-Stream" } },
      ];
      break;
    case "generate/twitter":
      steps = [
        { href: "/generate/hashtags", label: "Hashtags", reason: "X is less hashtag-driven — keep it to 1-2", carry: { platform: "twitter" } },
        { href: "/generate/content-calendar", label: "Content Calendar", reason: "Plan organic posts around the ad" },
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Sanity-check the hook before spend", carry: { ...withAd, platform: "Twitter/X" } },
      ];
      break;
    case "generate/display":
      steps = [
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Display lives or dies on visual clarity", carry: { ...withAd, platform: "Google Display" } },
        { href: "/optimize/ctr", label: "CTR Optimizer", reason: "Display CTRs are tiny — every pixel matters", carry: { ...withAd, platform: "Google Display" } },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Cold display traffic needs a strong LP" },
        { href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Brief the banner visuals", carry: { platform: "Google Display" } },
      ];
      break;
    case "generate/hashtags": {
      const reel = HASHTAG_TO_REEL[String(input.platform ?? "")];
      steps = [
        ...(reel ? [{ href: "/generate/reel-ideas", label: "Reel ideas", reason: "Put the tags to work on hook-first short video", carry: { platform: reel } }] : []),
        { href: "/generate/content-calendar", label: "Content Calendar", reason: "Schedule posts that use this tag stack" },
      ];
      break;
    }
    case "generate/reel-ideas": {
      const p = String(input.platform ?? "");
      const tag = REEL_TO_HASHTAG[p];
      const fmt = REEL_TO_PROMPT_FORMAT[p];
      steps = [
        ...(tag ? [{ href: "/generate/hashtags", label: "Hashtags for these reels", reason: "Tiered tag stack for the same platform", carry: { platform: tag } }] : []),
        ...(fmt ? [{ href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Turn the visual briefs into tool-ready prompts", carry: { platform: fmt } }] : []),
        { href: "/generate/content-calendar", label: "Content Calendar", reason: "Slot the ideas into a posting plan" },
      ];
      break;
    }
    case "generate/email-subjects":
      steps = [
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Subject lines are the cheapest thing to split-test" },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Make the click-through page match the subject's promise" },
      ];
      break;
    case "generate/lead-form": {
      const p = String(input.platform ?? "");
      steps = [
        ...(AUDIENCE_PLATFORMS.includes(p) ? [{ href: "/optimize/audience", label: "Audience targeting", reason: "Decide who gets the form", carry: { platform: p } }] : []),
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Compare against a landing-page flow" },
      ];
      break;
    }
    case "generate/content-calendar":
      steps = [
        { href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Brief the visuals for each post" },
        { href: "/generate/hashtags", label: "Hashtags", reason: "Build a reusable tag stack" },
      ];
      break;
    case "generate/creative-prompts":
      steps = [{ href: "/optimize/creative-score", label: "Score the creative", reason: "Check the concept before you render it" }];
      break;
    case "generate/campaign-kit":
      steps = [
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Pressure-test the strongest angle" },
        { href: "/optimize/budget-planner", label: "Budget Planner", reason: "Split spend across the platforms in the kit" },
      ];
      break;

    // ---------------- optimizers ----------------
    case "optimize/ctr":
    case "optimize/creative-score":
      steps = [
        {
          href: generatorForPlatformLabel(input.platform),
          label: "Apply rewrite as a new variant",
          reason: "Open the generator pre-filled from this run and ship the rewrite as a new ad",
          carry: withAd,
        },
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Run the rewrite against the original" },
      ];
      break;
    case "optimize/quality-score":
      steps = [
        { href: "/generate/google", label: "Apply rewrite as a new variant", reason: "Open the RSA generator pre-filled from this run", carry: withAd },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Landing-page experience is one of the three QS factors" },
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Run the rewrite against the original", carry: { platform: "Google Search" } },
      ];
      break;
    case "optimize/keywords":
      steps = [
        { href: "/generate/google", label: "Write RSAs for these keywords", reason: "Turn the plan into ads per ad group" },
        { href: "/optimize/quality-score", label: "Quality Score Improver", reason: "Check ad/keyword relevance" },
        { href: "/optimize/landing-page", label: "Landing Page Optimizer", reason: "Match the page to the keyword intent" },
      ];
      break;
    case "optimize/landing-page":
      steps = [
        { href: "/optimize/quality-score", label: "Quality Score Improver", reason: "A better page lifts landing-page experience" },
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test the old page against the fixes" },
      ];
      break;
    case "optimize/bid-strategy":
      steps = [
        { href: "/optimize/budget-planner", label: "Budget Planner", reason: "Size the budget the bid strategy needs" },
        { href: "/optimize/budget", label: "Budget Waste audit", reason: "Find spend that isn't converting" },
      ];
      break;
    case "optimize/budget-planner":
      steps = [
        { href: "/optimize/bid-strategy", label: "Bid Strategy", reason: "Pick the bidding that fits this budget" },
        { href: "/optimize/budget", label: "Budget Waste audit", reason: "Once live, find the leaks" },
      ];
      break;
    case "optimize/budget":
      steps = [
        { href: "/optimize/bid-strategy", label: "Bid Strategy", reason: "Fix the bidding that let waste through" },
        { href: "/optimize/keywords", label: "Keyword Builder", reason: "Rebuild negatives + match types" },
      ];
      break;
    case "optimize/ab-test":
      steps = [{ href: "/optimize/creative-score", label: "Score the creative", reason: "Score both variants before launching the test" }];
      break;
    case "optimize/audience": {
      const gen = generatorForPlatformLabel(input.platform, "");
      steps = [
        ...(gen ? [{ href: gen, label: "Write ads for this audience", reason: "Generate copy aimed at the segments above" }] : []),
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Check fit with the new audience" },
      ];
      break;
    }
    case "optimize/ad-fatigue":
      steps = [
        { href: "/generate/creative-prompts", label: "Image / Video Prompts", reason: "Fresh visuals for the refresh cycle" },
        { href: generatorForPlatformLabel(input.platform), label: "Write replacement variants", reason: "New copy for the refresh schedule" },
      ];
      break;
    default:
      steps = [
        { href: "/optimize/creative-score", label: "Score the creative", reason: "Universal pre-launch check" },
        { href: "/optimize/ab-test", label: "Plan an A/B test", reason: "Test before you scale" },
      ];
  }

  // Defensive: never link a tool to itself.
  return [...steps.filter((s) => normalizeRoute(s.href) !== route), campaignStep(ad_id)];
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
