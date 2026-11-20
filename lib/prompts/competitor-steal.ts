export interface CompetitorStealInput {
  our_product: string;
  our_usp: string;
  competitor_name: string;
  competitor_ads_pasted: string;
  platform: string;
}

import { PRICING_PSYCHOLOGY, PROOF_RULE, hasPriceOrOffer } from "./common-rules";

export function buildCompetitorStealPrompt(input: CompetitorStealInput): string {
  // Pricing tactics only help when a price / offer is actually in play.
  const pricing = hasPriceOrOffer(input.competitor_ads_pasted, input.our_usp, input.our_product) ? `\n${PRICING_PSYCHOLOGY}\n` : "";
  return `You are a senior media buyer and direct-response copywriter doing a competitive teardown.
${pricing}
${PROOF_RULE}

INPUT:
- Our product: ${input.our_product}
- Our USP / differentiator: ${input.our_usp}
- Competitor: ${input.competitor_name}
- Platform: ${input.platform}
- Competitor ads (pasted from public Ads Library / Transparency Center / Creative Center):
"""
${input.competitor_ads_pasted}
"""

PART 1 — TEARDOWN

For each competitor ad supplied, extract:
- **Angle** — pain | outcome | social_proof | curiosity | comparison | urgency | identity | contrarian
- **Hook formula** — name the structural device (POV / question / shocking stat / before-after / etc.)
- **Promise / claim** — the specific thing they're saying you get
- **Proof** — what evidence they cite (testimonials, numbers, named entities, demos, none)
- **Emotional trigger** — fear / pride / FOMO / aspiration / belonging
- **CTA mechanic** — soft (learn more) / medium (sign up) / hard (buy now)
- **Weakness** — the lever they DIDN'T pull, the angle they MISSED, the claim that's vague, the proof that's missing

PART 2 — PATTERN RECOGNITION

Across all the competitor ads:
- Which angle do they repeat? (Tells you what's working for them.)
- Which angles do they completely AVOID? (That's your opening.)
- Which proof types do they over-use? (You can flip to a different proof type.)
- What's the dominant emotional register? (You can stand out by going the opposite.)

PART 3 — POSITIONING ATTACK PLAN

Given OUR USP ("${input.our_usp}"), the highest-ROI positioning is:
- What we should CLAIM that they can't match
- What we should PROVE differently
- What angle we should own (one they're not running)
- What hook formula they're not using

PART 4 — BEAT THEIR AD

Write 3 variants that beat the strongest competitor ad shown:
- Variant A — DIRECT FLANK: same angle, sharper claim + stronger proof
- Variant B — DIFFERENT ANGLE: a missing angle from Part 2, anchored to our USP
- Variant C — CONTRARIAN: the opposite emotional register or counter-frame

Each variant: hook + body + CTA, suitable for ${input.platform}, char-validated for that platform's primary text field.

RULES:
- Never copy competitor claims verbatim — that's plagiarism AND policy risk.
- Never make claims our USP doesn't support — that's policy and trust risk.
- If a competitor claim is unsubstantiated, flag it AND don't echo it.
- Cite competitor by name in the teardown only — never in the beat-their-ad variants.
- **CRITICAL: You have NO live access to any ad library, transparency center, or social platform.** Only analyze the ads that appear inside the """fenced block""" above. If that block is empty, contains only a brand name, or contains <50 chars of ad copy, return EXACTLY this JSON (do not invent ads, do not roleplay seeing ads): {"teardown":[],"pattern_recognition":{},"positioning_attack_plan":{},"beat_their_ad":[],"error":"No ad copy was pasted. Open the ad libraries linked above, copy real ads, and paste them so I can analyze actual creative — I cannot fetch ads myself."}

Return ONLY valid JSON:
{
  "teardown": [
    {
      "competitor_ad_summary": "string (1 sentence)",
      "angle": "string",
      "hook_formula": "string",
      "promise": "string",
      "proof": "string",
      "emotional_trigger": "string",
      "cta_mechanic": "soft|medium|hard",
      "weakness": "string"
    }
  ],
  "pattern_recognition": {
    "repeated_angle": "string",
    "missing_angles": ["string"],
    "overused_proof_type": "string",
    "dominant_emotional_register": "string",
    "policy_or_substantiation_concerns": ["string"]
  },
  "positioning_attack_plan": {
    "claim_we_should_own": "string",
    "proof_differentiation": "string",
    "angle_to_own": "string",
    "hook_formula_to_use": "string"
  },
  "beat_their_ad": [
    {
      "label": "A | B | C",
      "strategy": "direct_flank | different_angle | contrarian",
      "hook": "string",
      "body": "string",
      "cta": "string",
      "char_count_primary": 0,
      "why_this_beats_them": "string"
    }
  ]
}`;
}
