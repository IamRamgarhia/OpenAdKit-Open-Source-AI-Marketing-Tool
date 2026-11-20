import type { ZodTypeAny } from "zod";
import * as G from "./schemas/generators";
import { CampaignKitSchema } from "./schemas/campaign-kit";
import { ContentCalendarSchema } from "./schemas/content-calendar";
import { CreativeScoreSchema } from "./schemas/creative-score";

/**
 * Per-campaign_type generation defaults, used where the generator's own
 * config isn't importable (History → Regenerate). Mirrors each page's
 * GeneratorConfig.maxTokens / schema; lib/__tests__/generator-registry.test.ts
 * reads the page files and fails if the two drift apart.
 *
 * Regenerate used to hard-code maxTokens 3000, which truncated every tool
 * whose real budget is larger (reel ideas 7000, content calendar 6500…), so
 * the "comparison" was against a cut-off reply that then failed to parse.
 */
export const GENERATOR_DEFAULTS: Record<string, { maxTokens: number; schema?: ZodTypeAny }> = {
  BHC: { maxTokens: 4000, schema: G.BrandedHashtagChallengeSchema },
  "Campaign Kit": { maxTokens: 5500, schema: CampaignKitSchema },
  "Content Calendar": { maxTokens: 6500, schema: ContentCalendarSchema },
  "Creative Prompts": { maxTokens: 4500, schema: G.CreativePromptsSchema },
  Display: { maxTokens: 3500, schema: G.DisplaySchema },
  "Email Subjects": { maxTokens: 2500, schema: G.EmailSubjectsSchema },
  RSA: { maxTokens: 3500, schema: G.GoogleSchema },
  PMax: { maxTokens: 4500, schema: G.GooglePmaxSchema },
  Shopping: { maxTokens: 3500, schema: G.GoogleShoppingSchema },
  Hashtags: { maxTokens: 2500, schema: G.HashtagsSchema },
  "Lead Form": { maxTokens: 2800, schema: G.LeadFormSchema },
  Sponsored: { maxTokens: 3500, schema: G.LinkedinSchema },
  Feed: { maxTokens: 3500, schema: G.MetaSchema },
  "Reel Ideas": { maxTokens: 7000, schema: G.ReelIdeasSchema },
  "Spark Ads": { maxTokens: 3500, schema: G.SparkAdsSchema },
  "Hooks/UGC": { maxTokens: 4000, schema: G.TiktokSchema },
  Promoted: { maxTokens: 2500, schema: G.TwitterSchema },
  Script: { maxTokens: 3500, schema: G.YoutubeSchema },
  "Launch Guide": { maxTokens: 5500 },
  "A/B Plan": { maxTokens: 2800, schema: G.AbTestSchema },
  Fatigue: { maxTokens: 3200, schema: G.AdFatigueSchema },
  "Audience Plan": { maxTokens: 3500, schema: G.AudienceSchema },
  "Bid Advisor": { maxTokens: 3000, schema: G.BidStrategySchema },
  "Budget Audit": { maxTokens: 3500, schema: G.BudgetWasteSchema },
  "Budget Plan": { maxTokens: 3500, schema: G.BudgetPlannerSchema },
  "Creative Score": { maxTokens: 2500, schema: CreativeScoreSchema },
  "CTR Optimize": { maxTokens: 3500, schema: G.CtrSchema },
  "Keyword Plan": { maxTokens: 4500, schema: G.KeywordsSchema },
  "LP Grade": { maxTokens: 4000, schema: G.LandingPageSchema },
  "QS Improve": { maxTokens: 3500, schema: G.QualityScoreSchema },
  Report: { maxTokens: 2200 },
  Compare: { maxTokens: 3000 },
  "Reel Teardown": { maxTokens: 6000 },
  "Strategy Plan": { maxTokens: 2800 },
  "Suggested Campaigns": { maxTokens: 5500, schema: G.SuggestionsSchema },
  "Competitor Steal": { maxTokens: 4000, schema: G.CompetitorStealSchema },
};

export const DEFAULT_MAX_TOKENS = 4000;

/**
 * Token budget for re-running a saved ad: the value persisted on the ad at
 * generation time wins, then the tool's default by campaign_type, then a
 * generous fallback (old ads predate both).
 */
export function resolveMaxTokens(savedMaxTokens: unknown, campaign_type: string): number {
  const n = Number(savedMaxTokens);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return GENERATOR_DEFAULTS[campaign_type]?.maxTokens ?? DEFAULT_MAX_TOKENS;
}

export function schemaForCampaignType(campaign_type: string): ZodTypeAny | undefined {
  return GENERATOR_DEFAULTS[campaign_type]?.schema;
}
