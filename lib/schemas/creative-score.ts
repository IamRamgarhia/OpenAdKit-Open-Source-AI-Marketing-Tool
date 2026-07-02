/**
 * Zod schema for the /optimize/creative-score generator. Wired into
 * GeneratorShell via `config.schema` so a wrong-shape reply triggers a
 * single corrective retry instead of crashing the renderer.
 *
 * Be lenient where the renderer is lenient — e.g. the renderer already
 * checks `json?.scores ? ... : null`, so `scores` is optional. Only require
 * the fields the UI ACTUALLY reads to avoid spurious retries.
 */
import { z } from "zod";

const LeverScore = z.object({
  // Models sometimes return "7.5" as a string; the renderer coerces, so accept both.
  score: z.union([z.number(), z.string()]),
  reason: z.string().optional(),
});

const Fix = z.object({
  lever: z.string(),
  exact_phrase_to_change: z.string(),
  replacement: z.string(),
  expected_lift: z.string(),
});

export const CreativeScoreSchema = z
  .object({
    // Accept string scores ("7.5") — the renderer coerces via Number().
    overall_score: z.union([z.number(), z.string()]),
    // Plain string, not a strict enum: "Iterate" casing / novel tiers shouldn't
    // burn a retry. The renderer null-coalesces and lowercases for tone lookup.
    tier: z.string(),
    scores: z
      .object({
        hook_strength: LeverScore,
        specificity: LeverScore,
        urgency: LeverScore,
        brand_fit: LeverScore,
        conversion_potential: LeverScore,
      })
      .partial()
      .optional(),
    top_3_fixes: z.array(Fix).max(5).optional(),
    predicted_ctr_band: z.string().optional(),
    honest_verdict: z.string().optional(),
  })
  .passthrough();
