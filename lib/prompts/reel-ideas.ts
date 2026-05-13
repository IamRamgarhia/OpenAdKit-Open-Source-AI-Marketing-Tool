import { VIDEO_HOOK_RULE } from "./common-rules";

export interface ReelIdeasInput {
  platform: "instagram_reels" | "tiktok" | "youtube_shorts" | "facebook_reels";
  reel_count: number | string;
  duration_seconds: number | string;
  goal: string;
  pillars: string; // comma or newline separated; can be blank → AI uses brain pillars
  hook_seed?: string;
  competitor_profile_url?: string;
  competitor_pasted_content?: string;
  own_recent_reels?: string;
  tone_override?: string;
  must_avoid?: string;
}

export function buildReelIdeasPrompt(input: ReelIdeasInput): string {
  const platformLabel: Record<string, string> = {
    instagram_reels: "Instagram Reels",
    tiktok: "TikTok",
    youtube_shorts: "YouTube Shorts",
    facebook_reels: "Facebook Reels",
  };
  const platformRules: Record<string, string> = {
    instagram_reels: "Aspect 9:16 · max 90s · hook in frame 1 · Reels Explore feed rewards saves > shares > comments > likes · captions under 125 chars before truncate.",
    tiktok: "Aspect 9:16 · max 60s most viral, 15-21s sweet spot · FYP rewards completion rate + re-watches above all · captions 100 chars · pattern-interrupt in first 2 frames.",
    youtube_shorts: "Aspect 9:16 · max 60s · YouTube rewards retention + suggested-from-long-form crossover · title appears as bottom-left chip, write it like a cliffhanger.",
    facebook_reels: "Aspect 9:16 · max 90s · audience skews 30+ · captions can run longer · save + share signals matter more than TikTok.",
  };
  const plat = platformLabel[input.platform] ?? input.platform;
  const rules = platformRules[input.platform] ?? "";

  return `Generate ${input.reel_count || 12} high-CTR reel ideas for ${plat}.

${VIDEO_HOOK_RULE}

PLATFORM-NATIVE RULES (${plat}):
${rules}

INPUT:
- Goal: ${input.goal || "(unspecified — default to engagement)"}
- Target duration: ${input.duration_seconds || "(see platform default above)"} seconds
- Content pillars to rotate through: ${input.pillars || "(use brain.content_pillars)"}
- Hook seed / theme to anchor on (optional): ${input.hook_seed || "(none — generate organically)"}
- Tone override: ${input.tone_override || "(use brand brain default)"}
- Must avoid: ${input.must_avoid || "(nothing specific)"}

COMPETITOR INTEL (optional — anchor ideas to what's working in the niche):
${input.competitor_profile_url ? `- Competitor profile URL: ${input.competitor_profile_url}` : ""}
${input.competitor_pasted_content ? `- Competitor recent posts / captions:\n"""\n${input.competitor_pasted_content}\n"""\n` : ""}
${!input.competitor_profile_url && !input.competitor_pasted_content ? "(no competitor data — generate from brand context only)" : ""}

OWN RECENT REELS (avoid duplicating what's already published):
${input.own_recent_reels ? `"""\n${input.own_recent_reels}\n"""\n` : "(none provided)"}

HOOK FRAMEWORK (the only thing that matters for ${plat}):
The first 1-3 seconds decide whether anyone watches frame 4. Use ONE of these proven hook structures per idea, rotating across the batch:
- POV: "POV: you just realized [counter-intuitive truth]"
- CONTRADICTION: "Stop doing [common practice]. Here's why."
- LISTICLE TEASE: "5 things I wish I knew before [outcome]"
- NUMBER + PROMISE: "I [outcome] in [time] using just [thing]. Here's the system."
- QUESTION-PATTERN-INTERRUPT: "Why are [audience] obsessed with [thing]? It's not what you think."
- BEFORE/AFTER COLD OPEN: visually show the after, then explain the how
- STORY: "I almost didn't post this, but…"
- DEMO: "Watch this [specific action] in real time"
- CONTROVERSY: "[Group] hates this take, but…" — anchor to brand brain's actual positions, never invent
- INSIDER: "What [industry] doesn't tell you about [thing]"

VARIETY RULE:
- No hook formula used more than 2× in the batch.
- Each idea must serve ONE content pillar — name it.
- Mix duration: 20% under 15s ("quick hits"), 50% 15-45s ("explainers"), 30% 45-90s ("deep dives").
- Mix format: 40% talking-head, 30% B-roll-driven, 20% text-on-screen, 10% trend-piggyback.
- Each CTA names the outcome — never "follow for more" / "like and comment" / "check the link".

FOR EACH REEL idea return:
- hook (first 3 seconds, exact words to say or show)
- visual_brief (specific B-roll cues, transitions, on-screen text overlays)
- script (full narration / dialogue for the target duration)
- cta (outcome-named, ≤ 8 words)
- caption (platform-native, hashtags inline if niche, length within platform rules)
- hashtags_extra (additional cluster the user can append if they want — Tier A big / Tier B medium / Tier C niche)
- content_pillar (which pillar from input or brain.content_pillars)
- hook_formula (which of the 10 above was used)
- estimated_reach_driver ("FYP completion-rate" / "Explore saves" / "Suggested from long-form" / "Share-back")
- shoot_difficulty ("easy_phone_only" | "needs_b_roll" | "needs_screen_recording" | "needs_guest")
- when_to_post ("evening_local" | "morning_local" | "lunch_break" | "weekend" — based on platform-typical engagement peaks)

Return ONLY valid JSON:
{
  "competitor_pattern_summary": "string (1 paragraph) — what themes / hooks / formats the competitor leans on, when data was provided. '(no competitor data)' otherwise.",
  "blue_ocean_angles": ["string — 2-4 angles competitors aren't covering that align with the brand brain"],
  "ideas": [
    {
      "id": 1,
      "hook": "string",
      "visual_brief": "string",
      "script": "string",
      "cta": "string",
      "caption": "string",
      "hashtags_extra": { "tier_a": ["string"], "tier_b": ["string"], "tier_c": ["string"] },
      "content_pillar": "string",
      "hook_formula": "POV | CONTRADICTION | LISTICLE_TEASE | NUMBER_PROMISE | QUESTION_PATTERN_INTERRUPT | BEFORE_AFTER | STORY | DEMO | CONTROVERSY | INSIDER",
      "estimated_reach_driver": "string",
      "shoot_difficulty": "easy_phone_only | needs_b_roll | needs_screen_recording | needs_guest",
      "when_to_post": "evening_local | morning_local | lunch_break | weekend",
      "duration_seconds": 0
    }
  ]
}`;
}
