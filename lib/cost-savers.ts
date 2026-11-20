export interface CostSaverTip {
  tactic: string;
  why: string;
  expected_savings: string;
  effort: "low" | "medium" | "high";
}

export interface CostSaverPlatform {
  platform: "google" | "meta" | "tiktok" | "linkedin";
  name: string;
  tips: CostSaverTip[];
}

export const COST_SAVERS: CostSaverPlatform[] = [
  {
    platform: "google",
    name: "Google Ads",
    tips: [
      { tactic: "Add 50+ negative keywords before campaign launch", why: "Stops irrelevant queries from triggering ads on day one.", expected_savings: "15-30% of first-month spend", effort: "low" },
      { tactic: "Use Phrase or Exact match for new campaigns", why: "Broad match without Smart Bidding burns budget on tangential queries.", expected_savings: "20-40% wasted spend", effort: "low" },
      { tactic: "Schedule ads during your best conversion hours only", why: "Conversion rate often varies 3-5× by time of day. Off-hours = empty spend.", expected_savings: "10-25%", effort: "low" },
      { tactic: "Exclude mobile apps from Display Network", why: "Mobile app placements are the largest waste source on GDN — accidental clicks dominate.", expected_savings: "30-60% on Display", effort: "low" },
      { tactic: "Turn off Google Search Partners if CTR is below 1%", why: "Search Partners delivers lower-intent traffic at higher CPC for many advertisers.", expected_savings: "10-25%", effort: "low" },
      { tactic: "Set frequency caps on Display campaigns", why: "Without caps, the same user can see your ad 20+ times — wasted impressions.", expected_savings: "5-15%", effort: "low" },
      { tactic: "Improve Quality Score by 2 points on top spenders", why: "A higher Quality Score lowers CPC for the same ad position (Google's auction uses it). The size of the drop varies by account.", expected_savings: "Directional: lower CPC on the improved keywords", effort: "medium" },
      { tactic: "Pause keywords with > 50 clicks and 0 conversions", why: "Statistical confidence that this term doesn't convert. Pull it.", expected_savings: "5-15%", effort: "low" },
      { tactic: "Use single-theme ad groups (≤ 15 closely related keywords)", why: "Tighter themes → higher Quality Score → lower CPC.", expected_savings: "10-20%", effort: "medium" },
      { tactic: "Add long-tail variants of your top converters", why: "Long-tails have 50-80% lower CPC at often higher conversion rate.", expected_savings: "Net spend efficiency 10-25%", effort: "medium" },
    ],
  },
  {
    platform: "meta",
    name: "Meta Ads",
    tips: [
      { tactic: "Consolidate ad sets to avoid audience overlap", why: "Overlapping audiences bid against each other → you pay yourself more.", expected_savings: "10-20%", effort: "medium" },
      { tactic: "Use Campaign Budget Optimization (CBO)", why: "Lets Meta shift budget to winning ad sets in real time.", expected_savings: "5-15%", effort: "low" },
      { tactic: "Let learning phase complete (≥ 7 days untouched)", why: "Each edit resets the algorithm → you re-pay for learning.", expected_savings: "Avoid 15-30% repeat waste", effort: "low" },
      { tactic: "Exclude recent converters from prospecting campaigns", why: "You're paying to re-acquire existing customers if you don't exclude them.", expected_savings: "5-15%", effort: "low" },
      { tactic: "Test Advantage+ placements vs manual", why: "Advantage+ often wins on cost; manual placements can over-spend on Feed.", expected_savings: "8-20%", effort: "low" },
      { tactic: "Add Reels variants — 40% lower CPM than Feed", why: "Reels supply still exceeds advertiser demand in 2025.", expected_savings: "30-40% on impressions", effort: "medium" },
      { tactic: "Suppress your customer list from cold campaigns", why: "Upload Customer Match → exclude from prospecting audiences.", expected_savings: "5-12%", effort: "low" },
      { tactic: "Kill ad sets in Learning Limited status after 14 days", why: "Below 50 conversions/week = algorithm can't optimize → CPA inflates.", expected_savings: "Loss containment", effort: "low" },
      { tactic: "Set frequency cap to 2-3 per 7 days on retargeting", why: "Past 3, return curve flattens, ad fatigue + brand-damage risk grows.", expected_savings: "10-20% retargeting spend", effort: "low" },
      { tactic: "Use lookalike 1% from paying customers, not all signups", why: "Seed quality > seed size. 500 paying > 50,000 newsletter signups.", expected_savings: "15-30% on prospecting CPA", effort: "medium" },
    ],
  },
  {
    platform: "tiktok",
    name: "TikTok Ads",
    tips: [
      { tactic: "Scale aggressively when hook rate > 30%", why: "Hook rate is the leading indicator. Above 30% means the algorithm wants to give you more reach.", expected_savings: "Cheaper CPMs at scale", effort: "low" },
      { tactic: "Kill ads with video view rate < 25% within 48h", why: "Bad hook = algorithm caps distribution → you'll spend more for less.", expected_savings: "Loss containment", effort: "low" },
      { tactic: "Use ACO (Automated Creative Optimization)", why: "Tests combinations of creative + text + CTA → cheaper testing.", expected_savings: "20-40% testing cost", effort: "low" },
      { tactic: "Run Spark Ads on organic content with > 5% engagement", why: "Spark Ads CPM is ~30% lower than standard In-Feed — and the social proof compounds.", expected_savings: "25-40% CPM", effort: "medium" },
      { tactic: "Avoid Branded Hashtag Challenge unless > $100k available", why: "Minimum viable spend is high; below it, CPM-equivalent is awful.", expected_savings: "Avoid 6-figure miss", effort: "high" },
      { tactic: "Keep creative lifespan to 7-10 days max", why: "TikTok creatives fatigue 2-3× faster than Meta. Riding a winner to death wastes spend.", expected_savings: "10-25% (avoid declining CPA)", effort: "medium" },
      { tactic: "Use vertical 9:16 only — never repurpose horizontal", why: "Horizontal video gets ~50% lower hook rate on TikTok.", expected_savings: "Massive CPM impact", effort: "low" },
      { tactic: "Front-load the value in first 1.5 seconds", why: "TikTok's algorithm decides distribution by 500-1000 impressions. Win that window.", expected_savings: "Distribution efficiency", effort: "medium" },
      { tactic: "Test with $20-50/day per ad before scaling", why: "TikTok learning needs less data than Meta. Don't over-commit on day 1.", expected_savings: "Test cost containment", effort: "low" },
    ],
  },
  {
    platform: "linkedin",
    name: "LinkedIn Ads",
    tips: [
      { tactic: "Use audience size 300k-1M, not narrower", why: "LinkedIn over-narrows easily. Tight audiences → super-high CPMs.", expected_savings: "20-40%", effort: "low" },
      { tactic: "Exclude competitor employees from prospecting", why: "Competitor employees scrolling cost you. Add as exclusion list.", expected_savings: "5-10%", effort: "low" },
      { tactic: "Use Lead Gen Forms over Website Conversions", why: "Native forms have 3-5× conversion rate vs landing page traffic.", expected_savings: "Lower CPL 30-60%", effort: "low" },
      { tactic: "Schedule ads to weekday business hours only", why: "B2B engagement plummets on weekends. Off-hours spend rarely converts.", expected_savings: "10-20%", effort: "low" },
      { tactic: "Cap frequency at 3 per week per ad", why: "LinkedIn fatigue threshold is lower than Meta — professional context.", expected_savings: "10-15%", effort: "low" },
      { tactic: "Run Conversation Ads only on warm audiences", why: "Conversation Ads have low cold open rates → use them post-engagement.", expected_savings: "Avoid 30-50% waste on Conversation cold", effort: "low" },
      { tactic: "Use Carousel — higher CTR than Single Image on LinkedIn", why: "Carousel format has 30-50% higher CTR than single image in B2B context.", expected_savings: "Net efficiency 15-25%", effort: "medium" },
    ],
  },
];
