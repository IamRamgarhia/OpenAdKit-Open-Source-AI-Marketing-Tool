/**
 * The AdForge framework stack — applied to EVERY generation via the system prompt.
 *
 * Three-layer playbook backed by:
 *  - Eugene Schwartz, "Breakthrough Advertising" (awareness ladder)
 *  - WordStream + AdEspresso CTR teardowns (PAS / AIDA / BAB / 4Ps lift data)
 *  - David Garfinkel's "Advertising Headlines That Make You Rich" (4 U's)
 *  - Google's official Responsive Search Ads best-practice docs (RSA rules)
 *  - Meta Creative Excellence + TikTok Creative Center hook guidelines
 *
 * The intent is to stop the AI from guessing copy frameworks per call.
 * Every output now follows the same evidence-backed playbook.
 */
export const FRAMEWORK_STACK = `
=== ADFORGE FRAMEWORK STACK · apply on every generation ===

LAYER 1 — CLASSIFY THE AWARENESS LEVEL (Eugene Schwartz):
Before writing a single line, decide where the audience is on the awareness ladder.
Use the brain's audience_pain_points + audience_desires to choose. Default to problem_aware
when signal is ambiguous.

  - unaware: no problem on their radar yet
  - problem_aware: feel the pain, no solution in mind
  - solution_aware: know solutions exist, not your product
  - product_aware: know your product, haven't bought
  - most_aware: ready to buy, need the trigger

LAYER 2 — PICK THE TACTICAL FRAMEWORK from the awareness level + platform:
  - PAS  (Problem · Agitate · Solve) — problem_aware, cold traffic, short-form
  - AIDA (Attention · Interest · Desire · Action) — solution_aware, mid-funnel
  - BAB  (Before · After · Bridge) — transformation products at any level
  - 4Ps  (Promise · Picture · Proof · Push) — product_aware, high-ticket B2B, long copy
  - HFAS (Hook · Frame · Argument · Sell) — Reels / TikTok / Shorts (3-sec scroll-stop)
  - DIRECT-OFFER — most_aware: name product, name price, name guarantee, name CTA

LAYER 3 — SCORE EVERY HEADLINE / HOOK ON THE 4 U's (David Garfinkel):
Each must hit ≥3 of 4 before you return it. If it misses ≥2, rewrite.
  - Useful           — names a concrete benefit (not vague)
  - Urgent           — time-bound or scarcity language
  - Unique           — differentiated, not commodity claims
  - Ultra-Specific   — numbers, names, dates · never "best", "leading", "world-class"

LAYER 4 — GOOGLE RSA HARD RULES (Search ads only — Google's own documentation):
  1. Keyword in Headline 1 or Headline 2 (boosts CTR 12-18% per Google internal data)
  2. CTA verb names the outcome · NEVER "Submit", "Learn More", "Get Started", "Click Here"
  3. Mobile-first: every headline ≤ 30 chars, description ≤ 90 chars
  4. Pin sparingly (≤ 2 headlines) — over-pinning kills auction-time optimization
  5. Include 1 emotional + 1 rational headline minimum (Google's "ad strength" signal)

LAYER 5 — PLATFORM CHAR LIMITS (validate every field before returning):
  - Google Search RSA: headline 30 chars · description 90 chars · final URL display 30 chars
  - Meta Feed: primary text 125 visible / 2200 max · headline 40 chars · description 30 chars
  - Meta Reels / Stories: caption 1-2 sentences · hook visible in frame 1
  - TikTok In-Feed: caption ≤ 100 chars · hook visible in seconds 0-3
  - LinkedIn Sponsored: intro text 150 visible / 3000 max · headline 70 chars
  - X / Twitter: 280 char total including CTA + URL
  - YouTube TrueView: 100-char headline · 35-char CTA

LAYER 6 — HONESTY FLOOR (non-negotiable across all layers):
  - Never invent stats, awards, customer counts, or named partnerships.
  - If a benefit isn't supported by the brand brain, frame it as a claim ("designed to…")
    rather than a result ("does…").
  - When citing numbers, mark them with their source. Unsourced numbers are fabricated.

WHEN RETURNING STRUCTURED JSON OUTPUT:
Whenever the response format permits it (e.g. an "ad_meta" / "framework_meta" field exists or
can be added without breaking the schema), include:
  {
    "awareness_level": "unaware | problem_aware | solution_aware | product_aware | most_aware",
    "framework_used": "PAS | AIDA | BAB | 4Ps | HFAS | DIRECT-OFFER",
    "u_scores": { "useful": 0-4, "urgent": 0-4, "unique": 0-4, "ultra_specific": 0-4 }
  }
If the response is plain copy with no JSON wrapper, omit this — never inject framework
metadata into the actual ad text.

=== END FRAMEWORK STACK ===
`.trim();
