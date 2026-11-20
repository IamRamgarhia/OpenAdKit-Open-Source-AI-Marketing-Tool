/**
 * Zod schema for /generate/content-calendar. The renderer reads:
 *   json.calendar[]            — list of posts (required for any value)
 *   json.weekly_summary        — optional summary card
 *   json.theme_rotation        — optional theme pills
 *   json.asset_budget_estimate — optional budget block
 *   json.spare_hooks_for_underperformers — optional list
 *
 * Each post has: day, platform, format, pillar, hook, caption, caption_chars,
 * hashtags, best_post_time_local, engagement_hook, visual_brief,
 * recommended_ai_tool {name, tier, url, why_this_tool}, video_overlay_text.
 *
 * We require `calendar` to be a non-empty array (otherwise the renderer shows
 * "0 posts" which is what the user is paying tokens to NOT see). Everything
 * else is optional because the renderer null-checks it.
 */
import { z } from "zod";
import { tolerant, ModelNumber } from "./tolerant";

const Post = z
  .object({
    day: z.union([ModelNumber, z.string()]),
    platform: z.string(),
    format: z.string().optional(),
    pillar: z.string().optional(),
    hook: z.string().optional(),
    caption: z.string().optional(),
    caption_chars: ModelNumber.optional(),
    hashtags: z.array(z.string()).optional(),
    best_post_time_local: z.string().optional(),
    engagement_hook: z.string().optional(),
    visual_brief: z.string().optional(),
    video_overlay_text: z.string().nullish(),
    recommended_ai_tool: z
      .object({
        name: z.string().optional(),
        tier: z.string().optional(),
        url: z.string().nullish(),
        why_this_tool: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export const ContentCalendarSchema = tolerant(z
  .object({
    calendar: z.array(Post).min(1),
    weekly_summary: z
      .object({
        total_posts: ModelNumber.optional(),
        by_platform: z.array(z.object({ platform: z.string(), count: ModelNumber })).optional(),
        by_format: z.array(z.object({ format: z.string(), count: ModelNumber })).optional(),
      })
      .partial()
      .optional(),
    theme_rotation: z
      .array(
        z.object({
          pillar: z.string(),
          days: z.array(z.union([ModelNumber, z.string()])).optional(),
        })
      )
      .optional(),
    asset_budget_estimate: z
      .object({
        free_only_path: z.string().optional(),
        freemium_path: z.string().optional(),
        premium_path: z.string().optional(),
      })
      .partial()
      .optional(),
    spare_hooks_for_underperformers: z.array(z.string()).optional(),
  })
  .passthrough());
