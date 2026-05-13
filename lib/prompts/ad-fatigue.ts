export interface FatigueInput {
  platform: string;
  ad_copy: string;
  days_running: number | string;
  audience_size?: string;
  current_frequency?: string;
  impressions_week_1?: number | string;
  impressions_week_latest?: number | string;
  ctr_week_1?: string;
  ctr_week_latest?: string;
  cpm_week_1?: string;
  cpm_week_latest?: string;
  conversions_week_1?: number | string;
  conversions_week_latest?: number | string;
  negative_feedback_seen?: string;
}

import { RETIRE_THRESHOLD_RULE } from "./common-rules";

export function buildFatiguePrompt(input: FatigueInput): string {
  return `Diagnose ad fatigue using week-over-week numbers, then prescribe specific refresh edits.

${RETIRE_THRESHOLD_RULE}

INPUT — context:
- Platform: ${input.platform}
- Days running: ${input.days_running}
- Audience size: ${input.audience_size || "(not provided)"}

INPUT — ad copy:
"""
${input.ad_copy}
"""

INPUT — weekly performance (week 1 vs latest week):
- Impressions: ${input.impressions_week_1 || "(not provided)"} → ${input.impressions_week_latest || "(not provided)"}
- CTR: ${input.ctr_week_1 || "(not provided)"} → ${input.ctr_week_latest || "(not provided)"}
- CPM: ${input.cpm_week_1 || "(not provided)"} → ${input.cpm_week_latest || "(not provided)"}
- Conversions: ${input.conversions_week_1 || "(not provided)"} → ${input.conversions_week_latest || "(not provided)"}
- Current frequency: ${input.current_frequency || "(not provided)"}
- Negative-feedback score (Meta only): ${input.negative_feedback_seen || "(not provided)"}

IF AN IMAGE IS ATTACHED:
The user has dropped a performance graph (Meta delivery insights / TikTok analytics / Google Display).
Read the trend lines directly: frequency arc, CTR slope, CPM slope, conversion fall-off. Cite "(from
screenshot)" when the image — not the typed numbers — drives a severity call.

PHASE 1 — COMPUTE THE DECAY %s:
- reach_decay = (impressions_week_latest / impressions_week_1) − 1 → as percentage
- ctr_decay = (ctr_latest − ctr_week_1) / ctr_week_1 → as percentage (negative means decay)
- cpm_creep = (cpm_latest − cpm_week_1) / cpm_week_1 → as percentage
- conversion_decay = (conv_latest − conv_week_1) / conv_week_1 → as percentage

For each: if both weeks aren't provided, mark "could not be computed" — never invent.

PHASE 2 — SCORE EACH FATIGUE SIGNAL (0-10, with named reading + threshold-breached flag):
- frequency: Meta target ceiling 3.0 (warning), 5.0 (severe). TikTok: 2.5 (warning). Google Display: 6.0.
  Score = how far over target × intensity. threshold_breached = true if at/above the warning line.
- ctr_decay: 0-15% decay = mild · 15-25% moderate · 25-40% high · >40% severe.
- cpm_increase: 0-10% = mild · 10-20% moderate · >20% severe (especially when reach is also dropping).
- creative_lifespan: typical burnout windows — TikTok 7-10 days · Meta 14-21 days · Google Display
  30+ days · YouTube 21-30 days. Score on days_running vs platform-typical window.

PHASE 3 — OVERALL SEVERITY:
none = no threshold breached AND <10% CTR decay AND frequency <2
mild = 1 signal mild
moderate = 2+ signals at or past warning OR CTR decay 25-40%
severe = freq at severe line OR CTR decay >40% OR negative_feedback below_average + cost climbing

Provide a severity_reason that names the breached signals + the specific numbers.

PHASE 4 — PRESCRIBE 3 REFRESH OPTIONS, ranked by effort:

LOW EFFORT (1-2 hours):
- Reorder hook · swap opening visual · adjust thumbnail · change CTA verb

MEDIUM EFFORT (half-day):
- Same offer, new angle · native variant (UGC retread) · new B-roll cut · new music

HIGH EFFORT (1-2 days):
- New offer · new creator (TikTok/UGC) · new positioning · new audience expansion

Each item: { action, specific_change (concrete, copy-paste actionable), expected_lift (directional %) }.

PHASE 5 — NEW ANGLES TO TEST (5):
Pick angles the current ad ISN'T pulling — anchored to the brand brain's audience_pain_points + audience_desires.

PHASE 6 — KILL THRESHOLD:
A concrete rule the user can apply weekly (e.g. "if frequency > 4 and CTR < 0.5% for 3+ days, kill and replace").

Return ONLY valid JSON:
{
  "computed_decay": {
    "reach_decay": "string — e.g. '−57% (42k → 18k)' or 'could not be computed'",
    "ctr_decay": "string",
    "cpm_creep": "string",
    "conversion_decay": "string",
    "notes": "string — flag anything contradictory (e.g. reach up but CTR down)"
  },
  "fatigue_severity_overall": "none|mild|moderate|severe",
  "severity_reason": "string — names the breached signals + specific numbers",
  "signals": {
    "frequency": { "score": 0, "reading": "string", "threshold_breached": false },
    "ctr_decay": { "score": 0, "reading": "string", "threshold_breached": false },
    "cpm_increase": { "score": 0, "reading": "string", "threshold_breached": false },
    "creative_lifespan": { "score": 0, "reading": "string", "threshold_breached": false }
  },
  "refresh_options": {
    "low_effort": [{ "action": "string", "specific_change": "string", "expected_lift": "string" }],
    "medium_effort": [{ "action": "string", "specific_change": "string", "expected_lift": "string" }],
    "high_effort": [{ "action": "string", "specific_change": "string", "expected_lift": "string" }]
  },
  "new_angles_to_test": [
    { "angle": "string", "angle_label": "pain|outcome|social_proof|curiosity|comparison|urgency|identity|contrarian", "rationale": "string" }
  ],
  "kill_threshold": "string (concrete weekly rule)"
}`;
}
