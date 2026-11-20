export interface Lesson {
  slug: string;
  title: string;
  read_minutes: number;
  takeaway: string;
  body_md: string;
  quick_action: string;
  ai_practice_prompt: string;
}

export interface Course {
  slug: "google" | "meta" | "tiktok";
  name: string;
  blurb: string;
  lessons: Lesson[];
}

export const COURSES: Course[] = [
  {
    slug: "google",
    name: "Google Ads — Beginner Track",
    blurb: "10 lessons from auction mechanics to your first optimization. Read time: ~60 min total.",
    lessons: [
      {
        slug: "auctions",
        title: "How the Google Ads auction actually works",
        read_minutes: 6,
        takeaway: "You don't pay your bid. You pay the minimum needed to beat the ad below you, weighted by Quality Score.",
        body_md: `# Three things win the Google auction

Most beginners think the highest bidder wins. That's wrong. Google ranks ads by **Ad Rank**, which is roughly:

> Ad Rank = max CPC bid × Quality Score × (expected extension impact)

Quality Score is Google's 1–10 rating of how relevant your ad is to the user's query, the user's expected click experience, and the landing page experience.

**Why it matters in dollars**: a competitor with bid $2.00 and QS 6 has Ad Rank 12. You can beat them with bid $1.50 and QS 9 (Ad Rank 13.5) — and you'll pay LESS per click because Google's CPC formula is:

> Actual CPC = (Ad Rank of ad below you / your Quality Score) + $0.01

Lower your QS, you pay more even at the same bid. Raise it, you pay less.

**The lever you control**: Quality Score. Bidding is a brute-force lever. Quality Score is the leverage lever.`,
        quick_action: "Open one of your active keywords and check its Quality Score column. Anything ≤ 5 is leaving money on the table.",
        ai_practice_prompt: "Visit /optimize/quality-score with your weakest-QS keyword and let Claude diagnose it.",
      },
      {
        slug: "structure",
        title: "Account → Campaign → Ad Group → Ad",
        read_minutes: 5,
        takeaway: "Tightly themed ad groups beat broad ones every time. One intent per ad group.",
        body_md: `# The hierarchy that compounds Quality Score

\`\`\`
Account (one billing identity)
  └─ Campaign (one budget, one location, one bidding strategy)
      └─ Ad Group (one tight theme — 5-15 closely related keywords)
          └─ Ads (3+ ads per group; Google rotates and learns)
          └─ Keywords (with match types)
\`\`\`

**The single biggest beginner mistake**: cramming "running shoes", "marathon training plan", "best protein powder", and "yoga mats" into one ad group. Quality Score collapses because no single ad copy can be relevant to all those queries.

**Fix it**: one ad group per intent cluster. "Trail running shoes for women" deserves its own ad group with its own headline. So does "minimalist running shoes for beginners."

Single-Theme Ad Groups (STAGs) and Single-Keyword Ad Groups (SKAGs) are the names you'll see for taking this to extremes.`,
        quick_action: "Audit one of your ad groups: if it contains keywords that wouldn't all fit comfortably in the same ad headline, split it.",
        ai_practice_prompt: "Run /optimize/keywords on your top product to see how Claude would group keywords.",
      },
      {
        slug: "match-types",
        title: "Keyword match types — when to use which",
        read_minutes: 6,
        takeaway: "Broad without Smart Bidding burns money. Phrase and Exact for tight CPA. Branded campaigns: Exact only.",
        body_md: `# Three match types, very different cost profiles

**Exact match**: only matches your keyword and close variants. Tightest control, highest intent, smallest reach. Use for: branded campaigns, proven money-keywords, high-CPA verticals.

**Phrase match**: matches queries containing your keyword phrase as a contiguous chunk. Decent intent, moderate reach. Use for: most prospecting campaigns.

**Broad match**: matches queries Google's algorithm thinks are RELATED, including synonyms, misspellings, and "similar searches." Largest reach, biggest waste risk.

**Rule of thumb**: don't use Broad unless paired with Smart Bidding (tCPA / tROAS / Maximize Conversions) AND a robust negative-keyword list. Smart Bidding can prune the bad matches; manual CPC cannot.

**The 2025 reality**: Google has been quietly broadening Phrase match interpretation. Check your search-terms report weekly.`,
        quick_action: "Open your Search Terms report (last 30 days). For every triggered query you'd never bid on intentionally, add it as a negative keyword.",
        ai_practice_prompt: "Send your worst-converting keyword to /optimize/quality-score for a rewrite that includes match-type recommendation.",
      },
      {
        slug: "headlines",
        title: "Writing headlines Google's algorithm rewards",
        read_minutes: 5,
        takeaway: "30 chars · keyword in 1+ headline · variety of openers · combinability with any other headline.",
        body_md: `# The 4 invisible rules

1. **30 character limit.** Spaces count. Google truncates without warning.
2. **At least one headline must contain your target keyword** — verbatim or near-verbatim. This is the #1 ad-relevance signal.
3. **Vary your opening word.** "Get…", "Get…", "Get…" — Google sees those as near-duplicates and rotates only one.
4. **Combinability.** Google randomly recombines your 15 headlines into 3-slot ads. Each headline must read well STANDALONE and ALONGSIDE any other headline. No sequence dependencies.

**Headline-mix recipe that works for RSAs**: 4 keyword-led, 4 benefit-led, 3 social-proof / specificity, 3 CTA / offer, 1 brand.

**Forbidden moves**:
- "!" in headlines (Google removes them silently)
- "Best", "#1", "Top" without a verifiable source
- ALL CAPS on words longer than 3 chars
- Repeating the same phrase across multiple headlines`,
        quick_action: "Open /generate/google and paste your worst-performing ad's keyword in to get 15 fresh angles.",
        ai_practice_prompt: "Run /generate/google with your campaign goal — copy the output to Google Ads and observe Quality Score change in 7 days.",
      },
      {
        slug: "extensions",
        title: "Ad extensions — the free performance boost",
        read_minutes: 4,
        takeaway: "Extensions raise CTR and Quality Score without raising spend. Every campaign should have at least 4 sitelinks + 6 callouts.",
        body_md: `# What to add, in what order

**Sitelinks** (highest impact): up to 6 additional links beneath your ad, each with a title (25 chars) + 2 description lines (35 chars each). Use for distinct landing pages — pricing, reviews, top product categories.

**Callouts**: short benefit phrases (25 chars). Things like "Free shipping over $50" or "24/7 support". Add 10. Google rotates.

**Structured snippets**: a header (e.g. "Brands", "Service catalog") + 5+ values. Lets Google show concrete attributes inline.

**Call extension**: phone number for click-to-call. Mandatory for local businesses.

**Price extension**: card with prices for up to 8 items. Pre-qualifies clicks.

**Promotion extension**: time-bound offer with a striking badge.

**Image extensions**: visual hits to text ads. Image quality matters — submit at 1200×1200 minimum.

**Why this is free money**: extensions raise click-through rate (more screen real estate), which raises Quality Score, which lowers CPC. The ad costs the same to write but performs measurably better.`,
        quick_action: "If any active campaign has fewer than 4 sitelinks or 6 callouts, that's your fastest win this week.",
        ai_practice_prompt: "/generate/google already emits all extension copy in one pass — run it for your top campaign.",
      },
      {
        slug: "quality-score-deep",
        title: "Quality Score, by the three factors that move it",
        read_minutes: 6,
        takeaway: "Three factors, each rated low/avg/above-avg. Fix the lowest first. A higher QS lowers CPC for the same position; how much varies by account.",
        body_md: `# It is not a black box

QS is the average of three sub-scores you can see in Google Ads:

**1. Expected CTR** (relative to other ads on the same keyword)
Fix it by: putting the keyword in headlines, using stronger emotional triggers, more specific numbers.

**2. Ad relevance**
Fix it by: writing ad copy that directly answers the search intent (not adjacent intent).

**3. Landing page experience**
Fix it by: matching the landing page H1 to the ad promise, fast load times, mobile-friendly, transparent navigation.

**The math you should care about**:
- QS 5 → 7 cuts your CPC ~20% on average
- QS 3 → 7 cuts your CPC ~50%
- QS 10 vs QS 3: same bid, you pay roughly a third

Improving QS on your top-spending keywords is the highest-leverage activity in Google Ads. Period.`,
        quick_action: "Sort your keywords by spend descending. Find any QS ≤ 5 in the top 10. That's your week.",
        ai_practice_prompt: "/optimize/quality-score with that keyword — Claude returns specific fixes per factor.",
      },
      {
        slug: "conversion-tracking",
        title: "Setting up conversion tracking (and why you must)",
        read_minutes: 5,
        takeaway: "Without conversion tracking, Smart Bidding is blind and every recommendation is a guess. Set it up first, optimize second.",
        body_md: `# The non-negotiable foundation

Google Ads has three ways to track conversions:

1. **Google Ads conversion tag** — JS pixel on your thank-you/confirmation page.
2. **Google Analytics 4 → Google Ads import** — bring conversions defined in GA4 into Ads.
3. **Server-side / Enhanced Conversions** — for accuracy under cookie loss.

**Pick at least one. Two is better.** Without conversion data:
- Smart Bidding has nothing to optimize toward → wasted spend
- You can't see CPA → you can't know if a campaign is profitable
- OpenAdKit's /optimize/budget will refuse to give specific recommendations (it has a STOP condition for "tracking not verified")

**Setup checklist**:
- [ ] Conversion action created in Ads
- [ ] Conversion value defined (use dynamic value for ecom, static for leads)
- [ ] Attribution model chosen (data-driven is the default now)
- [ ] Conversion window set (30 days click / 1 day view typical)
- [ ] Enhanced Conversions enabled if you have any email data on the thank-you page
- [ ] Test conversion fires within 24 hours of setup`,
        quick_action: "Confirm at least one conversion fired in the last 7 days under \"Conversion actions.\" If zero, stop everything else and fix this.",
        ai_practice_prompt: "Once tracking is live, run /optimize/budget — the audit will work properly with real data.",
      },
      {
        slug: "smart-vs-manual",
        title: "Smart Bidding vs Manual CPC — when each one wins",
        read_minutes: 6,
        takeaway: "Manual CPC for low volume. Smart Bidding once you have 30+ conversions/month. Don't switch before the algorithm has data.",
        body_md: `# Pick the strategy your conversion volume can support

| Strategy | Min conv/30d | Goal | Use when |
|---|---|---|---|
| Manual CPC | any | full control | new accounts, < 15 conv/mo |
| Enhanced CPC | any | gentle automation | bridge to smart, < 15 conv/mo |
| Maximize Conversions | 15 | grow conv volume | scaling, daily budget flexible |
| Target CPA (tCPA) | 30 | hit specific CPA | mature campaign, CPA target known |
| Target ROAS (tROAS) | 50 | maximize revenue | ecommerce with revenue tracking |
| Maximize Conversion Value | 30 | grow revenue | ecom without strict ROAS target |

**The mistake**: enabling tCPA on a campaign with 10 conversions/month. The algorithm doesn't have enough signal to optimize → results get worse before they get better, then you panic, then you switch back. Don't.

**Graduation path**: Manual → ECPC → MaxConv → tCPA → tROAS. Each step gates on conversion volume.

**Learning phase**: every time you switch strategies (or change daily budget by >20%, or radically change targeting), Smart Bidding resets and learns for ~7 days. Don't touch it during that window.`,
        quick_action: "Check your conversion volume per campaign (last 30 days). Match each to the right strategy in the table above.",
        ai_practice_prompt: "Use /optimize/bid-strategy with your real numbers for a campaign-specific recommendation.",
      },
      {
        slug: "search-terms",
        title: "Reading your Search Terms Report (where waste hides)",
        read_minutes: 4,
        takeaway: "The Search Terms Report is the difference between profitable and not. Review weekly. Negatives compound.",
        body_md: `# Where you find the real queries triggering your ads

Search Terms Report (Keywords → Search Terms) shows the ACTUAL user queries that triggered your ads — not the keywords you bid on, but what users typed.

**Weekly ritual** (15 minutes):

1. Filter to last 7 days
2. Sort by Cost descending
3. For every query with high cost but zero conversions:
   - Was it relevant? Yes → keep, raise bid maybe
   - Was it irrelevant? No → add as a NEGATIVE keyword (-"term") or (-"term") at the right match type
4. For every query with conversions:
   - Is it a long-tail variant of one of your keywords? Yes → consider adding it as its own keyword with a more specific ad group

**The compounding effect**: every negative you add now will save money every week from now on. A campaign with 200+ well-chosen negatives often outperforms one with 50.`,
        quick_action: "Right now: pull the last 30 days of Search Terms. Add 10 negatives. That's a measurable week-over-week impact.",
        ai_practice_prompt: "/optimize/keywords can suggest 20 likely negatives for any product without needing access to your account.",
      },
      {
        slug: "first-optimization-routine",
        title: "Your first weekly optimization routine",
        read_minutes: 5,
        takeaway: "45 minutes, every Monday. The same 8 checks every time. Improvements compound.",
        body_md: `# The 45-minute Monday playbook

**Step 1 (5 min) — Anomaly scan**
Compare last 7 days vs prior 7 days on the campaign overview. Any KPI moved > 20%? Investigate before doing anything else.

**Step 2 (10 min) — Search Terms negatives**
Last 7 days. Add the obvious negatives. Aim for 5–10 new ones every Monday.

**Step 3 (5 min) — Quality Score scan**
Sort top 30 keywords by spend. Note any QS ≤ 5 — flag them as next week's rewrite candidates.

**Step 4 (5 min) — Bid/budget pacing**
Are any campaigns impression-share-limited by budget? By rank? Decide: raise budget, raise bid, or accept the cap.

**Step 5 (5 min) — Audience signals**
Device + geo + age performance. Anything way over or under index? Bid adjustment.

**Step 6 (5 min) — Creative**
Is any single ad doing >70% of impressions? You need more variants. Is one underperforming? Pause it.

**Step 7 (5 min) — Conversions tracking sanity**
Conversion action firing? CPA stable? Any anomalies in conversion volume?

**Step 8 (5 min) — Notes for next week**
What tests do you want to run? What questions did this audit raise?

**The point**: you do this every Monday, every Monday, every Monday. The compounding is the whole game.`,
        quick_action: "Put a 45-min calendar block titled \"Google Ads Monday\" recurring weekly. That's it. Just the block.",
        ai_practice_prompt: "OpenAdKit has /checklist/weekly — every Monday this turns into a 45-min checked-off ritual instead of an ad-hoc poke.",
      },
    ],
  },

  {
    slug: "meta",
    name: "Meta Ads — Beginner Track",
    blurb: "10 lessons covering the funnel, learning phase, creative formats, and how to scale. ~55 min total.",
    lessons: [
      {
        slug: "funnel",
        title: "The Meta funnel — cold, warm, hot",
        read_minutes: 5,
        takeaway: "Three audience temperatures need three different creatives. Don't show a 'buy now' ad to someone who's never heard of you.",
        body_md: `# Audience temperature is everything

**Cold** — never heard of you. They scroll past most things. Job of the ad: stop the scroll, plant a memorable concept. KPI: hook rate (3-second video views / impressions).

**Warm** — engaged with you somehow. Watched 25%+ of a video, visited your site, liked a post. Job of the ad: convince. KPI: click-through, time on site.

**Hot** — added to cart, started a form, viewed pricing. Job of the ad: close. KPI: conversion, ROAS.

**Beginner mistake**: running one campaign with one ad to everyone. Cold audiences see your "Buy now 50% off" ad and ignore it. Hot audiences see your "What is [product]" awareness ad and roll their eyes.

**Fix**: at least three campaigns. Three audiences. Three creative styles.`,
        quick_action: "Look at your current Meta campaigns. Are they split by temperature? If they're all running the same creative to all audiences, that's tomorrow's work.",
        ai_practice_prompt: "/optimize/audience returns a three-tier targeting plan ready to copy into Ads Manager.",
      },
      {
        slug: "objective",
        title: "Picking the right campaign objective",
        read_minutes: 5,
        takeaway: "Pick the objective for the outcome you can actually measure — not the one with the biggest scale.",
        body_md: `# Six objectives, very different optimizations

Meta groups campaign objectives into six buckets:

1. **Awareness** — reach + brand awareness. Use if you have brand budget AND can't track a specific conversion.
2. **Traffic** — link clicks or landing-page views. Use for content marketing, top-funnel intent capture.
3. **Engagement** — likes, comments, post engagement. Niche use cases: contests, community building.
4. **Leads** — Instant Forms or messaging conversations. Use for lead gen with native Meta forms.
5. **App promotion** — installs, in-app events. Use for app advertisers.
6. **Sales** — purchase / conversion events tracked via Pixel/CAPI. Use for ecommerce.

**The trap**: picking "Sales" for your awareness campaign because you secretly want sales. Sales objective only optimizes well with ≥ 50 conversion events / 7 days per ad set. Without that signal, it's just an expensive way to reach a small audience.

**Rule of thumb**: optimize for the event you can RELIABLY track AT VOLUME. If you can't, drop one funnel stage and pick a softer event.`,
        quick_action: "Check each of your ad sets. Are you optimizing for purchase but getting < 10 purchases/week? Switch to Add to Cart or Lead until you scale.",
        ai_practice_prompt: "/optimize/bid-strategy will pick the right objective + optimization event based on your real conversion volume.",
      },
      {
        slug: "audience-building",
        title: "Audience building basics",
        read_minutes: 5,
        takeaway: "Stack signals, don't narrow. Broad with strong creative beats narrow with weak creative.",
        body_md: `# How Meta's audience system actually works

Meta's algorithm is good at finding buyers WITHIN a reasonable starting pool. Your job is to give it a reasonable starting pool — not to manually find every right person.

**Stacking** (good): Interests in {Yoga OR Pilates OR Wellness} AND Behaviors in {Online Shoppers} AND Age 25-45. The algorithm has room to optimize.

**Narrowing** (often bad): Interest in Pilates AND Yoga AND Wellness AND Behavior X AND Age 30-35 AND specific Job Title. The audience becomes 50k people, your ad budget overlaps the same 5k of them weekly, frequency goes to 8, CPMs spike.

**Lookalike audiences**: feed Meta a list of your best customers (or top 1% of website visitors) and ask it to find similar people. 1% is tightest; 5% is broader. 1% rarely beats 3% — and 10% is usually no better than broad.

**Advantage+ Audience** (Meta's auto-targeting): in 2025 most accounts find this competitive with manual targeting at lower management overhead. Test it with your existing creative.`,
        quick_action: "If any of your ad sets has audience size < 500k (excluding retargeting), broaden it.",
        ai_practice_prompt: "/optimize/audience builds the full three-tier audience plan for any platform.",
      },
      {
        slug: "creative-formats",
        title: "Creative formats — when to use which",
        read_minutes: 6,
        takeaway: "Reels CPM ~40% lower than Feed. Carousel CTR ~72% higher than single image. Video > static in 2025.",
        body_md: `# Six formats, big performance gaps

**Single image** — fast to make, easy to A/B test. Floor for most campaigns.

**Single video** — usually 1.5-3× the CTR of static at the same CPM. Required for cold audience IMO.

**Carousel** — multiple cards swipeable. Meta's 2025 data shows ~72% higher CTR than single-image average. Especially strong for: feature breakdowns, multi-product, before/after stories.

**Collection** — mobile-only, feed format pairing hero media + product catalog. Best for ecommerce with broad catalog.

**Stories / Reels** (9:16) — full-screen vertical. CPMs are ~40% lower than Feed because demand still lags supply. If you're not running Reels variants, you're paying a premium for Feed.

**Instant Experience** (formerly Canvas) — full-screen post-click experience. Niche but useful for high-consideration products.

**The 2025 default**: every campaign should ship with a Reels variant. Period.`,
        quick_action: "If you have a working Feed ad with no Reels variant, that's tomorrow's 30-minute fix.",
        ai_practice_prompt: "/generate/meta with format=reels generates a full vertical script, overlays, and B-roll list.",
      },
      {
        slug: "primary-text",
        title: "Writing primary text that stops the scroll",
        read_minutes: 5,
        takeaway: "First 125 chars do all the work. Everything after \"See more\" is for the 20% who already cared.",
        body_md: `# The above-the-fold rule

Meta's feed truncates primary text at ~125 characters with a "See more" link. Most users never click it. So:

**Your job is to make the first 125 chars do ALL the persuasion**: hook + key benefit + (sometimes) the CTA.

**Three opening patterns that work**:

1. **Pain-lead**: "Spent 4 hours on a single report? Here's how the team at Notion cut it to 8 minutes."
2. **Curiosity-lead**: "We tested 47 cold-email subject lines. The winner had 2 words. (Spoiler: not the obvious 2.)"
3. **Specific-numbers-lead**: "$1,840/month into Meta with 0 conversions. Then we changed one thing. Here's the audit."

**Patterns that don't work**:
- "Are you tired of X?" (rhetorical question — easy to ignore)
- "Introducing our new..." (announcement framing — nobody cares)
- Emoji before the hook ("🚀 Big news") — performs worse than a clean opener`,
        quick_action: "Open one of your ads. If the first 125 chars don't make the case alone, rewrite them.",
        ai_practice_prompt: "/generate/meta produces 3 angle-distinct variants — copy your winner straight to Ads Manager.",
      },
      {
        slug: "learning-phase",
        title: "The learning phase — don't panic, don't touch it",
        read_minutes: 4,
        takeaway: "First 7 days or 50 conversions per ad set, Meta is learning. Touch nothing significant. Wait.",
        body_md: `# The single most ignored rule on Meta

Every new ad set enters a "learning phase" — Meta's algorithm explores audiences and placements to figure out who converts. The phase exits when the ad set reaches ~50 optimization events (conversions / leads / purchases) within 7 days.

**During learning**:
- Performance is volatile (anywhere from awful to amazing day to day)
- CPMs are typically higher than they'll be after exit
- Conversions are unreliable as a signal

**The mistake**: editing the ad set, changing budget by > 20%, switching creative, changing audience — every one of these RESETS the learning phase. You then spend another 7 days re-learning.

**The discipline**: launch the ad set, let it run, do NOT touch it for 7 days, then evaluate. If after 7 days you have < 50 conversions/week, the issue is volume — increase budget, broaden audience, or pick a softer optimization event.

**The exception**: if performance is catastrophically bad in 48 hours (CPA 5× target, frequency already > 4, near-zero CTR), kill it and start fresh — don't edit.`,
        quick_action: "Look at any ad set currently in learning. Are you tempted to edit it? Don't. Set a reminder for day 7.",
        ai_practice_prompt: "/optimize/bid-strategy explains the learning-phase rules per platform with your specific event volume.",
      },
      {
        slug: "attribution",
        title: "Reading attribution and the iOS 14 hangover",
        read_minutes: 5,
        takeaway: "Meta's attribution window is shorter than it used to be. Trust the trend, not the daily number.",
        body_md: `# Attribution is fuzzier than it looks

Meta defaults to **7-day click + 1-day view** attribution. That means:
- A user clicks your ad, buys 6 days later → Meta gets credit.
- A user clicks your ad, buys 8 days later → Meta gets nothing.
- A user SEES your ad (no click), buys within 24 hours → Meta gets credit.

**The iOS 14 hangover**: since ATT, Meta loses signal on ~30% of iOS users. They model the rest. Your reported conversions are *slightly* understated. Your actual ROAS is *probably* higher than dashboard says — but you can't know exactly.

**The discipline**:
- Don't optimize daily. The 7-day click window means day-by-day is too noisy.
- Compare 14-day chunks (this 14d vs prior 14d).
- Use a backup source: your own analytics, post-purchase survey ("where did you hear about us?"), incremental geo-holdouts.

**Conversion API (CAPI)**: server-side conversion tracking. If you don't have it, set it up. Recovers 5-15% of lost conversion signal.`,
        quick_action: "Check whether your account has CAPI configured. If not, that's your week-after-next priority.",
        ai_practice_prompt: "Future versions of OpenAdKit will compare reported vs modeled conversions; for now, /report gives an honest write-up of the numbers you have.",
      },
      {
        slug: "fatigue",
        title: "Ad fatigue — when and how to refresh",
        read_minutes: 5,
        takeaway: "Frequency > 3 → diminishing returns. CTR drop > 20% week-over-week → swap creative. Don't kill — refresh.",
        body_md: `# The math of running out of audience

Meta ads fatigue when your audience starts seeing the same creative too often. Signals:

1. **Frequency > 3.0** in a 7-day window
2. **CTR drop > 20%** week-over-week
3. **CPM rising** with the same audience
4. **Comments turning negative** ("seeing this ad everywhere", complaints)

**Don't immediately kill** a fatigued winner. Refresh it:

- **Low effort (1-2 hours)**: change opener, swap thumbnail, change CTA verb, recut the same footage with different B-roll order.
- **Medium (half-day)**: same offer, new angle. Pain → outcome. Outcome → social proof.
- **High (1-2 days)**: new creator, new format (Reels of a winning Feed ad).

**The 80/20**: a winning angle usually has 3-4 creative iterations before it actually dies. Don't write it off after one.`,
        quick_action: "Pull frequency on each of your active ad sets. Anything > 3.0 needs a creative variant this week.",
        ai_practice_prompt: "/optimize/ad-fatigue scores all four fatigue signals + ranks refresh options by effort.",
      },
      {
        slug: "lookalikes",
        title: "Lookalike audiences and how to seed them",
        read_minutes: 4,
        takeaway: "Quality of seed > size of seed. 500 paying customers > 10,000 newsletter signups.",
        body_md: `# A lookalike is only as good as its seed

Meta's lookalike algorithm finds the % of the population most similar to your seed list. The seed dictates EVERYTHING.

**Good seeds** (in order):
1. Your best 1,000 paying customers (filtered to LTV > median)
2. Your most recent 5,000 paying customers (broader, more current)
3. 30-day buyers (recent intent)
4. Site visitors who hit pricing/checkout (high intent, decent volume)
5. 75%+ video viewers (intent signal even without site action)

**Bad seeds**:
- All newsletter signups (mostly tire-kickers)
- All "engaged users" (likes/comments are not commercial intent)
- Cold lead lists you imported (these people don't act like your customers)

**% setting**: 1% (tightest, ~2M in US) usually beats 5% on cold prospecting. 5% gives more reach for retargeting-style "warm-ish" use.

**Minimum seed size**: Meta technically allows 100 records. Realistically, 500+ produces meaningfully better matches.`,
        quick_action: "What seed list are your lookalikes built from? If it's not paying customers, fix that next week.",
        ai_practice_prompt: "/optimize/audience prescribes specific lookalike seeds for your tier-1 cold prospecting.",
      },
      {
        slug: "scaling",
        title: "Scaling — horizontal vs vertical",
        read_minutes: 5,
        takeaway: "Vertical = raise budget on a winner (slow, safe). Horizontal = duplicate winners into new audiences (fast, risky).",
        body_md: `# Two ways to scale, very different mechanics

**Vertical scaling**: raising the budget on an existing winning ad set.

- The right move when: your winner is stable (mature, learning-phase complete, ≥ 50 conv/7d).
- The rule: increase by 15-30% per change, no more often than every 3-4 days. Bigger jumps reset learning.
- Eventually hits a ceiling — the audience saturates, frequency climbs, CPA grows.

**Horizontal scaling**: duplicating winners into new audiences (new lookalikes, new interest stacks, new geos).

- The right move when: vertical is hitting saturation, OR you've validated the creative and want to multiply reach.
- The rule: clone the ad set, change only the audience, restart learning. Expect each new audience to take 7-14 days to stabilize.
- Risk: each clone takes time + budget to learn. Don't clone into 5 new audiences at once if you can't afford 5 learning phases simultaneously.

**The hybrid**: scale vertically until CPA drifts up 15%, then start horizontal. Repeat.`,
        quick_action: "Look at your biggest winner. Is it close to saturation (frequency > 2.5, CPA drifting)? Plan a horizontal clone for next week.",
        ai_practice_prompt: "/optimize/ad-fatigue + /optimize/audience together produce a scaling roadmap.",
      },
    ],
  },

  {
    slug: "tiktok",
    name: "TikTok Ads — Beginner Track",
    blurb: "8 lessons on why TikTok is different + how to write native creative + reading the analytics. ~45 min.",
    lessons: [
      {
        slug: "why-different",
        title: "Why TikTok ads are different",
        read_minutes: 4,
        takeaway: "Polished = ignored. Native = clicked. Treat TikTok as content production, not ad production.",
        body_md: `# The single biggest mental shift

On Meta, polished creative often wins. On TikTok, polished creative often LOSES. The platform rewards content that looks like every other organic post.

**Why**: TikTok users opt into the feed expecting entertainment, not commerce. Anything that screams "ad" gets thumbed past in 0.4 seconds. Polished production tells the brain "this is an ad."

**The implication**: TikTok creative production is closer to a creator workflow than an agency workflow. UGC > studio shoots. Phone footage > cinema cameras. Casual voiceover > polished VO talent.

**The numbers**: TikTok engagement rate averages 5-16% (vs Meta Feed ~1.2%, Meta Stories ~0.7%). CPMs are 40-60% cheaper than Meta on most verticals. But only if the creative is native.`,
        quick_action: "Look at your existing TikTok creative. Does it look like an organic post you'd scroll past? If not, you're paying for the polish.",
        ai_practice_prompt: "/generate/tiktok with format=ugc_script returns native-feeling creator briefs.",
      },
      {
        slug: "algorithm",
        title: "The algorithm and how it affects ads",
        read_minutes: 5,
        takeaway: "TikTok scores every video in real-time on the first 500-1000 impressions. Win the first 3 seconds or you're done.",
        body_md: `# The first 3 seconds decide your ad's fate

TikTok's For You Page algorithm scores every video — organic AND paid — on:
- **Completion rate** (watched to the end)
- **Loop rate** (watched twice)
- **Engagement rate** (likes, comments, shares, saves)
- **Watch time per impression**

**Signal compression**: TikTok decides whether to promote your video aggressively within 500-1000 impressions. If hook rate (3-second view rate) is below ~30%, the algorithm caps distribution. You can spend more — but you're force-feeding a bad video to a paid audience.

**The implication**: your hook (first 1.5-2 seconds) is the single most important asset. Test 10 hooks for every 1 body-of-video you produce.

**Hook formulas that work**:
- "POV: [unexpected scenario]"
- "Stop scrolling if you [target audience pain]"
- "I tried [thing] for 30 days, here's what happened"
- "The reason your [X] isn't working"
- Pattern interrupt: an unusual visual or sound in first 0.5s`,
        quick_action: "Check the Hook Rate column on your active TikTok ads. Anything < 30% needs a new hook this week.",
        ai_practice_prompt: "/generate/tiktok format=hooks gives you 50 hook variants in one Claude call.",
      },
      {
        slug: "hook-psychology",
        title: "Hook psychology — 1.5 seconds to hook",
        read_minutes: 5,
        takeaway: "Pattern interrupt > question. Specificity > vagueness. Identity-naming > generic claims.",
        body_md: `# Three families of hooks that consistently win

**1. Pattern interrupt** — visual or sonic shock that breaks the scroll rhythm.
- Strong: opening on a CLOSE-UP face mid-shock instead of a wide establishing shot.
- Strong: opening on a sound the user didn't expect (gasp, sharp object dropping).

**2. Identity callout** — name the viewer in the first second.
- "If you're a freelance designer who hates pricing your work…"
- "POV: you're a marketing manager who just inherited a broken Meta account…"

**3. Specificity / contrarian claim** — a specific number or counterintuitive statement.
- "I made $14k in November from one app — and it took me 4 hours total."
- "Stop spending on TikTok ads. Spend on creators instead. Here's the math."

**Hooks that consistently underperform**:
- Rhetorical questions ("Tired of X?")
- Brand-led openers ("At Acme, we believe...")
- Slow b-roll with VO over it
- Anything that takes > 2 seconds to reach a concrete idea`,
        quick_action: "Rewrite your 3 worst-performing TikTok ad hooks using one of the three formulas above.",
        ai_practice_prompt: "Run /generate/tiktok format=hooks for your product — pick the 5 you'd actually film.",
      },
      {
        slug: "native-vs-polished",
        title: "Native vs polished — what TikTok rewards",
        read_minutes: 4,
        takeaway: "Filmed on phone, lit by window, edited in CapCut > anything that looks agency-produced.",
        body_md: `# What "native" actually means in 2025

**Native production cues**:
- Phone vertical footage (9:16)
- Natural lighting (a window, golden hour, kitchen)
- Imperfect audio (some room noise is fine)
- CapCut-style transitions, not After Effects
- On-screen text that looks like TikTok's default text overlays
- Creator handles voiceover in their natural voice

**Non-native cues TikTok users instantly clock as "ad"**:
- Studio lighting
- Multi-camera setup
- Polished color grading
- Professional VO talent
- Brand logo overlay corners
- 2D motion graphics

**The exception**: high-budget premium brands (luxury, automotive) sometimes win with deliberately polished creative as a "premium-vibe" signal. For everyone else: don't.`,
        quick_action: "Audit your last 3 TikTok ads. Native, polished, or in-between? If polished, that's your next iteration.",
        ai_practice_prompt: "/generate/tiktok format=ugc_script writes briefs FOR creators, not for production teams.",
      },
      {
        slug: "creator-briefs",
        title: "UGC briefs that creators can actually execute",
        read_minutes: 5,
        takeaway: "Bullet-pointed, show-don't-tell, with a single performance goal. Not a script. Not a brand bible.",
        body_md: `# How to brief a creator without killing the post

**What a good brief contains**:

1. **Product context** (3-4 sentences max) — what it is, who it's for, what makes it different. Plain English.
2. **A single performance goal** — "Get the viewer to think 'I need to try that' in the first 6 seconds." NOT "drive brand awareness."
3. **Show-don't-tell list** — what they should physically demonstrate, in their own way.
4. **Do-not list** — things that will get the post rejected (claims you can't substantiate, sensitive language, competitor mentions).
5. **A reference video** — link to one organic post they made that's the closest match to the tone you want.
6. **Compliance line** — required disclosure language (FTC, TikTok policy).

**What a good brief does NOT contain**:
- A line-by-line script
- Brand voice guidelines
- A storyboard
- Multiple optional CTAs
- Restrictions that override their creative voice (e.g. "must use these exact words")

**The rule**: if the brief makes the creator sound like your marketing team, the post will sound like a marketing post.`,
        quick_action: "Find your last creator brief. Count: is it longer than 1 page? Cut it in half.",
        ai_practice_prompt: "/generate/spark-ads produces a creator brief in the right shape — copy + send.",
      },
      {
        slug: "ad-formats",
        title: "TikTok ad formats explained",
        read_minutes: 4,
        takeaway: "In-Feed is the default. Spark Ads usually beat In-Feed. TopView is for tentpole moments. Skip Branded Effects unless you have agency budget.",
        body_md: `# Five ad formats, very different use cases

**In-Feed Ads** — standard 9:16 videos that appear in the For You feed. The workhorse. 5-60s, recommend 15-30s. Skippable. Most accounts run primarily this.

**Spark Ads** — boost an existing organic post (yours or a creator's). Inherits the post's social proof (comments, likes). 30% lower CPM than standard In-Feed on average. **Recommended default for any account with active organic posting**.

**TopView** — full-screen takeover on app launch. Premium pricing. Use only for product launches, tentpole campaigns, or major announcements. Day-one impression cost is high but lifetime brand impact can justify it.

**Branded Hashtag Challenge** — user-generated content campaign around a hashtag. Massive scale (1M+ video creations possible). $100k+ minimum, agency lift required. Skip unless you have the budget AND the cultural moment.

**Branded Effects** — custom AR filters. Same caveat as Branded Hashtag Challenge.`,
        quick_action: "If you're running In-Feed but never Sparks, that's the highest-ROI shift you can make next week.",
        ai_practice_prompt: "/generate/spark-ads gives you boost criteria + creator brief in one pass.",
      },
      {
        slug: "analytics",
        title: "Reading TikTok analytics",
        read_minutes: 4,
        takeaway: "Hook rate is the leading indicator. CTR is lagging. CPA is the final word.",
        body_md: `# The 3 metrics that matter, in order

**Hook rate** (3-second view rate / impressions) — the LEADING indicator. Tells you whether the algorithm is going to give your ad oxygen.
- ≥ 30% = scale aggressively
- 20-30% = working, iterate
- < 20% = the hook is the problem

**Watch-through rate** at 25%, 50%, 75% — tells you where the video loses viewers. If 25% holds but 50% craters, you've got a "middle problem." If 25% itself craters, hook is bad.

**CTR (link clicks / impressions)** — secondary. Useful, not deterministic. A video with 5% hook rate and 1.5% CTR can outperform a video with 2% hook rate and 2.5% CTR because the first scales further.

**CVR (conversions / clicks)** — landing-page problem, not ad problem.

**CPA** — the only thing that matters at the end of the day.

**Reading the diagnostic chain**: bad CPA? Check CVR (landing page). CVR fine? Check CTR (ad → landing match). CTR fine? Check hook rate (algorithm distribution).`,
        quick_action: "Pull hook rate on your active TikTok ads. Sort ascending. The bottom 25% need new hooks.",
        ai_practice_prompt: "/optimize/ctr with TikTok In-Feed selected diagnoses the lever-by-lever issues.",
      },
      {
        slug: "scaling-tiktok",
        title: "Scaling winning TikTok creatives",
        read_minutes: 4,
        takeaway: "TikTok creatives have a 7-10 day shelf life. Build a refresh cadence — don't milk a winner to death.",
        body_md: `# TikTok creative fatigues 2-3× faster than Meta

A winning TikTok ad's lifecycle is typically:
- Days 1-2: learning, performance volatile
- Days 3-7: peak, scale daily budget here
- Days 8-10: fatigue creep — frequency climbs, CPA drifts up
- Day 10+: kill or refresh

**Implication**: you can't ride one TikTok winner the way you can ride a Meta winner. You need a CREATIVE PIPELINE. Most accounts that win at TikTok long-term are producing 4-10 new creatives per week.

**Scaling moves**:
1. **Vertical**: raise daily budget 30-50% per change every 24-48 hours on a winner. (Faster than Meta because creative lifespan is shorter — you don't have time to be cautious.)
2. **Horizontal**: clone the winning concept with a DIFFERENT creator or different hook. Same body, new top-of-funnel.
3. **Spark variants**: if the winner is creator-led, ask the creator for 2-3 alternate hooks for the same body.

**The pipeline rule**: don't enter Monday without 3 new creatives ready to ship. Without that, you'll be stuck patching winners that are already dying.`,
        quick_action: "Set up a weekly content calendar with at least 3 new TikTok creatives committed to. Forever.",
        ai_practice_prompt: "/generate/tiktok format=hooks + /generate/spark-ads cover the upper half of your weekly pipeline.",
      },
    ],
  },
];

export function findCourse(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function findLesson(courseSlug: string, lessonSlug: string): { course: Course; lesson: Lesson } | undefined {
  const course = findCourse(courseSlug);
  const lesson = course?.lessons.find((l) => l.slug === lessonSlug);
  if (!course || !lesson) return undefined;
  return { course, lesson };
}
