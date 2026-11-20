/**
 * Framework-free registry of OpenAdKit's AI tools: what each one takes, how
 * its prompt is built, which schema validates the reply, and its sampling
 * settings. The MCP server (mcp/server.ts) exposes every entry as an MCP tool;
 * the values mirror the generator pages so a tool called from Claude Desktop
 * produces the same output as the same tool in the web app.
 *
 * Inputs are Zod raw shapes. Every field has a description because MCP
 * clients show them to the model that fills them in.
 */
import { z, type ZodRawShape, type ZodTypeAny } from "zod";

import { buildMetaPrompt } from "../prompts/meta-ads";
import { buildGoogleRsaPrompt } from "../prompts/google-ads";
import { buildPmaxPrompt } from "../prompts/google-pmax";
import { buildShoppingPrompt } from "../prompts/google-shopping";
import { buildTikTokPrompt } from "../prompts/tiktok-ads";
import { buildSparkAdsPrompt } from "../prompts/tiktok-spark";
import { buildBhcPrompt } from "../prompts/tiktok-bhc";
import { buildTwitterPrompt } from "../prompts/twitter-ads";
import { buildYouTubePrompt } from "../prompts/youtube-ads";
import { buildLinkedInPrompt } from "../prompts/linkedin-ads";
import { buildDisplayPrompt } from "../prompts/display-ads";
import { buildEmailSubjectsPrompt } from "../prompts/email-subjects";
import { buildHashtagPrompt } from "../prompts/hashtags";
import { buildLeadFormPrompt } from "../prompts/lead-form";
import { buildContentCalendarPrompt } from "../prompts/content-calendar";
import { buildCreativePromptPrompt } from "../prompts/creative-prompts";
import { buildCampaignKitPrompt } from "../prompts/campaign-kit";
import { buildCtrPrompt } from "../prompts/ctr-optimizer";
import { buildQualityScorePrompt } from "../prompts/quality-score";
import { buildAudienceTargetingPrompt } from "../prompts/audience-targeting";
import { buildFatiguePrompt } from "../prompts/ad-fatigue";
import { buildBidStrategyPrompt } from "../prompts/bid-strategy";
import { buildKeywordPrompt } from "../prompts/keyword-strategy";
import { buildLandingPrompt } from "../prompts/landing-page";
import { buildCompetitorStealPrompt } from "../prompts/competitor-steal";

import * as G from "../schemas/generators";
import { CampaignKitSchema } from "../schemas/campaign-kit";
import { ContentCalendarSchema } from "../schemas/content-calendar";

export type ToolCategory = "generate" | "optimize" | "research";

export interface AiTool {
  /** MCP tool name (snake_case, stable). */
  name: string;
  title: string;
  description: string;
  category: ToolCategory;
  /** Web-app route with the same tool, for "open in OpenAdKit" links. */
  route: string;
  input: ZodRawShape;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildPrompt: (input: any) => string;
  schema: ZodTypeAny;
  maxTokens: number;
  temperature: number;
  skipFrameworkStack?: boolean;
}

const s = (d: string) => z.string().describe(d);
const os = (d: string) => z.string().optional().describe(d);
const num = (d: string) => z.union([z.number(), z.string()]).optional().describe(d);

export const AI_TOOLS: AiTool[] = [
  // ------------------------------------------------------------ generators
  {
    name: "generate_meta_ads",
    title: "Meta (Facebook + Instagram) ads",
    description: "Write Meta ad variants (primary text, headline, description, CTA) within Meta's character limits.",
    category: "generate",
    route: "/generate/meta",
    input: {
      objective: s("Campaign objective, e.g. 'Leads', 'Sales', 'Traffic', 'Awareness'."),
      format: s("Ad format, e.g. 'Single image', 'Carousel', 'Reels', 'Stories'."),
      product: s("What is being advertised."),
      offer: s("The offer or hook, e.g. 'Free 14-day trial', '20% off first order'. Empty string if none."),
      cta: s("Call to action, e.g. 'Book now', 'Shop now'."),
    },
    buildPrompt: buildMetaPrompt,
    schema: G.MetaSchema,
    maxTokens: 3500,
    temperature: 0.85,
  },
  {
    name: "generate_google_search_ads",
    title: "Google Search responsive ads (RSA)",
    description: "Write 15 headlines (≤30 chars) and 4 descriptions (≤90 chars) for a Google responsive search ad.",
    category: "generate",
    route: "/generate/google",
    input: {
      goal: s("Campaign goal, e.g. 'Leads', 'Sales', 'Calls'."),
      product: s("Product or service."),
      keyword: s("Primary keyword the ad group targets."),
      landing_url: os("Landing page URL."),
      offer: os("Offer to feature."),
    },
    buildPrompt: buildGoogleRsaPrompt,
    schema: G.GoogleSchema,
    maxTokens: 3500,
    temperature: 0.8,
  },
  {
    name: "generate_google_pmax_assets",
    title: "Google Performance Max asset group",
    description: "Headlines, long headlines, descriptions and audience signals for a Performance Max asset group.",
    category: "generate",
    route: "/generate/google-pmax",
    input: {
      goal: s("Campaign goal."),
      product: s("Product or service."),
      audience: s("Who the campaign is for."),
      business_name: s("Business name (≤25 chars on Google)."),
      landing_url: os("Final URL."),
    },
    buildPrompt: buildPmaxPrompt,
    schema: G.GooglePmaxSchema,
    maxTokens: 4500,
    temperature: 0.8,
  },
  {
    name: "generate_google_shopping_feed",
    title: "Google Shopping product title & description",
    description: "Rewrite a product feed title and description for Google Shopping / Merchant Center.",
    category: "generate",
    route: "/generate/google-shopping",
    input: {
      product_title: s("Current product title."),
      current_description: s("Current product description."),
      brand: s("Brand name."),
      product_category: s("Product category."),
      attributes: s("Key attributes: size, colour, material, model, etc."),
      price: s("Price with currency."),
    },
    buildPrompt: buildShoppingPrompt,
    schema: G.GoogleShoppingSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "generate_tiktok_ads",
    title: "TikTok ad hooks or UGC script",
    description: "TikTok scroll-stopping hooks, or a full UGC-style video script.",
    category: "generate",
    route: "/generate/tiktok",
    input: {
      product: s("Product."),
      audience: s("Target audience."),
      format: z.enum(["hooks", "ugc_script"]).describe("'hooks' for hook variations, 'ugc_script' for a full script."),
      vibe: s("Creative vibe, e.g. 'funny', 'educational', 'raw testimonial'."),
    },
    buildPrompt: buildTikTokPrompt,
    schema: G.TiktokSchema,
    maxTokens: 4000,
    temperature: 0.95,
  },
  {
    name: "generate_tiktok_spark_ads",
    title: "TikTok Spark Ads",
    description: "Turn an organic TikTok post into a Spark Ad: caption, CTA and boosting plan.",
    category: "generate",
    route: "/generate/spark-ads",
    input: {
      product: s("Product."),
      audience: s("Target audience."),
      organic_post_context: s("What the organic post shows / says."),
      brand_voice: s("Brand voice."),
    },
    buildPrompt: buildSparkAdsPrompt,
    schema: G.SparkAdsSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "generate_tiktok_hashtag_challenge",
    title: "TikTok Branded Hashtag Challenge",
    description: "Concept, hashtag, creator brief and rollout for a TikTok Branded Hashtag Challenge.",
    category: "generate",
    route: "/generate/branded-hashtag-challenge",
    input: {
      brand: s("Brand."),
      product_or_message: s("Product or message to centre the challenge on."),
      target_audience: s("Target audience."),
      budget_band: z.enum(["100k_300k", "300k_1m", "gt_1m"]).describe("Budget band in USD."),
      desired_action: s("What participants should do."),
      geo: s("Market / country."),
    },
    buildPrompt: buildBhcPrompt,
    schema: G.BrandedHashtagChallengeSchema,
    maxTokens: 4000,
    temperature: 0.8,
  },
  {
    name: "generate_x_twitter_ads",
    title: "X (Twitter) ads",
    description: "Promoted posts, video, website cards, follower ads or threads for X.",
    category: "generate",
    route: "/generate/twitter",
    input: {
      format: z
        .enum(["promoted_tweet", "promoted_video", "website_card", "follower_ad", "thread"])
        .describe("X ad format."),
      product: s("Product."),
      objective: s("Objective."),
      voice: s("Voice, e.g. 'witty', 'authoritative'."),
    },
    buildPrompt: buildTwitterPrompt,
    schema: G.TwitterSchema,
    maxTokens: 2500,
    temperature: 0.7,
  },
  {
    name: "generate_youtube_ads",
    title: "YouTube ads",
    description: "In-stream, bumper (6s) or discovery ad scripts and copy for YouTube.",
    category: "generate",
    route: "/generate/youtube",
    input: {
      format: z.enum(["in_stream", "bumper", "discovery"]).describe("YouTube format."),
      product: s("Product."),
      goal: s("Goal."),
      landing_url: os("Landing URL."),
    },
    buildPrompt: buildYouTubePrompt,
    schema: G.YoutubeSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "generate_linkedin_ads",
    title: "LinkedIn ads",
    description: "Sponsored content, message ads, dynamic ads, text ads or lead-gen forms for LinkedIn B2B campaigns.",
    category: "generate",
    route: "/generate/linkedin",
    input: {
      format: z
        .enum(["sponsored_content", "message_ad", "dynamic_ad", "text_ad", "lead_gen_form"])
        .describe("LinkedIn format."),
      objective: s("Objective."),
      product: s("Product."),
      audience: s("Audience (roles, seniority, industries)."),
      cta: s("Call to action."),
    },
    buildPrompt: buildLinkedInPrompt,
    schema: G.LinkedinSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "generate_display_ads",
    title: "Google display ads",
    description: "Responsive display ad headlines and descriptions plus banner copy.",
    category: "generate",
    route: "/generate/display",
    input: {
      product: s("Product."),
      goal: s("Goal."),
      brand_promise: s("The one promise the brand makes."),
      cta: s("Call to action."),
    },
    buildPrompt: buildDisplayPrompt,
    schema: G.DisplaySchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "generate_email_subject_lines",
    title: "Email subject lines",
    description: "Email subject lines and preview text, scored for open-rate drivers.",
    category: "generate",
    route: "/generate/email-subjects",
    input: {
      campaign_type: z
        .enum(["promotional", "newsletter", "cart_abandonment", "welcome", "winback", "announcement"])
        .describe("Email type."),
      product_or_topic: s("Product or topic."),
      audience: s("Audience."),
      primary_outcome: s("What the email should achieve."),
    },
    buildPrompt: buildEmailSubjectsPrompt,
    schema: G.EmailSubjectsSchema,
    maxTokens: 2500,
    temperature: 0.7,
    skipFrameworkStack: true,
  },
  {
    name: "generate_hashtags",
    title: "Hashtags",
    description: "A tiered hashtag set (broad / niche / branded) for a post.",
    category: "generate",
    route: "/generate/hashtags",
    input: {
      title: s("Post title or topic."),
      platform: z
        .enum(["instagram", "tiktok", "twitter", "linkedin", "youtube", "pinterest", "any"])
        .describe("Platform."),
      language: s("Language, e.g. 'English', 'Hindi'."),
      context: os("Extra context: caption, audience, location."),
    },
    buildPrompt: buildHashtagPrompt,
    schema: G.HashtagsSchema,
    maxTokens: 2500,
    temperature: 0.6,
    skipFrameworkStack: true,
  },
  {
    name: "generate_lead_form",
    title: "Lead form",
    description: "Lead-form intro, questions and thank-you screen for Meta, LinkedIn, Google or TikTok.",
    category: "generate",
    route: "/generate/lead-form",
    input: {
      platform: z.enum(["meta", "linkedin", "google", "tiktok"]).describe("Platform."),
      offer: s("What the lead gets."),
      audience_role: s("Who fills it in (job role / persona)."),
      what_we_do_with_lead: s("What happens after submission."),
      sales_motion: z.enum(["self_serve", "high_touch_sales", "hybrid"]).describe("Sales motion."),
    },
    buildPrompt: buildLeadFormPrompt,
    schema: G.LeadFormSchema,
    maxTokens: 2800,
    temperature: 0.7,
  },
  {
    name: "generate_content_calendar",
    title: "Social content calendar",
    description: "A dated social posting calendar with hooks, formats and captions per post.",
    category: "generate",
    route: "/generate/content-calendar",
    input: {
      duration: z.enum(["1_week", "2_weeks", "1_month"]).describe("Calendar length."),
      cadence_per_week: z.number().int().min(1).max(21).describe("Posts per week."),
      platforms: s("Platforms, comma-separated."),
      pillars: s("Content pillars, comma-separated."),
      primary_goal: s("Primary goal."),
      voice_notes: s("Voice notes."),
      posting_window: s("Preferred posting times."),
      region_or_timezone: s("Region or timezone."),
    },
    buildPrompt: buildContentCalendarPrompt,
    schema: ContentCalendarSchema,
    maxTokens: 6500,
    temperature: 0.85,
  },
  {
    name: "generate_creative_prompts",
    title: "AI image / video prompts",
    description: "Ready-to-paste prompts for image and video AI tools (Midjourney, Runway, etc.) for an ad creative.",
    category: "generate",
    route: "/generate/creative-prompts",
    input: {
      asset_type: z
        .enum(["static_image", "video_short", "video_long", "ugc_video", "product_photo", "infographic", "carousel_set"])
        .describe("Asset type."),
      platform: s("Where it will run."),
      aspect_ratio: s("Aspect ratio, e.g. '1:1', '9:16'."),
      brand_promise: s("Brand promise."),
      product: s("Product."),
      audience: s("Audience."),
      mood: s("Mood / style."),
      must_include: s("Must include."),
      must_avoid: s("Must avoid."),
      duration_seconds: os("Video length in seconds."),
    },
    buildPrompt: buildCreativePromptPrompt,
    schema: G.CreativePromptsSchema,
    maxTokens: 4500,
    temperature: 0.85,
  },
  {
    name: "generate_campaign_kit",
    title: "Full campaign kit",
    description: "A multi-platform campaign: strategy, budget split, and copy for each channel.",
    category: "generate",
    route: "/generate/campaign-kit",
    input: {
      campaign_name: s("Campaign name."),
      product: s("Product."),
      primary_offer: s("Primary offer."),
      audience: s("Audience."),
      goal: s("Goal."),
      budget_monthly: s("Monthly budget with currency."),
    },
    buildPrompt: buildCampaignKitPrompt,
    schema: CampaignKitSchema,
    maxTokens: 5500,
    temperature: 0.85,
  },

  // ------------------------------------------------------------ optimizers
  {
    name: "optimize_ctr",
    title: "CTR optimizer",
    description: "Diagnose a low click-through rate from real numbers and rewrite the ad copy.",
    category: "optimize",
    route: "/optimize/ctr",
    input: {
      platform: s("Platform, e.g. 'Google Search', 'Meta'."),
      industry: s("Industry."),
      current_copy: s("The ad copy as it runs today."),
      impressions: num("Impressions in the reporting window."),
      clicks: num("Clicks."),
      conversions: num("Conversions."),
      spend: os("Spend with currency."),
      avg_cpc: os("Average CPC."),
      search_terms: os("Top search terms (search campaigns)."),
      reporting_window: os("Reporting window, e.g. 'last 30 days'."),
      goal: os("Goal."),
      audience_one_liner: os("Audience in one line."),
    },
    buildPrompt: buildCtrPrompt,
    schema: G.CtrSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "optimize_quality_score",
    title: "Google Quality Score fixer",
    description: "Find what drags a keyword's Quality Score down and how to fix ad relevance, expected CTR and landing page.",
    category: "optimize",
    route: "/optimize/quality-score",
    input: {
      keyword: s("Keyword."),
      match_type: os("Match type."),
      current_qs: os("Current Quality Score 1-10."),
      expected_ctr_rating: os("Expected CTR rating (Below / Average / Above)."),
      ad_relevance_rating: os("Ad relevance rating."),
      landing_page_rating: os("Landing page experience rating."),
      current_ad_copy: s("Current ad copy."),
      landing_page_url: os("Landing page URL."),
      landing_page_summary: s("What the landing page says / offers."),
      impressions: num("Impressions."),
      clicks: num("Clicks."),
      conversions: num("Conversions."),
      avg_cpc: os("Average CPC."),
      top_search_terms: os("Top search terms."),
    },
    buildPrompt: buildQualityScorePrompt,
    schema: G.QualityScoreSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "optimize_audience_targeting",
    title: "Audience targeting plan",
    description: "Audience structure, exclusions and testing plan for Meta, Google, LinkedIn or TikTok.",
    category: "optimize",
    route: "/optimize/audience",
    input: {
      platform: z.enum(["meta", "google", "linkedin", "tiktok"]).describe("Platform."),
      product: s("Product."),
      audience_who: s("Who buys."),
      budget_monthly: s("Monthly budget."),
      geo: s("Geography."),
      goal: s("Goal."),
      current_cpa: os("Current CPA."),
      current_cvr: os("Current conversion rate."),
      current_aov_or_ltv: os("AOV or LTV."),
      existing_audiences: os("Audiences already running."),
      best_creator_audience: os("Best-performing creator / lookalike seed."),
    },
    buildPrompt: buildAudienceTargetingPrompt,
    schema: G.AudienceSchema,
    maxTokens: 3500,
    temperature: 0.7,
  },
  {
    name: "optimize_ad_fatigue",
    title: "Ad fatigue check",
    description: "Decide whether an ad is fatigued from week-over-week numbers, and what to do about it.",
    category: "optimize",
    route: "/optimize/ad-fatigue",
    input: {
      platform: s("Platform."),
      ad_copy: s("The ad."),
      days_running: z.union([z.number(), z.string()]).describe("Days the ad has run."),
      audience_size: os("Audience size."),
      current_frequency: os("Current frequency."),
      impressions_week_1: num("Impressions in week 1."),
      impressions_week_latest: num("Impressions in the latest week."),
      ctr_week_1: os("CTR in week 1."),
      ctr_week_latest: os("CTR in the latest week."),
      cpm_week_1: os("CPM in week 1."),
      cpm_week_latest: os("CPM in the latest week."),
      conversions_week_1: num("Conversions in week 1."),
      conversions_week_latest: num("Conversions in the latest week."),
      negative_feedback_seen: os("Hides / negative comments seen."),
    },
    buildPrompt: buildFatiguePrompt,
    schema: G.AdFatigueSchema,
    maxTokens: 3200,
    temperature: 0.7,
  },
  {
    name: "optimize_bid_strategy",
    title: "Bid strategy advisor",
    description: "Recommend a bid strategy from conversion volume, CPA/ROAS targets and history.",
    category: "optimize",
    route: "/optimize/bid-strategy",
    input: {
      platform: s("Platform, e.g. 'Google Ads', 'Meta'."),
      campaign_type_setup: os("Campaign type / setup."),
      goal: s("Goal."),
      current_strategy: os("Current bid strategy."),
      current_strategy_days_active: num("Days on the current strategy."),
      monthly_budget: s("Monthly budget."),
      conversions_per_month: z.union([z.number(), z.string()]).describe("Conversions per month."),
      conversions_last_7d: num("Conversions in the last 7 days."),
      account_monthly_conversions: num("Account-wide monthly conversions."),
      cpa_trend: os("CPA trend."),
      current_cpa: os("Current CPA."),
      target_cpa: os("Target CPA."),
      target_roas: os("Target ROAS."),
    },
    buildPrompt: buildBidStrategyPrompt,
    schema: G.BidStrategySchema,
    maxTokens: 3000,
    temperature: 0.7,
  },
  {
    name: "optimize_keywords",
    title: "Keyword plan",
    description: "Keyword groups, match types and negatives from your product, market and search-terms data.",
    category: "optimize",
    route: "/optimize/keywords",
    input: {
      product: s("Product."),
      market: s("Market / country."),
      competitors: os("Competitors."),
      current_keywords: os("Keywords already running."),
      search_terms_report: os("Pasted search-terms report."),
      monthly_budget: os("Monthly budget."),
      current_conversions_per_month: num("Conversions per month."),
      target_cpa: os("Target CPA."),
      search_console_export: os("Pasted Search Console queries."),
    },
    buildPrompt: buildKeywordPrompt,
    schema: G.KeywordsSchema,
    maxTokens: 4500,
    temperature: 0.7,
  },
  {
    name: "optimize_landing_page",
    title: "Landing page review",
    description: "Grade a landing page against the ad promise and its numbers, with prioritized fixes.",
    category: "optimize",
    route: "/optimize/landing-page",
    input: {
      landing_page_url: os("URL."),
      ad_promise: s("What the ad promises."),
      landing_copy: s("The landing page copy (paste it)."),
      audience: s("Audience."),
      visitors: num("Visitors."),
      conversions: num("Conversions."),
      bounce_rate: os("Bounce rate."),
      time_on_page: os("Time on page."),
      lcp: os("Largest Contentful Paint."),
      mobile_pct: os("Share of mobile visitors."),
      primary_goal: os("Primary goal."),
    },
    buildPrompt: buildLandingPrompt,
    schema: G.LandingPageSchema,
    maxTokens: 4000,
    temperature: 0.7,
  },

  // ------------------------------------------------------------ research
  {
    name: "research_competitor_ads",
    title: "Competitor ad teardown",
    description: "Tear down pasted competitor ads and write counter-positioned ads for your product.",
    category: "research",
    route: "/research/competitors",
    input: {
      our_product: s("Our product."),
      our_usp: s("Our unique selling point."),
      competitor_name: s("Competitor."),
      competitor_ads_pasted: s("Competitor ad copy, pasted (from Meta Ads Library, Google Transparency Center, etc.)."),
      platform: s("Platform."),
    },
    buildPrompt: buildCompetitorStealPrompt,
    schema: G.CompetitorStealSchema,
    maxTokens: 4000,
    temperature: 0.7,
  },
];

export const AI_TOOL_BY_NAME: Record<string, AiTool> = Object.fromEntries(AI_TOOLS.map((t) => [t.name, t]));
