/**
 * Lightweight prompts used by the /launch/wizard page. The wizard runs each
 * phase sequentially; outputs from earlier phases (positioning_one_liner +
 * big_idea) are passed forward into later prompts to keep the assets coherent.
 */

export interface LaunchWizardCommon {
  campaign_name: string;
  goal: "awareness" | "leads" | "sales" | "launch" | "engagement";
  platforms: string[];        // e.g. ["meta", "google", "tiktok"]
  budget_total: string;       // e.g. "$5,000"
  launch_date: string;        // ISO YYYY-MM-DD or natural ("Mar 12")
  duration: "1_week" | "2_weeks" | "1_month";
  notes?: string;
}

export interface StrategyBriefInput extends LaunchWizardCommon {}

/** Phase 1 — quick strategy brief. Drives every later phase. ~600 tokens. */
export function buildStrategyBriefPrompt(input: StrategyBriefInput): string {
  return `You are kicking off a paid + organic launch. Produce the strategic brief — short and decisive, no fluff. Everything that follows in this campaign anchors to this brief, so be precise.

INPUT:
- Campaign name: ${input.campaign_name}
- Goal: ${input.goal}
- Platforms: ${input.platforms.join(", ")}
- Total budget: ${input.budget_total}
- Launch date: ${input.launch_date}
- Duration: ${input.duration}
- Notes from operator: ${input.notes || "(none)"}

Use the brand brain in the system message. Apply the framework stack — name the awareness level you're targeting and the tactical framework you'll lean on for this brief.

Return ONLY valid JSON:
{
  "positioning_one_liner": "string — the brand's elevator pitch tightened for THIS campaign",
  "awareness_level": "unaware | problem_aware | solution_aware | product_aware | most_aware",
  "primary_framework": "PAS | AIDA | BAB | 4Ps | HFAS | DIRECT-OFFER",
  "framework_reasoning": "string (1 sentence) — why this framework fits this awareness level + goal",
  "big_idea": "string — the single hook every asset will rotate around",
  "proof_points": ["string (3, each tied to brain.usp or brain.key_benefits — never invented)"],
  "primary_cta": "string — outcome-named (≤ 8 words)",
  "risk_flags": ["string — things to watch for (claims that need substantiation, audiences to avoid, etc.)"],
  "budget_split_suggestion": {
    "paid_pct": 0,
    "organic_pct": 0,
    "reasoning": "string"
  }
}`;
}

export interface EmailSequenceInput extends LaunchWizardCommon {
  big_idea: string;
  positioning_one_liner: string;
  primary_cta: string;
}

/** Phase: 3-email nurture sequence. */
export function buildEmailSequencePrompt(input: EmailSequenceInput): string {
  return `Write a 3-email nurture sequence for the ${input.campaign_name} campaign.

ANCHORS (carry forward from strategy brief — must thread through every email):
- Positioning: ${input.positioning_one_liner}
- Big idea: ${input.big_idea}
- Primary CTA: ${input.primary_cta}
- Goal: ${input.goal}

CADENCE:
- Email 1 — Day 0 (welcome / hook · sets the frame)
- Email 2 — Day 3 (value + handle the #1 objection)
- Email 3 — Day 7 (offer + scarcity / soft urgency · primary CTA)

PER EMAIL — RULES:
- Subject: ≤ 45 chars · curiosity, specificity, or pattern-interrupt — NO "Quick question", "Following up", clickbait.
- Preview text: ≤ 90 chars · completes the subject, doesn't repeat it.
- Body: 80-180 words. Plain text. ONE clear ask. No links beyond the CTA.
- Read the brand brain — match tone exactly.
- Honesty floor: never invent stats, customer counts, named partnerships.

Return ONLY valid JSON:
{
  "framework_meta": {
    "awareness_level": "string",
    "framework_used": "string"
  },
  "emails": [
    {
      "day": 0,
      "purpose": "welcome | value_objection | offer",
      "subject": "string",
      "preview_text": "string",
      "body": "string (plain text, paragraph breaks with \\n\\n)",
      "primary_cta": "string"
    }
  ]
}`;
}

export interface LaunchDayPostsInput extends LaunchWizardCommon {
  big_idea: string;
  positioning_one_liner: string;
  proof_points: string[];
}

/** Phase: launch-day organic social posts, one per platform. */
export function buildLaunchDayPostsPrompt(input: LaunchDayPostsInput): string {
  return `Write the launch-day organic social posts for the ${input.campaign_name} campaign.

ANCHORS (carry forward — every post threads the same idea):
- Big idea: ${input.big_idea}
- Positioning: ${input.positioning_one_liner}
- Proof points to choose from: ${input.proof_points.join(" | ")}
- Goal: ${input.goal}
- Launch date: ${input.launch_date}

OUTPUT — one post per platform from this list: ${input.platforms.join(", ")} (skip platforms not in the list).

PLATFORM-NATIVE RULES (validate every post):
- LinkedIn: 1100-1800 chars · long-form storytelling, line breaks for scanability, end with question + CTA. NO hashtag spam (3-5 max, contextual).
- Twitter / X: lead post 240-280 chars · if it's a thread, return tweet 1 + 3-5 follow-up tweets each ≤ 280.
- Instagram: caption 150-300 chars before "more" cut · first sentence is the hook · 5-10 niche hashtags (not 30).
- TikTok: short caption ≤ 100 chars · plus a 60-90 second talking-head script with hook in first 3 sec.
- Facebook: 100-250 chars · friendly, conversational, ends with one question.
- YouTube community post: 150-300 chars · poll-style or behind-the-scenes vibe.

Honesty floor: NEVER invent stats, customer counts, awards, named partnerships. Use the proof_points exactly as given.

Return ONLY valid JSON:
{
  "framework_meta": {
    "awareness_level": "string",
    "framework_used": "string"
  },
  "posts": [
    {
      "platform": "linkedin | twitter | instagram | tiktok | facebook | youtube",
      "headline_or_hook": "string",
      "body": "string",
      "thread_followups": ["string"] ,
      "primary_cta": "string",
      "hashtags": ["string"],
      "char_count": 0,
      "best_time_to_post_local": "string (e.g. '8-10am Tue-Thu')"
    }
  ]
}`;
}
