/**
 * Zod schemas for every generator that uses GeneratorShell with expectJson:true.
 *
 * Design rule: be LENIENT. The schema's only job is to catch genuinely broken
 * shapes — null where an array is expected, a string where the renderer calls
 * .map(), missing top-level fields the UI critically relies on. We don't want
 * a missing optional sub-field to trigger a corrective retry — that wastes
 * tokens.
 *
 * - Top-level objects use `.passthrough()` so extra fields the model returns
 *   pass through untouched and the renderer's `json.future_field` reads still
 *   work without needing a schema migration.
 * - Inner objects mostly use `.partial().passthrough()` for the same reason.
 * - Required arrays are kept short — only when the UI's primary content lives
 *   in that array (e.g. /generate/meta `variants`) is it marked required.
 *
 * Discriminated unions: tiktok, twitter, youtube can return one of several
 * shapes (hooks vs scripts, thread vs tweets, etc.). The schema uses .union()
 * with each variant optional so any one variant passes.
 */
import { z } from "zod";
import { tolerant, ModelNumber } from "./tolerant";

const Loose = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).partial().passthrough();
const Strings = z.array(z.string());

// ──────────────────────────────────────────────────────────────────────────
// /generate/meta
// ──────────────────────────────────────────────────────────────────────────
export const MetaSchema = tolerant(z
  .object({
    variants: z
      .array(
        Loose({
          label: z.string(),
          angle: z.string(),
          primary_text: z.string(),
          headline: z.string(),
          description: z.string(),
          cta_button: z.string(),
        })
      )
      .min(1),
    audience_hint: z.string().optional(),
    best_placement_recommendation: z.string().optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/google
// ──────────────────────────────────────────────────────────────────────────
const TextWithChars = Loose({
  text: z.string(),
  angle: z.string(),
  chars: ModelNumber,
  status: z.string(),
  trimmed_alt: z.string().nullish(),
});
export const GoogleSchema = tolerant(z
  .object({
    headlines: z.array(TextWithChars).min(1),
    descriptions: z.array(TextWithChars).min(1),
    angles: z.array(Loose({ label: z.string(), motivation: z.string() })).optional(),
    sitelinks: z.array(Loose({ title: z.string(), desc1: z.string(), desc2: z.string() })).optional(),
    callouts: Strings.optional(),
    structured_snippets: Loose({ header: z.string(), values: Strings }).optional(),
    quality_score_tips: Strings.optional(),
    self_check: Loose({
      combinable: z.boolean(),
      headline_mix_balanced: z.boolean(),
      notes: z.string(),
    }).optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/google-pmax
// ──────────────────────────────────────────────────────────────────────────
export const GooglePmaxSchema = tolerant(z
  .object({
    headlines: z.array(TextWithChars).min(1),
    long_headlines: z.array(TextWithChars).min(1),
    descriptions: z.array(TextWithChars).min(1),
    business_name: z.string().optional(),
    image_prompts: z
      .array(Loose({ ratio: z.string(), size: z.string(), prompt: z.string() }))
      .optional(),
    video_script: z.record(z.string(), z.any()).optional(),
    audience_signals: z
      .array(Loose({ type: z.string(), value: z.string(), rationale: z.string() }))
      .optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/google-shopping
// ──────────────────────────────────────────────────────────────────────────
const TextChars = Loose({ text: z.string(), chars: ModelNumber, status: z.string() });
export const GoogleShoppingSchema = tolerant(z
  .object({
    title: TextChars,
    description: TextChars,
    highlights: Strings.optional(),
    merchant_center_attributes: z
      .array(Loose({ priority: z.string(), field: z.string(), value_or_action: z.string() }))
      .optional(),
    long_tail_queries_to_rank_for: Strings.optional(),
    negative_keywords: Strings.optional(),
    policy_warnings: Strings.optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/tiktok — one-of: hooks list OR scripts list
// ──────────────────────────────────────────────────────────────────────────
export const TiktokSchema = tolerant(z
  .object({
    hooks: z
      .array(Loose({ hook: z.string(), continuation: z.string(), formula: z.string() }))
      .optional(),
    production_notes: Strings.optional(),
    scripts: z
      .array(
        Loose({
          title: z.string(),
          creator_brief: z.string(),
          script_beats: z.array(z.any()),
          caption: z.string(),
          hashtags: Strings,
          b_roll: Strings,
        })
      )
      .optional(),
  })
  .passthrough()
  .refine((v) => (v.hooks && v.hooks.length > 0) || (v.scripts && v.scripts.length > 0), {
    message: "must return either hooks or scripts",
  }));

// ──────────────────────────────────────────────────────────────────────────
// /generate/twitter — one-of: thread OR tweets
// ──────────────────────────────────────────────────────────────────────────
export const TwitterSchema = tolerant(z
  .object({
    thread: z
      .array(
        Loose({ position: ModelNumber, role: z.string(), text: z.string(), chars: ModelNumber })
      )
      .optional(),
    tweets: z
      .array(
        Loose({
          label: z.string(),
          angle: z.string(),
          text: z.string(),
          chars: ModelNumber,
          status: z.string(),
          trimmed_alt: z.string().nullish(),
        })
      )
      .optional(),
    best_time_window_utc: z.string().optional(),
  })
  .passthrough()
  .refine((v) => (v.thread && v.thread.length > 0) || (v.tweets && v.tweets.length > 0), {
    message: "must return either thread or tweets",
  }));

// ──────────────────────────────────────────────────────────────────────────
// /generate/youtube — one-of: variants OR scripts OR headlines+descriptions
// ──────────────────────────────────────────────────────────────────────────
const Beat = Loose({ t: z.string(), vo: z.string(), visual: z.string(), on_screen_url: z.string() });
export const YoutubeSchema = tolerant(z
  .object({
    variants: z
      .array(
        Loose({
          label: z.string(),
          hook: Beat,
          problem: Beat,
          solution: Beat,
          proof: Beat,
          cta: Beat,
          b_roll: Strings,
          companion_banner: z.string(),
        })
      )
      .optional(),
    view_rate_target: z.string().optional(),
    scripts: z
      .array(
        Loose({
          label: z.string(),
          angle: z.string(),
          vo: z.string(),
          on_screen_text: z.string(),
          visual: z.string(),
        })
      )
      .optional(),
    headlines: Strings.optional(),
    descriptions: Strings.optional(),
    thumbnail_concepts: z
      .array(Loose({ emotion: z.string(), title: z.string(), visual: z.string() }))
      .optional(),
  })
  .passthrough()
  .refine(
    (v) =>
      (v.variants && v.variants.length > 0) ||
      (v.scripts && v.scripts.length > 0) ||
      ((v.headlines && v.headlines.length > 0) || (v.descriptions && v.descriptions.length > 0)),
    { message: "must return variants, scripts, or headlines/descriptions" }
  ));

// ──────────────────────────────────────────────────────────────────────────
// /generate/linkedin
// ──────────────────────────────────────────────────────────────────────────
export const LinkedinSchema = tolerant(z
  .object({
    variants: z
      .array(
        Loose({
          label: z.string(),
          angle: z.string(),
          intro_text: z.string(),
          headline: z.string(),
          description: z.string(),
          cta_button: z.string(),
        })
      )
      .min(1),
    lead_form: Loose({ form_intro: z.string(), questions: z.array(z.any()) }).nullish(),
    audience_targeting: z.record(z.string(), z.any()).optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/display
// ──────────────────────────────────────────────────────────────────────────
export const DisplaySchema = tolerant(z
  .object({
    creatives: z
      .array(
        Loose({
          size: z.string(),
          name: z.string(),
          short_headline: z.string(),
          description: z.string(),
          cta_button: z.string(),
          image_concept: z.string(),
        })
      )
      .min(1),
    responsive_display_assets: Loose({
      short_headlines: Strings,
      descriptions: Strings,
      long_headline: z.string(),
      business_name: z.string(),
      image_prompts: Strings,
    }).optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/email-subjects
// ──────────────────────────────────────────────────────────────────────────
export const EmailSubjectsSchema = tolerant(z
  .object({
    subjects: z
      .array(
        Loose({
          label: z.string(),
          angle: z.string(),
          subject: z.string(),
          preheader: z.string(),
          spam_risk: z.string(),
        })
      )
      .min(1),
    best_for_first_send: z.string().optional(),
    best_for_resend_to_non_openers: z.string().optional(),
    best_for_segments: z
      .array(Loose({ segment: z.string(), use: z.string() }))
      .optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/hashtags — recommended_set is dynamic key, so we accept any record
// ──────────────────────────────────────────────────────────────────────────
const HashtagItem = Loose({
  tag: z.string(),
  casing_variant: z.string().nullish(),
  // New enum after the anti-fabrication rewrite of hashtags.ts. Accept both
  // the new field (volume_estimate) and legacy (estimated_volume) so old
  // history rows still parse cleanly.
  volume_estimate: z.string(),
  estimated_volume: z.string(),
  use_for: z.string(),
  usage_hint: z.string(),
});
export const HashtagsSchema = tolerant(z
  .object({
    language_used: z.string().optional(),
    recommended_set: Strings.optional(),
    tiers: Loose({
      broad: z.array(HashtagItem),
      medium: z.array(HashtagItem),
      niche: z.array(HashtagItem),
      branded: z.array(HashtagItem),
    }).optional(),
    english_crossover: z
      .array(Loose({ tag: z.string(), use_for: z.string() }))
      .optional(),
    avoid: z.array(Loose({ tag: z.string(), reason: z.string() })).optional(),
    platform_specific_notes: z.string().optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/lead-form
// ──────────────────────────────────────────────────────────────────────────
export const LeadFormSchema = tolerant(z
  .object({
    intro: Loose({ headline: z.string(), greeting: z.string() }).optional(),
    questions: z
      .array(
        Loose({
          type: z.string(),
          label: z.string(),
          options: Strings,
          qualifier: z.string(),
          required: z.boolean(),
          pre_fillable_by_platform: z.boolean(),
        })
      )
      .optional(),
    thank_you_screen: Loose({
      headline: z.string(),
      body: z.string(),
      next_cta_text: z.string(),
      next_cta_url_placeholder: z.string(),
    }).optional(),
    auto_responder_email: Loose({
      subject: z.string(),
      body_lines: Strings,
    }).optional(),
    sales_handoff: Loose({
      fields_passed: Strings,
      qualification_summary_template: z.string(),
      recommended_response_sla_hours: ModelNumber,
    }).optional(),
    privacy_policy_text: z.string().optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/reel-ideas
// ──────────────────────────────────────────────────────────────────────────
export const ReelIdeasSchema = tolerant(z
  .object({
    competitor_pattern_summary: z.string().optional(),
    blue_ocean_angles: Strings.optional(),
    ideas: z
      .array(
        Loose({
          id: z.union([z.string(), ModelNumber]),
          hook_formula: z.string(),
          content_pillar: z.string(),
          shoot_difficulty: z.string(),
          duration_seconds: ModelNumber,
          hook: z.string(),
          script: z.string(),
          cta: z.string(),
          caption: z.string(),
        })
      )
      .min(1),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/spark-ads
// ──────────────────────────────────────────────────────────────────────────
export const SparkAdsSchema = tolerant(z
  .object({
    boost_decision_criteria: z.record(z.string(), z.any()).optional(),
    creator_brief: z.record(z.string(), z.any()).optional(),
    adaptation_copy: z.record(z.string(), z.any()).optional(),
    disclosure: z.record(z.string(), z.any()).optional(),
    cta_overlay: z.record(z.string(), z.any()).optional(),
    scale_rules: z.record(z.string(), z.any()).optional(),
    audience_targeting: z.record(z.string(), z.any()).optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/branded-hashtag-challenge
// ──────────────────────────────────────────────────────────────────────────
export const BrandedHashtagChallengeSchema = tolerant(z
  .object({
    viability: Loose({
      score: ModelNumber,
      recommend_proceed: z.boolean(),
      reasoning: z.string(),
      alternative_if_not: z.string(),
    }).optional(),
    hashtag: Loose({
      tag: z.string(),
      rationale: z.string(),
      potential_conflicts: Strings,
    }).optional(),
    participation_mechanic: z.record(z.string(), z.any()).optional(),
    seed_creators: z.array(z.any()).optional(),
    discover_page: z.record(z.string(), z.any()).optional(),
    sound_strategy: z.record(z.string(), z.any()).optional(),
    six_day_timeline: z.array(z.any()).optional(),
    success_metrics: z.record(z.string(), z.any()).optional(),
    compliance: z.record(z.string(), z.any()).optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /generate/creative-prompts
// ──────────────────────────────────────────────────────────────────────────
const PromptCard = Loose({
  tool: z.string(),
  prompt: z.string(),
  best_for_this_brief: z.string(),
  expected_iterations_to_winner: ModelNumber,
  params: z.string(),
  negative_prompt: z.string(),
  shot_breakdown: z.array(z.any()),
  tweaks_if_first_gen_misses: Strings,
});
export const CreativePromptsSchema = tolerant(z
  .object({
    asset_intent_summary: z.string().optional(),
    policy_warnings: Strings.optional(),
    static_image_prompts: z.array(PromptCard).optional(),
    video_prompts: z.array(PromptCard).optional(),
    preflight_checklist: Strings.optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// OPTIMIZE generators — most are heavily-conditional renderers, so all-optional
// ──────────────────────────────────────────────────────────────────────────

export const AbTestSchema = tolerant(z
  .object({
    hypothesis: z.string().optional(),
    primary_metric: z.string().optional(),
    secondary_metrics: Strings.optional(),
    variants: z
      .array(
        Loose({
          label: z.string(),
          single_change_from_control: z.string(),
          ad_copy: z.string(),
        })
      )
      .min(1),
    sample_size_per_variant_clicks: ModelNumber.optional(),
    expected_days_to_significance: z.union([z.string(), ModelNumber]).optional(),
    minimum_detectable_lift_pct: ModelNumber.optional(),
    decision_rules: z.record(z.string(), z.string()).optional(),
    failure_modes_to_avoid: Strings.optional(),
  })
  .passthrough());

export const AdFatigueSchema = tolerant(z
  .object({
    computed_decay: z.record(z.string(), z.any()).optional(),
    fatigue_severity_overall: z.string().optional(),
    severity_reason: z.string().optional(),
    signals: z.record(z.string(), z.any()).optional(),
    refresh_options: z.record(z.string(), z.any()).optional(),
    new_angles_to_test: z.array(z.any()).optional(),
    kill_threshold: z.string().optional(),
  })
  .passthrough());

export const AudienceSchema = tolerant(z
  .object({
    computed_targets: z.record(z.string(), z.any()).optional(),
    audience_diagnosis: z.string().optional(),
    cold_prospecting: z.record(z.string(), z.any()).optional(),
    warm_retargeting: z.record(z.string(), z.any()).optional(),
    hot_remarketing: z.record(z.string(), z.any()).optional(),
    exclusions: z.array(z.any()).optional(),
    platform_specific_features_to_enable: z.array(z.any()).optional(),
  })
  .passthrough());

export const BidStrategySchema = tolerant(z
  .object({
    smart_bidding_readiness: z.record(z.string(), z.any()).optional(),
    recommended_strategy: z.string().optional(),
    reason: z.string().optional(),
    fallback_strategy_if_data_insufficient: z.string().optional(),
    learning_phase: z.record(z.string(), z.any()).optional(),
    bid_adjustments: z.array(z.any()).optional(),
    budget_pacing_recommendation: z.string().optional(),
    early_warning_signs: Strings.optional(),
    graduation_path: z.record(z.string(), z.any()).optional(),
  })
  .passthrough());

export const BudgetPlannerSchema = tolerant(z
  .object({
    platform_split: z.array(z.any()).optional(),
    funnel_split_overall: z.array(z.any()).optional(),
    campaign_breakout: z.array(z.any()).optional(),
    volume_projection: z.record(z.string(), z.any()).optional(),
    saturation_flags: z.array(z.any()).optional(),
    // Legacy: older history rows nested saturation_flags under break_even.
    break_even: z.record(z.string(), z.any()).optional(),

    reserve: z.record(z.string(), z.any()).optional(),
    no_go_list: Strings.optional(),
  })
  .passthrough());

export const BudgetWasteSchema = tolerant(z
  .object({
    // budget-waste prompt returns null when no stop condition is triggered.
    stop_condition: z.string().nullish(),
    pulse: z.record(z.string(), z.any()).optional(),
    audit: z.array(z.any()).optional(),
    top_5_fixes_by_roi: z.array(z.any()).optional(),
    reallocation_plan: z.string().optional(),
  })
  .passthrough());

export const CtrSchema = tolerant(z
  .object({
    computed_metrics: z.record(z.string(), z.any()).optional(),
    verdict: z.string().optional(),
    industry_benchmark_cited: z.string().optional(),
    diagnosis_summary: z.string().optional(),
    search_term_signals: z.array(z.any()).optional(),
    scores: z.record(z.string(), z.any()).optional(),
    rewrites: z.array(z.any()).optional(),
    full_rewritten_version: z.string().optional(),
    kill_or_iterate: z.string().optional(),
    kill_or_iterate_reason: z.string().optional(),
  })
  .passthrough());

export const KeywordsSchema = tolerant(z
  .object({
    search_terms_analysis: z.record(z.string(), z.any()).optional(),
    keywords: z
      .array(
        Loose({
          term: z.string(),
          match_type: z.string(),
          intent: z.string(),
          ad_group_suggestion: z.string(),
          competition_guess: z.string(),
        })
      )
      .min(1),
    negative_keywords: z.array(z.union([z.string(), z.record(z.string(), z.any())])).optional(),
    ad_group_structure: z.array(z.any()).optional(),
    long_tail_opportunities: Strings.optional(),
    competitor_gaps: Strings.optional(),
    bidding_recommendation: z.record(z.string(), z.any()).optional(),
  })
  .passthrough());

export const LandingPageSchema = tolerant(z
  .object({
    computed_metrics: z.record(z.string(), z.any()).optional(),
    overall_grade_pulse: z.record(z.string(), z.any()).optional(),
    scores: z.record(z.string(), z.any()).optional(),
    fixes: z.array(z.any()).optional(),
    rewrite_above_the_fold: z.record(z.string(), z.any()).optional(),
    biggest_problem: z.string().optional(),
    biggest_opportunity: z.string().optional(),
  })
  .passthrough());

export const QualityScoreSchema = tolerant(z
  .object({
    computed_metrics: z.record(z.string(), z.any()).optional(),
    projected_qs: z.record(z.string(), z.any()).optional(),
    current_factors: z.record(z.string(), z.any()).optional(),
    search_term_signals: z.array(z.any()).optional(),
    fixes: z.array(z.any()).optional(),
    improved_headlines: z.array(z.any()).optional(),
    negative_keywords: Strings.optional(),
    landing_page_checklist: z.array(z.any()).optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /suggestions — custom page (not GeneratorShell). Used via validateOrRetry.
// ──────────────────────────────────────────────────────────────────────────
export const SuggestionsSchema = tolerant(z
  .object({
    campaigns: z
      .array(
        Loose({
          platform: z.string(),
          objective: z.string(),
          monthly_budget_usd: z.union([ModelNumber, z.string()]),
          name: z.string(),
          why_this_brand: z.string(),
          target_audience: z.string(),
          kpi_targets: z.record(z.string(), z.any()),
          hooks: Strings,
          adOS_workflow: z.array(Loose({ step: z.string(), url: z.string() })),
        })
      )
      .min(1),
    content_calendar_starter: z
      .array(
        Loose({
          day: z.union([ModelNumber, z.string()]),
          platform: z.string(),
          hook: z.string(),
          pillar: z.string(),
        })
      )
      .optional(),
    quick_wins: z
      .array(Loose({ tactic: z.string(), where: z.string(), expected_impact: z.string() }))
      .optional(),
    thirty_day_plan: z
      .array(
        Loose({
          week: z.union([ModelNumber, z.string()]),
          focus: z.string(),
          spend_usd: z.union([ModelNumber, z.string()]),
          deliverables: Strings,
        })
      )
      .optional(),
    no_go: z.array(Loose({ platform_or_tactic: z.string(), reason: z.string() })).optional(),
    open_questions: Strings.optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// /research/competitors teardown response (separate from the input-validation
// hardening already shipped). When the prompt's CRITICAL clause fires, the
// model returns { error, teardown:[], ... } — the schema accepts both shapes.
// ──────────────────────────────────────────────────────────────────────────
const TeardownItem = Loose({
  competitor_ad_summary: z.string(),
  angle: z.string(),
  hook_formula: z.string(),
  promise: z.string(),
  proof: z.string(),
  emotional_trigger: z.string(),
  cta_mechanic: z.string(),
  weakness: z.string(),
});
export const CompetitorStealSchema = tolerant(z
  .object({
    teardown: z.array(TeardownItem).optional(),
    pattern_recognition: z.record(z.string(), z.any()).optional(),
    positioning_attack_plan: z.record(z.string(), z.any()).optional(),
    beat_their_ad: z
      .array(
        Loose({
          label: z.string(),
          strategy: z.string(),
          hook: z.string(),
          body: z.string(),
          cta: z.string(),
          char_count_primary: ModelNumber,
          why_this_beats_them: z.string(),
        })
      )
      .optional(),
    // Honesty-path error when the user submitted no real ad copy.
    error: z.string().optional(),
  })
  .passthrough());

// ──────────────────────────────────────────────────────────────────────────
// Brand extraction (BrandBrainForm) — returns Partial<BrandBrain>. Every
// field is optional because the form's mergeFillEmpty pipeline handles gaps.
// Schema's only job: catch "model returned a non-object" or "returned an
// array instead of an object" so the merge doesn't blow up.
// ──────────────────────────────────────────────────────────────────────────
export const BrandExtractionSchema = tolerant(z
  .object({
    name: z.string().optional(),
    business_name: z.string().optional(),
    industry: z.string().optional(),
    niche: z.string().optional(),
    products: z.union([Strings, z.string()]).optional(),
    platforms: z.union([Strings, z.string()]).optional(),
    content_pillars: z.union([Strings, z.string()]).optional(),
    social_links: z.record(z.string(), z.string()).optional(),
    tone: z.string().optional(),
    personality_traits: z.union([Strings, z.string()]).optional(),
    writing_style: z.string().optional(),
    words_to_use: z.union([Strings, z.string()]).optional(),
    words_to_avoid: z.union([Strings, z.string()]).optional(),
    audience_who: z.string().optional(),
    audience_pain_points: z.union([Strings, z.string()]).optional(),
    audience_desires: z.union([Strings, z.string()]).optional(),
    audience_demographics: z.string().optional(),
    service_area: z.string().optional(),
    usp: z.string().optional(),
    key_benefits: z.union([Strings, z.string()]).optional(),
    key_messages: z.union([Strings, z.string()]).optional(),
    objections: z.union([Strings, z.string()]).optional(),
    objection_handling: z.union([Strings, z.string()]).optional(),
    competitors: z.union([Strings, z.string()]).optional(),
    differentiators: z.union([Strings, z.string()]).optional(),
    price_positioning: z.string().optional(),
    voc_phrases: z.union([Strings, z.string()]).optional(),
    voc_pain_quotes: z.union([Strings, z.string()]).optional(),
    voc_success_quotes: z.union([Strings, z.string()]).optional(),
    best_performing_angles: z.union([Strings, z.string()]).optional(),
    failed_angles: z.union([Strings, z.string()]).optional(),
  })
  .passthrough());
