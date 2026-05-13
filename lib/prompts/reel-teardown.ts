export interface ReelTeardownInput {
  platform: "instagram_reels" | "tiktok" | "youtube_shorts" | "facebook_reels";
  competitor_handle_or_url: string;
  competitor_pasted_content: string;
  competitor_top_performers?: string;
  goal_for_us: string;
}

export function buildReelTeardownPrompt(input: ReelTeardownInput): string {
  const platformLabel: Record<string, string> = {
    instagram_reels: "Instagram Reels",
    tiktok: "TikTok",
    youtube_shorts: "YouTube Shorts",
    facebook_reels: "Facebook Reels",
  };
  const plat = platformLabel[input.platform] ?? input.platform;
  return `Tear down a competitor's reel strategy. Output BOTH the pattern read AND 5 "beat-their-reel" scripts that use OUR brand brain's USP + tone.

INPUT — competitor:
- Platform: ${plat}
- Handle / URL: ${input.competitor_handle_or_url}
- Pasted recent posts / captions (one block, separator '---' between reels):
"""
${input.competitor_pasted_content}
"""
- Top performers (optional — paste with view counts / likes if known):
"""
${input.competitor_top_performers || "(not provided)"}
"""

INPUT — our side:
- Goal for our reels: ${input.goal_for_us}
- (Brand brain is in the system message — anchor every "beat" script to it.)

PHASE 1 — PATTERN READ across the pasted reels:
- Hook formulas they lean on (POV / Contradiction / Listicle / Number-Promise / Question / Before-After / Story / Demo / Controversy / Insider). Count occurrences.
- Content pillars they recycle (themes that show up 3+ times).
- Length pattern (short < 15s vs explainer 15-45s vs deep dive 45-90s).
- Format mix (% talking-head, B-roll, text-on-screen, trend-piggyback).
- CTA mechanics (soft "follow for more" vs medium "save this" vs hard outcome-named).
- Emotional register (curiosity / FOMO / community / authority / contrarian).
- Visual cue patterns (jump cuts, captions, hands, faces).

PHASE 2 — WEAKNESS MAP:
- Which hook formula they OVER-rely on (rewriting opportunity for us).
- Which pillar they NEVER touch that aligns with our brain (blue ocean).
- Which CTA mechanic they skip (most under-used: outcome-named hard CTAs).
- Which emotion they DON'T pull.
- Where their proof is weak / vague / unsubstantiated.

PHASE 3 — POSITIONING ATTACK:
Given our USP + audience, pick:
- Angle to OWN (one they avoid)
- Hook formula to use (one they under-use)
- Proof type to flip to (different from theirs)
- Emotional register to occupy

PHASE 4 — 5 BEAT-THEIR-REEL SCRIPTS:
Each anchored to PHASE 3. Each addresses a SPECIFIC competitor reel from the input (cite the
quoted hook / theme it's responding to). NEVER copy their copy verbatim — that's plagiarism +
policy risk. NEVER make claims our USP doesn't support.

For each beat-script:
- target_competitor_reel: quote the hook or 1-line summary of what we're beating
- our_angle: the blue-ocean angle we're using
- hook (first 3 sec — exact words)
- visual_brief
- script (15-45s typical)
- cta (outcome-named, ≤ 8 words)
- caption + 5 niche hashtags
- why_this_beats_them: one sentence

Return ONLY valid JSON:
{
  "pattern_read": {
    "hook_formulas_used": [{ "formula": "string", "count": 0 }],
    "content_pillars_used": ["string"],
    "length_pattern": "string",
    "format_mix_percentages": { "talking_head": 0, "b_roll": 0, "text_on_screen": 0, "trend_piggyback": 0 },
    "cta_mechanics": ["string"],
    "emotional_register": "string",
    "visual_cue_patterns": ["string"]
  },
  "weakness_map": {
    "overused_hook_formula": "string",
    "missing_pillars": ["string"],
    "skipped_cta_mechanic": "string",
    "missing_emotion": "string",
    "weak_proof_examples": ["string"]
  },
  "positioning_attack": {
    "angle_to_own": "string",
    "hook_formula_to_use": "string",
    "proof_type_to_flip_to": "string",
    "emotional_register_to_occupy": "string"
  },
  "beat_their_reel": [
    {
      "target_competitor_reel": "string (cite the hook)",
      "our_angle": "string",
      "hook": "string",
      "visual_brief": "string",
      "script": "string",
      "cta": "string",
      "caption": "string",
      "hashtags": ["string"],
      "why_this_beats_them": "string"
    }
  ]
}`;
}
