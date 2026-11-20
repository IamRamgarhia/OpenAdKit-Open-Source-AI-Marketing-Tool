import { VIDEO_HOOK_RULE, ANTI_FABRICATION_RULE, HASHTAG_COUNTS } from "./common-rules";

export interface ContentCalendarInput {
  duration: "1_week" | "2_weeks" | "1_month";
  cadence_per_week: number;
  platforms: string;
  pillars: string;
  primary_goal: string;
  voice_notes: string;
  posting_window: string;
  region_or_timezone: string;
}

export function buildContentCalendarPrompt(input: ContentCalendarInput): string {
  const days = input.duration === "1_week" ? 7 : input.duration === "2_weeks" ? 14 : 30;
  const platformCount = input.platforms.split(/[,\s]+/).filter(Boolean).length || 1;
  const cadencePerWeek = Number(input.cadence_per_week) || 3;
  const estimatedEntries = Math.ceil((days / 7) * cadencePerWeek * platformCount);
  // 6500 tokens budget / ~150 tokens per entry → ~43 entries fit. If the user
  // asked for more, instruct the model to cap at the budget rather than
  // truncating mid-JSON. (Audit HIGH: 1-month × 3-platform × 3/wk = 90 entries,
  // exceeds budget → silent JSON parse failure.)
  const HARD_ENTRY_CAP = 35;
  const tooMany = estimatedEntries > HARD_ENTRY_CAP;
  return `Generate an organic social media content calendar — full post specs, captions, hashtags, visual + video creative briefs with AI-tool recommendations.

${VIDEO_HOOK_RULE}

${ANTI_FABRICATION_RULE}

TOOL-URL RULE: the "recommended_ai_tool.url" field MUST be either:
- A canonical homepage you are certain of (e.g. "https://midjourney.com", "https://runwayml.com"), OR
- null — if you're not certain of the canonical URL.
Never invent a path like "https://runwayml.com/templates/specific-feature" — those break when users click them and erode trust.

INPUT:
- Total duration: ${days} days
- Cadence: ~${input.cadence_per_week} posts / week per platform
- Platforms in scope: ${input.platforms}
${tooMany ? `
IMPORTANT — TOKEN BUDGET:
- The user's selection (${days} days × ${platformCount} platforms × ${cadencePerWeek}/wk) would produce ~${estimatedEntries} entries.
- That EXCEEDS the response token budget and would truncate the JSON mid-array.
- HARD CAP: produce at most ${HARD_ENTRY_CAP} TOTAL calendar entries.
- Strategy: PRIORITIZE the most leveraged days (Mon/Wed/Fri across each platform). If platforms compete, prefer the platform with the most pillars overlap.
- Add a top-level "truncation_notice": "Output capped at ${HARD_ENTRY_CAP} of ~${estimatedEntries} entries to fit response budget. Re-run with a shorter duration or fewer platforms for the rest."
` : ""}
- Content pillars (themes that should recur): ${input.pillars}
- Primary goal of the calendar (awareness / engagement / lead gen / nurture / sales): ${input.primary_goal}
- Voice notes: ${input.voice_notes || "(use brand brain default)"}
- Posting window: ${input.posting_window || "anytime"}
- Region / timezone: ${input.region_or_timezone || "(unspecified)"}

PRINCIPLES (apply all):
- Pillar rotation: each post serves ONE pillar. Don't blur. Rotate pillars across the week.
- Platform-native: don't reuse the same caption across platforms. LinkedIn ≠ TikTok ≠ Instagram captions.
- Format mix: balance image / carousel / Reel-or-short / Story-or-poll / text-only across each week.
- One CTA per post. No double-CTAs.
- Captions front-load: first sentence is the hook (cuts at "see more").
- 80% value / 20% promotion — be honest, no fabricated stats.
- Posting time: use the user's posting window when given; otherwise common rule-of-thumb windows (Instagram late morning / evening, LinkedIn weekday mornings, TikTok morning / evening, X weekday mornings) in the user's timezone. Label them rule of thumb, not account data.

PLATFORM-SPECIFIC CAPTION RULES:
- Instagram: first 125 chars visible before "more". 2,200 chars max.
- TikTok: short caption (keep it under ~100 chars). Hook = first 3 seconds OF VIDEO, not caption.
- Twitter / X: 280 chars (a link counts as 23).
- LinkedIn: ~150 chars visible, 3,000 max. No emoji walls.
- Facebook: ~80 chars visible. Keep short.
- YouTube Shorts: 100-char title, 5,000-char description. First 100 chars of description matter most.
- Pinterest: 100-char title, 500-char description. Vertical 2:3 ratio.

HASHTAGS PER POST (same caps everywhere in OpenAdKit):
${HASHTAG_COUNTS}

FOR EACH POST INCLUDE:
- Day number + suggested date offset (Day 1, Day 2…)
- Platform
- Pillar served
- Format (image / carousel / reel / short / story / text / live)
- Hook (the first 1 line that does the heaviest work)
- Full caption in the platform's native style + length
- Hashtags within that platform's cap above (niche first, plus a branded tag where it fits)
- Visual creative brief: ONE-paragraph description of what the image/video should be — written so it can be pasted into an AI image/video tool
- Recommended AI tool for the asset (from this list — match brief to tool):
  STATIC: Midjourney (photoreal/stylized), DALL-E 3 / ChatGPT (text in image), Ideogram (text rendering), Adobe Firefly (commercial-safe), Recraft (brand-vector), Canva (template-driven free)
  VIDEO: Runway Gen-3 (cinematic), Pika (consumer-quick), Luma Dream Machine (photoreal motion), HeyGen (avatar/talking-head), Synthesia (corporate explainer), CapCut (mobile native edit), Canva Magic Video (template-driven free)
- Cost tier of the chosen tool (free / freemium / paid)
- Best post time (local hour, based on platform best practice)
- Engagement hook (question / poll / CTA at the end)
- Suggested overlay text if video

ALSO PRODUCE:
- Theme rotation map: which pillars hit on which days
- Weekly summary: post counts by platform + format
- Asset-generation budget estimate (free / paid tier breakdown)
- 5 alternate hooks the user can substitute if a post under-performs

Return ONLY valid JSON:
{
  "calendar": [
    {
      "day": 1,
      "date_offset": "+0d",
      "platform": "instagram|tiktok|twitter|linkedin|facebook|youtube_shorts|pinterest",
      "pillar": "string",
      "format": "image|carousel|reel|short|story|text|live",
      "hook": "string",
      "caption": "string (platform-native length)",
      "caption_chars": 0,
      "hashtags": ["#string"],
      "visual_brief": "string (ready to paste into AI image/video tool)",
      "recommended_ai_tool": {
        "name": "string",
        "url": "string or null (canonical homepage only — leave null if uncertain, never invent paths)",
        "tier": "free|freemium|paid",
        "why_this_tool": "string"
      },
      "best_post_time_local": "string e.g. 'Tue 8:30am local'",
      "engagement_hook": "string (the question/poll/CTA closer)",
      "video_overlay_text": "string or null"
    }
  ],
  "theme_rotation": [
    { "pillar": "string", "days": [1, 4, 7] }
  ],
  "weekly_summary": {
    "total_posts": 0,
    "by_platform": [{ "platform": "string", "count": 0 }],
    "by_format": [{ "format": "string", "count": 0 }]
  },
  "asset_budget_estimate": {
    "free_only_path": "string (e.g. 'Canva + DALL-E free tier covers all assets')",
    "freemium_path": "string (e.g. 'one month of a paid image tool covers every post' — no prices unless you are sure of them)",
    "premium_path": "string"
  },
  "spare_hooks_for_underperformers": ["string"]
}`;
}
