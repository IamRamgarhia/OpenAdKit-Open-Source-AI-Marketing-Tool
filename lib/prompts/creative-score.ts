export interface CreativeScoreInput {
  platform: string;
  ad_copy: string;
  audience_context?: string;
}

export function buildCreativeScorePrompt(input: CreativeScoreInput): string {
  return `Score this ad creative as a senior media buyer would. No flattery, no false hope — score the ad honestly.

PLATFORM: ${input.platform}
AUDIENCE: ${input.audience_context || "(unspecified)"}

AD COPY:
"""
${input.ad_copy}
"""

SCORE on a 0-10 scale for each lever (decimals OK), with a one-sentence reason that NAMES the specific phrase/word/structural choice that earned or cost the score:

1. **hook_strength** — does the first line stop the scroll? Does it earn the second sentence?
2. **specificity** — concrete numbers, named entities, dated claims vs vague adjectives?
3. **urgency** — real, time-bound, scarcity — without fake countdown energy?
4. **brand_fit** — does it sound like a real brand or generic AI sludge?
5. **conversion_potential** — clear CTA, clear next-step, friction removed?

Compute **overall_score** = weighted average:
  hook 30% · specificity 20% · urgency 15% · brand_fit 15% · conversion 20%

CLASSIFY into one tier:
- ≥ 8.5 → "scale" (publish, increase budget)
- 7.0 - 8.4 → "iterate" (publish, A/B-test variations)
- 5.5 - 6.9 → "rewrite" (don't publish, fix specific issue first)
- < 5.5 → "kill" (start over with a different angle)

Then emit **top_3_fixes** — specific, ordered by ROI. Each fix must name the exact phrase to change and the replacement.

Return ONLY valid JSON:
{
  "overall_score": 0,
  "tier": "scale|iterate|rewrite|kill",
  "scores": {
    "hook_strength": { "score": 0, "reason": "string" },
    "specificity": { "score": 0, "reason": "string" },
    "urgency": { "score": 0, "reason": "string" },
    "brand_fit": { "score": 0, "reason": "string" },
    "conversion_potential": { "score": 0, "reason": "string" }
  },
  "top_3_fixes": [
    { "lever": "string", "exact_phrase_to_change": "string", "replacement": "string", "expected_lift": "string" }
  ],
  "predicted_ctr_band": "string — a DIRECTIONAL range judged from the copy, e.g. '0.8-1.4% on Meta Feed'. Never present it as a forecast or a guarantee; keep it within typical published ranges for the placement.",
  "honest_verdict": "string — 2 sentences, brutally honest"
}`;
}
