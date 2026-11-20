/**
 * Prompt-quality regressions found by running every tool in MCP prompt mode:
 * unsourced statistics stated as fact, proof the brand may not have, rules
 * that contradict each other, and market blind spots.
 */
import { describe, it, expect } from "vitest";
import { buildTwitterPrompt } from "../prompts/twitter-ads";
import { buildSparkAdsPrompt } from "../prompts/tiktok-spark";
import { buildBhcPrompt } from "../prompts/tiktok-bhc";
import { buildTikTokPrompt } from "../prompts/tiktok-ads";
import { buildYouTubePrompt } from "../prompts/youtube-ads";
import { buildCampaignKitPrompt } from "../prompts/campaign-kit";
import { buildLeadFormPrompt } from "../prompts/lead-form";
import { buildDisplayPrompt } from "../prompts/display-ads";
import { buildHashtagPrompt } from "../prompts/hashtags";
import { buildContentCalendarPrompt } from "../prompts/content-calendar";
import { buildReelIdeasPrompt } from "../prompts/reel-ideas";
import { buildPmaxPrompt } from "../prompts/google-pmax";
import { buildShoppingPrompt } from "../prompts/google-shopping";
import { buildCompetitorStealPrompt } from "../prompts/competitor-steal";
import { buildLandingPrompt } from "../prompts/landing-page";
import { buildAudienceTargetingPrompt } from "../prompts/audience-targeting";
import { buildCtrPrompt } from "../prompts/ctr-optimizer";
import { buildBudgetWastePrompt } from "../prompts/budget-waste";
import { FRAMEWORK_STACK } from "../prompts/framework-stack";
import { VIDEO_HOOK_RULE, MANDATORY_EXCLUSIONS, RETIRE_THRESHOLD_RULE, PRICING_PSYCHOLOGY, BANNED_WORDS, hasPriceOrOffer } from "../prompts/common-rules";
import { buildBrandSystemPrompt, normalizeBrandBrain } from "../brand-brain";

/** Unsourced figures the evaluators found stated as fact. */
const CONCEPT_EXAMPLE_STATS = ["12-18%", "85%", "30% lower CPM", "~3% CTR", "$100k", "5-10%", "16-28%", "4.99", "2025", "≥ 30%"];

const brand = (over: Record<string, unknown> = {}) =>
  normalizeBrandBrain({ id: "b", name: "Leaf", business_name: "Leaf & Co", platforms: ["Instagram", "Meta"], ...over } as never);

describe("A · no unsourced statistics stated as fact", () => {
  const prompts: Record<string, string> = {
    framework: FRAMEWORK_STACK,
    video: VIDEO_HOOK_RULE,
    spark: buildSparkAdsPrompt({ product: "p", audience: "a", organic_post_context: "c", brand_voice: "v" }),
    bhc: buildBhcPrompt({ brand: "b", product_or_message: "m", target_audience: "a", budget_band: "100k_300k", desired_action: "d", geo: "US" }),
    lead: buildLeadFormPrompt({ platform: "meta", offer: "o", audience_role: "r", what_we_do_with_lead: "w", sales_motion: "hybrid" }),
    youtube: buildYouTubePrompt({ format: "in_stream", product: "p", goal: "g" }),
    ctr: buildCtrPrompt({ platform: "Google Search", industry: "x", current_copy: "c" }),
  };
  it.each(CONCEPT_EXAMPLE_STATS)("no prompt contains %s", (phrase) => {
    for (const [name, p] of Object.entries(prompts)) expect(p, name).not.toContain(phrase);
  });
});

describe("B · proof only from the brand brain", () => {
  it.each([
    ["tiktok hooks", buildTikTokPrompt({ product: "p", audience: "a", format: "hooks", vibe: "" })],
    ["spark", buildSparkAdsPrompt({ product: "p", audience: "a", organic_post_context: "c", brand_voice: "v" })],
    ["bhc", buildBhcPrompt({ brand: "b", product_or_message: "m", target_audience: "a", budget_band: "100k_300k", desired_action: "d", geo: "US" })],
    ["youtube", buildYouTubePrompt({ format: "in_stream", product: "p", goal: "g" })],
    ["twitter", buildTwitterPrompt({ format: "promoted_tweet", product: "p", objective: "o", voice: "" })],
    ["campaign kit", buildCampaignKitPrompt({ campaign_name: "c", product: "p", primary_offer: "o", audience: "a", goal: "g", budget_monthly: "1000" })],
  ])("%s includes the anti-fabrication + proof rules", (_n, p) => {
    expect(p).toContain("ANTI-FABRICATION");
    expect(p).toContain("PROOF + URGENCY ONLY FROM REAL INPUTS");
  });
  it("TikTok hooks drop 'shocking stat' and the invented 30-day trial", () => {
    const p = buildTikTokPrompt({ product: "p", audience: "a", format: "hooks", vibe: "" });
    expect(p).not.toMatch(/Shocking stat/i);
    expect(p).not.toContain("I tried ___ for 30 days");
  });
  it("PMax / Shopping / YouTube make proof conditional", () => {
    expect(buildPmaxPrompt({ goal: "g", product: "p", audience: "a", business_name: "b" })).toMatch(/only if the brand brain (or input )?lists/i);
    expect(buildShoppingPrompt({ product_title: "t", current_description: "d", brand: "b", product_category: "c", attributes: "a", price: "" })).toMatch(/only if the brand brain (or input )?lists/i);
    expect(buildYouTubePrompt({ format: "in_stream", product: "p", goal: "g" })).toMatch(/only if the brand brain (or input )?lists/i);
  });
  it("campaign-kit KPI targets must state a basis or be labelled estimate", () => {
    expect(buildCampaignKitPrompt({ campaign_name: "c", product: "p", primary_offer: "o", audience: "a", goal: "g", budget_monthly: "1000" })).toMatch(/basis/);
  });
  it("framework stack: specifics from the brand brain, urgency only with a real deadline", () => {
    expect(FRAMEWORK_STACK).toMatch(/real deadline/i);
    expect(FRAMEWORK_STACK).not.toMatch(/numbers, names, dates/);
  });
  it("reel ideas: NUMBER + PROMISE only with real results", () => {
    const p = buildReelIdeasPrompt({ platform: "instagram_reels", reel_count: 6, duration_seconds: 20, goal: "followers", pillars: "" });
    expect(p).toMatch(/NUMBER \+ PROMISE[^\n]*only/);
  });
});

describe("C · X / Twitter generator", () => {
  it("states link weighting and per-format specs", () => {
    const card = buildTwitterPrompt({ format: "website_card", product: "p", objective: "o", voice: "", landing_url: "https://x.example" });
    expect(card).toContain("counts as exactly 23");
    expect(card).toMatch(/card headline: ≤ 70/);
    expect(card).toContain('"website_card_title": "string ≤ 70 chars"');
    const video = buildTwitterPrompt({ format: "promoted_video", product: "p", objective: "o", voice: "" });
    expect(video).toMatch(/caption shown above the video/);
    expect(buildTwitterPrompt({ format: "follower_ad", product: "p", objective: "o", voice: "" })).toMatch(/promotes the account/);
  });
  it("1-2 hashtags, no invented URL, time window only with a geo", () => {
    const p = buildTwitterPrompt({ format: "promoted_tweet", product: "p", objective: "o", voice: "" });
    expect(p).toMatch(/0-2 per post/);
    expect(p).toContain("do not invent one");
    expect(p).toContain('"best_time_window_utc": ""');
    const g = buildTwitterPrompt({ format: "promoted_tweet", product: "p", objective: "o", voice: "", audience_geo: "India" });
    expect(g).toMatch(/audience in India/);
  });
  it("angle 'stat' became a brand-brain fact", () => {
    const p = buildTwitterPrompt({ format: "promoted_tweet", product: "p", objective: "o", voice: "" });
    expect(p).not.toMatch(/\| stat \|/);
    expect(p).toContain("specific_fact");
  });
});

describe("E · contradictions resolved", () => {
  it("display: no '8-10 words', CTA key matches the schema, long CTA gets shortened", () => {
    const p = buildDisplayPrompt({ product: "p", goal: "g", brand_promise: "b", cta: "Book a free scan today" });
    expect(p).not.toMatch(/8-10 words/);
    expect(p).not.toContain("cta_button_text");
    expect(p).toMatch(/shorten it to ≤ 12/i);
  });
  it("hashtags: schema key + Instagram cap of 5", () => {
    const p = buildHashtagPrompt({ title: "t", platform: "instagram", language: "English" });
    expect(p).toContain('"recommended_set"');
    expect(p).not.toContain("recommended_set_for_");
    expect(p).not.toMatch(/~30/);
    expect(p).toMatch(/Instagram: up to 5/);
  });
  it("content calendar: per-platform hashtag counts, currency-neutral budget example", () => {
    const p = buildContentCalendarPrompt({ duration: "1_week", cadence_per_week: 3, platforms: "Instagram", pillars: "x", primary_goal: "g", voice_notes: "", posting_window: "", region_or_timezone: "" });
    expect(p).not.toMatch(/5-10 hashtags|5-10 niche/);
    expect(p).not.toContain("$30");
    expect(p).toMatch(/Instagram: up to 5/);
  });
  it("lead form: one question budget for high-touch", () => {
    const p = buildLeadFormPrompt({ platform: "linkedin", offer: "o", audience_role: "r", what_we_do_with_lead: "w", sales_motion: "high_touch_sales" });
    expect(p).not.toMatch(/4-5 with/);
  });
  it("youtube hook window matches the shared 0-3s rule", () => {
    const p = buildYouTubePrompt({ format: "in_stream", product: "p", goal: "g" });
    expect(p).not.toMatch(/0–5s/);
    expect(p).not.toContain("≥ 30%");
  });
  it("reel ideas: duration follows the target; TikTok terms only for TikTok", () => {
    const p = buildReelIdeasPrompt({ platform: "instagram_reels", reel_count: 6, duration_seconds: 20, goal: "followers", pillars: "" });
    expect(p).toMatch(/15-25s/);
    expect(p).not.toMatch(/45-90s/);
    expect(p).not.toContain("FYP");
    expect(buildReelIdeasPrompt({ platform: "tiktok", reel_count: 6, duration_seconds: "", goal: "g", pillars: "" })).toContain("FYP");
  });
  it("retire rule has one impression threshold", () => {
    expect(RETIRE_THRESHOLD_RULE).not.toMatch(/200 impressions/);
  });
  it("exclusions are platform-aware and use one converter window", () => {
    expect(MANDATORY_EXCLUSIONS).toMatch(/Meta: Custom Audience/);
    const meta = buildAudienceTargetingPrompt({ platform: "meta", product: "p", audience_who: "a", budget_monthly: "1", geo: "g", goal: "g" });
    expect(meta).not.toMatch(/last 30 days for sales, last 7 for trial/);
    expect(meta).toContain("Custom Audience from a customer list");
  });
});

describe("F · currency-neutral, pricing only with a price", () => {
  it("pricing psychology has no dollar figures", () => {
    expect(PRICING_PSYCHOLOGY).not.toMatch(/\$\d/);
  });
  it("is injected only when the input carries a price or offer", () => {
    expect(hasPriceOrOffer("Free 14-day trial")).toBe(true);
    expect(hasPriceOrOffer("₹649")).toBe(true);
    expect(hasPriceOrOffer("Approvals inside Slack")).toBe(false);
    const lp = (promise: string) => buildLandingPrompt({ ad_promise: promise, landing_copy: "Welcome", audience: "a" });
    expect(lp("Approvals inside Slack")).not.toContain("PRICING PSYCHOLOGY");
    expect(lp("20% off your first order")).toContain("PRICING PSYCHOLOGY");
    const cs = (ads: string) => buildCompetitorStealPrompt({ our_product: "p", our_usp: "u", competitor_name: "c", competitor_ads_pasted: ads, platform: "LinkedIn" });
    expect(cs("Automate payables. Get a demo.")).not.toContain("PRICING PSYCHOLOGY");
    expect(cs("Plans from $49/month")).toContain("PRICING PSYCHOLOGY");
  });
  it("audience targeting examples carry no $ sign", () => {
    const p = buildAudienceTargetingPrompt({ platform: "meta", product: "p", audience_who: "a", budget_monthly: "1", geo: "g", goal: "g" });
    expect(p).not.toMatch(/\$\d/);
  });
  it("spark ads: spend cap is in the brand's currency", () => {
    expect(buildSparkAdsPrompt({ product: "p", audience: "a", organic_post_context: "c", brand_voice: "v" })).toMatch(/brand's currency/);
  });
  it("budget waste mentions the _usd keys only for non-USD", () => {
    expect(buildBudgetWastePrompt({ platform: "Google Ads", monthly_spend: "1", campaign_summary: "x" })).not.toMatch(/_usd" for backwards/);
  });
});

describe("J · market blind spots", () => {
  it("TikTok challenge flags India (TikTok is banned there)", () => {
    const p = buildBhcPrompt({ brand: "b", product_or_message: "m", target_audience: "a", budget_band: "100k_300k", desired_action: "d", geo: "India" });
    expect(p).toMatch(/TikTok is not available in India/);
    expect(p).toMatch(/Reels|Shorts/);
    expect(buildBhcPrompt({ brand: "b", product_or_message: "m", target_audience: "a", budget_band: "100k_300k", desired_action: "d", geo: "US" })).not.toMatch(/not available in India/);
  });
  it("hashtag conflicts are marked unverified", () => {
    expect(buildBhcPrompt({ brand: "b", product_or_message: "m", target_audience: "a", budget_band: "100k_300k", desired_action: "d", geo: "US" })).toMatch(/unverified — check before launch/);
  });
  it("campaign kit derives surfaces from the brand platforms and geo", () => {
    const p = buildCampaignKitPrompt({ campaign_name: "c", product: "p", primary_offer: "o", audience: "Working adults in Pune", goal: "g", budget_monthly: "₹60,000" }, brand({ platforms: ["Meta", "Google Search", "Instagram"], service_area: "Pune" }));
    expect(p).toMatch(/TikTok is not available in India/);
    expect(p).toMatch(/0%/);
    expect(p).not.toMatch(/% split across Google \/ Meta \/ TikTok \/ LinkedIn \/ YouTube/);
  });
});

describe("K · banned words single source", () => {
  it("system prompt renders every BANNED_WORDS entry", () => {
    const sys = buildBrandSystemPrompt(brand({ tone: "warm" }));
    for (const w of [...BANNED_WORDS.vague_verbs, ...BANNED_WORDS.hedge_words, ...BANNED_WORDS.weak_ctas, ...BANNED_WORDS.superlatives_without_proof]) expect(sys).toContain(w);
  });
});

describe("L · no framework_meta instruction the templates never carry", () => {
  it("framework stack doesn't ask for ad_meta / framework_meta", () => {
    expect(FRAMEWORK_STACK).not.toMatch(/"ad_meta"|"framework_meta"/);
  });
});

describe("N · '(from screenshot)' only with an image", () => {
  it("audience + keyword prompts", async () => {
    const { buildKeywordPrompt } = await import("../prompts/keyword-strategy");
    expect(buildAudienceTargetingPrompt({ platform: "meta", product: "p", audience_who: "a", budget_monthly: "1", geo: "g", goal: "g" })).not.toMatch(/screenshot/i);
    expect(buildKeywordPrompt({ product: "p", market: "m" })).not.toMatch(/screenshot/i);
    expect(buildCtrPrompt({ platform: "Meta", industry: "x", current_copy: "c" })).not.toMatch(/screenshot/i);
    expect(buildLandingPrompt({ ad_promise: "a", landing_copy: "b", audience: "c" })).not.toMatch(/screenshot/i);
  });
});
