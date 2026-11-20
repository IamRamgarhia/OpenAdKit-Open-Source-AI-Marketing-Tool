export const TIKTOK_LIMITS = {
  ad_name: 40,
  text: 100,
  optimal_video_seconds: 30,
} as const;

export interface TikTokInput {
  product: string;
  audience: string;
  format: "hooks" | "ugc_script";
  vibe: string;
}

import { VIDEO_HOOK_RULE, CHAR_COUNT_SELF_VALIDATION, ANTI_FABRICATION_RULE, PROOF_RULE } from "./common-rules";

export function buildTikTokPrompt(input: TikTokInput): string {
  if (input.format === "hooks") {
    return `Generate 50 TikTok ad hooks for: ${input.product}

${VIDEO_HOOK_RULE}

${ANTI_FABRICATION_RULE}

${PROOF_RULE}

Target audience: ${input.audience}
Brand vibe: ${input.vibe || "(let Claude pick — native, raw, not polished)"}

RULES:
- Must stop a thumb in the first 1.5 seconds.
- Native voice — sound like a creator, NOT a brand.
- Each hook is ≤ 12 words ideally.
- Avoid corporate verbs ("leverage", "innovative", "solution").

Distribute across these proven formulas:
- POV: ___
- Stop scrolling if ___
- Things I wish I knew before ___
- The reason your [X] isn't working
- First-person trial ("I switched to ___ and ___") — describe the experience, never an invented duration or result
- Pattern interrupt (unexpected opener)
- Question hook
- Specific-fact hook — a concrete fact from the brand brain (a stat ONLY if the brand brain lists one)
- Before/after hook
- Confession hook ("I'm not supposed to say this but…")

Return ONLY valid JSON:
{
  "hooks": [
    {
      "hook": "string (the opening line, ≤ 12 words)",
      "continuation": "string (2 sentences after the hook)",
      "formula": "pov | stop_scrolling | wish_i_knew | reason | first_person_trial | pattern_interrupt | question | specific_fact | before_after | confession",
      "seconds_to_hook": 1
    }
  ],
  "production_notes": ["3–5 short notes on lighting, framing, sound, energy"]
}`;
  }

  return `Generate a TikTok UGC ad script for: ${input.product}

${VIDEO_HOOK_RULE}

${PROOF_RULE}

Target audience: ${input.audience}
Brand vibe: ${input.vibe || "native, authentic, slightly chaotic"}

RULES:
- Must feel native — polished = ignored.
- Total length ≤ ${TIKTOK_LIMITS.optimal_video_seconds}s.
- Avoid jump cuts that look like a corporate ad.
- Caption ≤ ${TIKTOK_LIMITS.text} chars.

Generate 3 distinct UGC scripts. For each:
- creator_brief: what to wear, where to film, what NOT to do.
- script_beats: array of beats with timestamp + spoken_line + visual + on_screen_text.
- caption (≤ ${TIKTOK_LIMITS.text} chars — VALIDATE per the rule below).
- hashtags: 3–5, relevant to the video (over-tagging dilutes the signal).
- b_roll: 3 shot ideas.

${CHAR_COUNT_SELF_VALIDATION}

CAPTION CHAR LIMIT: ${TIKTOK_LIMITS.text} chars (TikTok hard cap).

${ANTI_FABRICATION_RULE}

Return ONLY valid JSON:
{
  "scripts": [
    {
      "title": "string",
      "creator_brief": "string",
      "script_beats": [{ "t": "0:00", "spoken": "string", "visual": "string", "overlay": "string" }],
      "caption": "string",
      "caption_chars": 0,
      "caption_status": "ok|over",
      "caption_trimmed_alt": "string or null (only set if caption_status is 'over')",
      "hashtags": ["#string"],
      "b_roll": ["string"]
    }
  ]
}`;
}
