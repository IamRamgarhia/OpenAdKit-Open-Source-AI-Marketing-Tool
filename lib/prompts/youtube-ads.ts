export interface YouTubeInput {
  format: "in_stream" | "bumper" | "discovery";
  product: string;
  goal: string;
  landing_url?: string;
}

import { VIDEO_HOOK_RULE, ANTI_FABRICATION_RULE, PROOF_RULE } from "./common-rules";

export function buildYouTubePrompt(input: YouTubeInput): string {
  if (input.format === "bumper") {
    return `Generate 5 YouTube Bumper ad scripts (6 seconds, non-skippable) for: ${input.product}
Goal: ${input.goal}

${PROOF_RULE}

RULES:
- 6 seconds means ~15 words MAX of spoken VO.
- Must work with sound OFF — visual + on-screen text first.
- One memorable message per script.

Return ONLY valid JSON:
{
  "scripts": [
    {
      "label": "A | B | C | D | E",
      "angle": "string",
      "vo": "string (≤ 15 words)",
      "visual": "string",
      "on_screen_text": "string (≤ 6 words)",
      "frame_count": 6
    }
  ]
}`;
  }
  if (input.format === "discovery") {
    return `Generate YouTube in-feed (Discovery) ad copy for: ${input.product}
Goal: ${input.goal}

${PROOF_RULE}

Return ONLY valid JSON:
{
  "headlines": ["3 headlines, each ≤ 100 chars"],
  "descriptions": ["2 descriptions, each ≤ 200 chars"],
  "thumbnail_concepts": [
    { "title": "string", "emotion": "curiosity | shock | desire", "visual": "string" }
  ]
}`;
  }
  return `Generate a YouTube In-Stream ad script for: ${input.product}

${VIDEO_HOOK_RULE}

${ANTI_FABRICATION_RULE}

${PROOF_RULE}

Goal: ${input.goal}
Landing page: ${input.landing_url || "(not provided — show the brand name instead of a URL)"}

STRUCTURE (60 seconds max; the skip button appears at 5s, so the hook must land in the first 3s per the video rules above and the brand must be clear before 5s):
- Hook (0–3s): MUST stop the skip. Question, pattern interrupt, or a striking visual.
- Problem (3–15s): Agitate the pain the audience already feels.
- Solution (15–30s): Introduce the product. Show, don't tell.
- Proof (30–45s): a real demo of the product working, or a stat / review / third-party validation ONLY if the brand brain lists it. Otherwise show a verifiable product or process fact.
- CTA (45–60s): One clear next step.${input.landing_url ? " Show the URL." : ""}

Generate 2 variants. For each:
- Full script with timestamps
- B-roll shot list
- Companion banner copy (300×60): a short line of text for the banner image, about 5 words

Return ONLY valid JSON:
{
  "variants": [
    {
      "label": "A | B",
      "hook": { "t": "0–3s", "vo": "string", "visual": "string" },
      "problem": { "t": "3–15s", "vo": "string", "visual": "string" },
      "solution": { "t": "15–30s", "vo": "string", "visual": "string" },
      "proof": { "t": "30–45s", "vo": "string", "visual": "string" },
      "cta": { "t": "45–60s", "vo": "string", "visual": "string", "on_screen_url": "string" },
      "b_roll": ["string"],
      "companion_banner": "string"
    }
  ],
  "view_rate_target": "string — how to judge the hook: compare view rate with your channel's other in-stream ads (no universal benchmark)"
}`;
}
