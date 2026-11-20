/**
 * Zod schema for /generate/campaign-kit. The renderer accesses many optional
 * branches (linkedin, twitter, email_subjects, youtube_in_stream, etc.), so
 * we only REQUIRE the always-present blocks: master_hook, google_rsa, meta_feed.
 * Everything else is optional + passthrough so unexpected fields aren't lost.
 */
import { z } from "zod";
import { tolerant, ModelNumber } from "./tolerant";

const Strings = z.array(z.string());

export const CampaignKitSchema = tolerant(z
  .object({
    master_hook: z.string(),
    master_usp: z.string().optional(),
    google_rsa: z
      .object({
        headlines: Strings.optional(),
        descriptions: Strings.optional(),
      })
      .passthrough(),
    meta_feed: z
      .object({
        primary_text: Strings.optional(),
        headlines: Strings.optional(),
        cta: z.string().optional(),
      })
      .passthrough(),
    tiktok: z
      .object({ hooks: Strings.optional(), ugc_brief: z.string().optional() })
      .partial()
      .optional(),
    youtube_in_stream: z
      .object({
        hook: z.object({ t: z.string().optional(), vo: z.string().optional(), visual: z.string().optional() }).partial().optional(),
        value: z.object({ t: z.string().optional(), vo: z.string().optional(), visual: z.string().optional() }).partial().optional(),
        cta: z.object({ t: z.string().optional(), vo: z.string().optional(), visual: z.string().optional() }).partial().optional(),
      })
      .partial()
      .optional(),
    linkedin: z
      .object({ intro: z.string().optional(), headline: z.string().optional() })
      .partial()
      .optional(),
    twitter: Strings.optional(),
    email_subjects: Strings.optional(),
    landing_hero: z
      .object({
        h1: z.string().optional(),
        subhead: z.string().optional(),
        bullets: Strings.optional(),
        cta_button: z.string().optional(),
      })
      .partial()
      .optional(),
    budget_split: z
      .array(
        z.object({
          platform: z.string(),
          pct: ModelNumber,
          rationale: z.string().optional(),
        })
      )
      .optional(),
    kpi_targets: z
      .array(
        z.object({
          metric: z.string(),
          target: z.string(),
          by_when: z.string().optional(),
        })
      )
      .optional(),
  })
  .passthrough());
