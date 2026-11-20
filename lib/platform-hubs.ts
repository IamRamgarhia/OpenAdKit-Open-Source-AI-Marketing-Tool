export interface AdFormatSpec {
  name: string;
  spec: string;
  best_for: string;
  generator_href?: string;
}

export interface PlatformHub {
  slug: string;
  name: string;
  tagline: string;
  intro: string;
  formats: AdFormatSpec[];
  generators: { label: string; href: string }[];
  optimizers: { label: string; href: string }[];
  audience_notes: string[];
  best_practices: string[];
  common_mistakes: string[];
  best_for: string;
  not_for: string;
  external_links: { label: string; url: string }[];
}

export const PLATFORM_HUBS: Record<string, PlatformHub> = {
  google: {
    slug: "google",
    name: "Google Ads",
    tagline: "Intent capture. The user is searching for what you sell — meet them there.",
    intro: "Google Ads spans Search, Performance Max, Shopping, Display, and YouTube. The strongest paid channel for high-intent moments — but only if you have conversion tracking installed.",
    formats: [
      { name: "Responsive Search Ads (RSA)", spec: "15 headlines × 30 chars · 4 descriptions × 90 chars · 2 path × 15", best_for: "Bottom-funnel intent capture. Highest ROAS when audience is searching for you.", generator_href: "/generate/google" },
      { name: "Performance Max", spec: "15 headlines · 5 long headlines · 5 descriptions · image set (3 ratios) · video", best_for: "Multi-surface scaling once you have ≥ 50 conversions/mo.", generator_href: "/generate/google-pmax" },
      { name: "Shopping", spec: "Product title ≤ 150 · description ≤ 5000 · Merchant Center feed", best_for: "E-commerce — visual product listings that intercept search intent.", generator_href: "/generate/google-shopping" },
      { name: "Display Banners", spec: "Standard sizes 728×90, 300×250, 320×50, etc. + responsive display assets", best_for: "Retargeting + brand reinforcement. Not for cold prospecting.", generator_href: "/generate/display" },
    ],
    generators: [
      { label: "Google RSA Generator", href: "/generate/google" },
      { label: "Performance Max", href: "/generate/google-pmax" },
      { label: "Shopping Optimizer", href: "/generate/google-shopping" },
      { label: "Display Banners", href: "/generate/display" },
    ],
    optimizers: [
      { label: "Quality Score Improver", href: "/optimize/quality-score" },
      { label: "Keyword Builder", href: "/optimize/keywords" },
      { label: "Bid Strategy Advisor", href: "/optimize/bid-strategy" },
      { label: "Budget Waste Analyzer", href: "/optimize/budget" },
    ],
    audience_notes: [
      "Match types: phrase + exact tightest control, broad ONLY with Smart Bidding + 50+ negatives.",
      "Audience signals (in-market + custom intent) are recommendations, not constraints — Google can still serve outside.",
      "Negative keywords compound — add 5-10 every week from the search-terms report.",
    ],
    best_practices: [
      "Single-theme ad groups (≤ 15 closely related keywords).",
      "Quality Score ≥ 7 on top spenders — higher QS lowers CPC for the same position.",
      "RSA: include the target keyword in at least 2 headlines.",
      "Always add 4+ sitelinks, 6+ callouts, structured snippets — free CTR boost.",
    ],
    common_mistakes: [
      "Broad match without Smart Bidding (drains budget fast)",
      "Launching without conversion tracking (Smart Bidding can't optimize)",
      "Editing campaigns during learning phase (resets the algorithm)",
      "No negative keyword list",
    ],
    best_for: "E-commerce, B2B SaaS, local services, anyone whose audience searches for the problem.",
    not_for: "Pure awareness plays with thin conversion data.",
    external_links: [
      { label: "Google Ads — sign in", url: "https://ads.google.com" },
      { label: "Ads Transparency Center", url: "https://adstransparency.google.com/" },
      { label: "Keyword Planner", url: "https://ads.google.com/aw/keywordplanner" },
    ],
  },
  meta: {
    slug: "meta",
    name: "Meta · Facebook + Instagram",
    tagline: "Scale through creative. Win or lose on the hook.",
    intro: "Meta Ads is creative-led. The algorithm finds buyers within your audience pool — your job is to give it strong creative + a reasonable starting pool. Reels CPMs are 40% lower than Feed in 2025.",
    formats: [
      { name: "Feed (single image / video)", spec: "Primary text 125 chars above fold (500 max) · headline 27/40 mobile/desktop · description 27", best_for: "Default workhorse. Both Facebook + Instagram.", generator_href: "/generate/meta" },
      { name: "Reels (9:16 video)", spec: "First 1-2 sec hook · 0:09-0:90 length · sound-on assumption but caption mandatory", best_for: "Lowest CPM in 2025. Native-feeling creative wins.", generator_href: "/generate/meta" },
      { name: "Stories (9:16)", spec: "Keep text in center 80% · headline 40 chars", best_for: "High-frequency retargeting · younger audience.", generator_href: "/generate/meta" },
      { name: "Carousel (multi-image)", spec: "2-10 cards · each card 40 char headline + 20 char description", best_for: "+72% CTR vs single image. Multi-product, feature breakdowns, before/after.", generator_href: "/generate/meta" },
      { name: "Collection (mobile-only)", spec: "Hero image/video + product catalog", best_for: "E-commerce with broad catalog.", generator_href: "/generate/meta" },
      { name: "Lead Form (Instant)", spec: "≤ 5 questions recommended · headline 60 · greeting 280", best_for: "Lead gen without sending traffic to a landing page.", generator_href: "/generate/lead-form" },
    ],
    generators: [
      { label: "Meta Ad Generator (3-variant)", href: "/generate/meta" },
      { label: "Lead Form Generator", href: "/generate/lead-form" },
      { label: "AI Image/Video Prompts", href: "/generate/creative-prompts" },
    ],
    optimizers: [
      { label: "Audience Targeting Plan", href: "/optimize/audience" },
      { label: "CTR Optimizer", href: "/optimize/ctr" },
      { label: "Ad Fatigue Detector", href: "/optimize/ad-fatigue" },
      { label: "Bid Strategy", href: "/optimize/bid-strategy" },
    ],
    audience_notes: [
      "Cold audiences 2M-20M wide. Stacking signals beats narrowing.",
      "Lookalike 1% from paying customers > 5% from newsletter signups.",
      "Frequency > 3.0 = diminishing returns.",
      "Advantage+ Audience often wins vs manual targeting in 2025.",
    ],
    best_practices: [
      "First 125 chars of primary text do ALL the persuasion (see-more cut).",
      "Test angles, not word choice. Pain → Outcome → Proof → Curiosity.",
      "Reels variants for every Feed ad — supply still exceeds demand.",
      "Don't touch for 7 days during learning phase.",
    ],
    common_mistakes: [
      "Polished studio-shot creative (looks like an ad, gets ignored)",
      "Narrowing audience to 50k (CPM explodes)",
      "Editing during learning phase (resets)",
      "Single creative — needs 3-5 variants minimum",
    ],
    best_for: "E-commerce, B2C SaaS, consumer apps, lifestyle brands, anything with a strong visual story.",
    not_for: "Pure B2B with niche ICPs (LinkedIn better) or pure-intent moments (Google better).",
    external_links: [
      { label: "Meta Ads Manager", url: "https://business.facebook.com/adsmanager" },
      { label: "Meta Ads Library (competitor spy)", url: "https://www.facebook.com/ads/library/" },
      { label: "Conversion API (CAPI) docs", url: "https://developers.facebook.com/docs/marketing-api/conversions-api" },
    ],
  },
  tiktok: {
    slug: "tiktok",
    name: "TikTok Ads",
    tagline: "Native creative or invisible. The polished ad gets skipped in 0.4 seconds.",
    intro: "TikTok rewards content that looks like every other organic post. Phone footage, natural light, native voice — beats studio production every time. Win the first 1.5 seconds or you're done.",
    formats: [
      { name: "In-Feed Ads", spec: "9:16 video · 5-60s (15-30s optimal) · ad text ≤ 100 chars", best_for: "Default workhorse. Most accounts run primarily this.", generator_href: "/generate/tiktok" },
      { name: "Spark Ads", spec: "Boost existing organic post · keeps comments + likes", best_for: "~30% lower CPM than In-Feed. Default for any account with active organic.", generator_href: "/generate/spark-ads" },
      { name: "TopView", spec: "Full-screen on app launch · premium pricing", best_for: "Product launches, tentpole moments. Skip otherwise.", generator_href: undefined },
      { name: "Branded Hashtag Challenge", spec: "User-generated participation campaign · 6 days featured", best_for: "$100k+ budgets only. Cultural-moment plays.", generator_href: "/generate/branded-hashtag-challenge" },
      { name: "TikTok Hooks (50/click)", spec: "Native hook generator across 10 proven formulas", best_for: "Build your creative pipeline. Hook is the algorithm gate.", generator_href: "/generate/tiktok" },
    ],
    generators: [
      { label: "Hooks + UGC Scripts", href: "/generate/tiktok" },
      { label: "Spark Ads brief", href: "/generate/spark-ads" },
      { label: "Branded Hashtag Challenge", href: "/generate/branded-hashtag-challenge" },
      { label: "Hashtags · any language", href: "/generate/hashtags" },
      { label: "AI image/video prompts", href: "/generate/creative-prompts" },
    ],
    optimizers: [
      { label: "Ad Fatigue Detector", href: "/optimize/ad-fatigue" },
      { label: "CTR Optimizer", href: "/optimize/ctr" },
      { label: "Bid Strategy", href: "/optimize/bid-strategy" },
    ],
    audience_notes: [
      "Interest targeting + lookalikes. The algorithm finds buyers within reasonable starting pools.",
      "Custom audiences via website pixel + customer match.",
      "Spark Ads inherit the original creator's social proof.",
    ],
    best_practices: [
      "Hook rate > 30% = scale aggressively. Below 20% = new hook needed.",
      "Vertical 9:16 only — never reuse horizontal video.",
      "Captions mandatory (85% watch without sound).",
      "Creative lifespan 7-10 days — build a pipeline of 3+ new creatives per week.",
    ],
    common_mistakes: [
      "Studio production (instantly clocked as ad)",
      "Logo card / brand-led opener (skipped in 0.5s)",
      "Reusing Meta creative without re-cutting for TikTok",
      "Riding one winner to fatigue — need pipeline",
    ],
    best_for: "DTC brands, consumer apps, lifestyle products, anything that benefits from creator content.",
    not_for: "B2B with old ICPs (40+ executives don't shop here).",
    external_links: [
      { label: "TikTok Ads Manager", url: "https://ads.tiktok.com" },
      { label: "TikTok Top Ads (competitor spy)", url: "https://ads.tiktok.com/business/creativecenter/topads/" },
      { label: "TikTok Creative Center", url: "https://ads.tiktok.com/business/creativecenter" },
    ],
  },
  youtube: {
    slug: "youtube",
    name: "YouTube Ads",
    tagline: "Video, intent-aligned. Sit on the searches your buyers do anyway.",
    intro: "YouTube runs through Google Ads. Strongest when combined with custom-intent audiences (people who recently searched for your keywords). In-Stream wins on attention; Bumpers on memorability; Discovery on intent.",
    formats: [
      { name: "In-Stream (skippable after 5s)", spec: "Up to 60s. Skippable. Pay-per-view (30s+ watch).", best_for: "Consideration + retargeting. Win the first 5 seconds.", generator_href: "/generate/youtube" },
      { name: "Bumper Ads (6s non-skippable)", spec: "6 seconds exactly · sound-off assumption", best_for: "Brand recall + reinforcement. Pairs with longer In-Stream.", generator_href: "/generate/youtube" },
      { name: "Discovery / In-Feed", spec: "Thumbnail + headline in search/related results", best_for: "Intent capture for YouTube searches. Lower-funnel.", generator_href: "/generate/youtube" },
      { name: "Masthead", spec: "Homepage takeover · CPM pricing", best_for: "Tentpole brand launches. $50k+ budget.", generator_href: undefined },
    ],
    generators: [
      { label: "YouTube Scripts (In-Stream / Bumper / Discovery)", href: "/generate/youtube" },
      { label: "AI Image/Video Prompts", href: "/generate/creative-prompts" },
    ],
    optimizers: [
      { label: "CTR Optimizer", href: "/optimize/ctr" },
      { label: "Keyword Builder", href: "/optimize/keywords" },
      { label: "Bid Strategy", href: "/optimize/bid-strategy" },
    ],
    audience_notes: [
      "Custom intent = people who searched for keywords. Most powerful YouTube audience.",
      "In-market segments + lookalikes from existing customer list.",
      "Topic + placement targeting for specific channels.",
      "Exclusions: kids/family channels unless that's your audience.",
    ],
    best_practices: [
      "Hook the skip-decision in seconds 0-5 (visual + question + brand name visible).",
      "View rate ≥ 30% on In-Stream = scale signal.",
      "Companion banner (300×60) is free real estate — use it.",
      "Combine with custom intent for highest ROI.",
    ],
    common_mistakes: [
      "Generic brand-led opener wastes the skip window",
      "No captions (most people watch muted)",
      "Forgetting the companion banner",
      "Running In-Stream without retargeting layer underneath",
    ],
    best_for: "Brand awareness, consideration, retargeting site visitors with video.",
    not_for: "Direct-response on cold audience without retargeting infrastructure.",
    external_links: [
      { label: "Google Ads · Video campaigns", url: "https://ads.google.com" },
      { label: "YouTube Studio (channel)", url: "https://studio.youtube.com" },
    ],
  },
  linkedin: {
    slug: "linkedin",
    name: "LinkedIn Ads",
    tagline: "B2B reach where decision-makers actually scroll.",
    intro: "LinkedIn is the only platform where you can target by job title + company + seniority + skill simultaneously. Expensive CPMs ($30-100+) but the right people. Lead Gen Forms convert 3-5× landing pages.",
    formats: [
      { name: "Sponsored Content (Single Image)", spec: "Intro 150 chars rec · headline 70 rec · desc 100 rec", best_for: "Workhorse. Most B2B campaigns start here.", generator_href: "/generate/linkedin" },
      { name: "Sponsored Content (Video)", spec: "3 sec - 30 min · 9:16 or 1:1 · captions mandatory", best_for: "Higher engagement than image. Thought leadership.", generator_href: "/generate/linkedin" },
      { name: "Sponsored Content (Carousel)", spec: "2-10 cards · intro 255 · card headline 45", best_for: "+30-50% CTR vs single image. Feature breakdowns.", generator_href: "/generate/linkedin" },
      { name: "Lead Gen Form", spec: "≤ 4 questions optimal · pre-filled from LinkedIn profile", best_for: "Native conversion — much higher CVR than sending to LP.", generator_href: "/generate/lead-form" },
      { name: "Message Ads", spec: "InMail-style direct messages to targeted audience", best_for: "Warm audiences only. Cold message ads have low open rates.", generator_href: "/generate/linkedin" },
    ],
    generators: [
      { label: "LinkedIn B2B Generator", href: "/generate/linkedin" },
      { label: "Lead Gen Form Generator", href: "/generate/lead-form" },
    ],
    optimizers: [
      { label: "Audience Targeting Plan", href: "/optimize/audience" },
      { label: "CTR Optimizer", href: "/optimize/ctr" },
      { label: "Bid Strategy", href: "/optimize/bid-strategy" },
    ],
    audience_notes: [
      "Audience size 300k-1M sweet spot — narrower → CPM spikes.",
      "Layer job title + seniority + company size + skill.",
      "Exclude competitor employees.",
      "Lookalikes from your matched audience (customer list upload).",
    ],
    best_practices: [
      "Avoid emoji walls + buzzwords — pros tune them out.",
      "Lead with industry-specific data, not generic 'productivity' framing.",
      "Carousel for feature breakdowns. Video for thought leadership.",
      "Weekday business hours only (B2B engagement plummets weekends).",
    ],
    common_mistakes: [
      "Cold message ads (low open rates)",
      "Over-narrowing audience to <100k",
      "Generic SaaS copy that ignores industry context",
      "No retargeting layer (LinkedIn cold prospects need 5-7 touches)",
    ],
    best_for: "B2B SaaS, enterprise services, recruiting, professional courses, account-based marketing.",
    not_for: "B2C (CPMs too high), consumer products, anything cultural/lifestyle.",
    external_links: [
      { label: "LinkedIn Campaign Manager", url: "https://www.linkedin.com/campaignmanager" },
      { label: "LinkedIn Ad Library", url: "https://www.linkedin.com/ad-library" },
    ],
  },
  twitter: {
    slug: "twitter",
    name: "Twitter / X Ads",
    tagline: "Real-time + cultural. Cheap impressions in the right moments.",
    intro: "X Ads are best for trend-jacking, real-time campaigns, and reaching audiences interested in specific accounts or keywords. Single tweets get 280 chars max — every word matters.",
    formats: [
      { name: "Promoted Tweet", spec: "280 chars · 1-2 hashtags max", best_for: "Default workhorse. 5 variants minimum to test.", generator_href: "/generate/twitter" },
      { name: "Promoted Video", spec: "0:06-2:20 · 1:1 or 16:9 · captions mandatory", best_for: "Higher engagement than static. Cultural moments.", generator_href: "/generate/twitter" },
      { name: "Website Card", spec: "Image/video + headline 70 chars + CTA", best_for: "Drive traffic to a landing page.", generator_href: "/generate/twitter" },
      { name: "Promoted Thread", spec: "6-tweet thread structure with role-tagged beats", best_for: "Story-led B2B / SaaS / personal brand.", generator_href: "/generate/twitter" },
    ],
    generators: [
      { label: "Twitter / X Generator", href: "/generate/twitter" },
      { label: "Hashtags · any language", href: "/generate/hashtags" },
    ],
    optimizers: [
      { label: "CTR Optimizer", href: "/optimize/ctr" },
      { label: "Audience Targeting Plan", href: "/optimize/audience" },
    ],
    audience_notes: [
      "Keyword targeting + follower lookalike + interest categories.",
      "Tailored Audiences (uploaded lists).",
      "Real-time trend conversations — lowest CPM during news moments.",
    ],
    best_practices: [
      "Tweet 1 must work alone (first impression).",
      "Real-time cultural moments → 50-80% cheaper impressions.",
      "Reply-led threads outperform monologue threads.",
      "Avoid hashtag spam — 1-2 max.",
    ],
    common_mistakes: [
      "Repurposing LinkedIn copy verbatim (too long-form)",
      "Emoji + hashtag spam",
      "Static images without video alternatives",
      "Ignoring real-time context",
    ],
    best_for: "Tech, crypto, finance, media, B2B SaaS, anyone with a strong founder voice.",
    not_for: "Local businesses, traditional retail, anyone whose audience isn't on the platform.",
    external_links: [
      { label: "X Ads Manager", url: "https://ads.x.com" },
    ],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORM_HUBS);
