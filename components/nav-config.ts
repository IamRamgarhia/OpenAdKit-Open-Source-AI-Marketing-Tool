export interface NavItem {
  href: string;
  label: string;
  /** Optional query string appended on click — used to pre-select the platform on shared tools. */
  query?: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

/**
 * Sidebar is grouped by PLATFORM so users pick "where am I running ads"
 * first, then see every tool that applies. Cross-platform tools (CTR
 * Optimizer, Hashtags, Creative Score, etc.) intentionally appear in
 * multiple platform groups — the tool itself has a platform select, but
 * discovery happens by platform.
 *
 * THAT DUPLICATION HAS TO EARN ITS KEEP. A repeated entry is only justified if
 * it lands the user on the tool with their platform already selected; a link
 * that is byte-identical in four groups is just four ways to reach the same
 * blank form. So every duplicate below carries a `query` when its target has a
 * platform field, and the ones whose targets DON'T (landing-page,
 * content-calendar) are the only identical repeats left.
 *
 * ⚠️ `query` values must be a real `value:` from that page's platform select.
 * A value with no matching <option> renders a blank dropdown — which is what
 * `platform=Google` did on Bid Strategy (its options are "Google Ads" /
 * "Meta Ads" / "TikTok Ads"). Check the page's config before adding one.
 *
 * All groups start COLLAPSED. Twelve groups expanded on load pushed the useful
 * items below the fold and made the sidebar a wall of ~80 links; collapsed, the
 * whole information architecture fits on one screen. Sidebar.tsx still
 * auto-expands whichever group contains the current route, so the active item
 * is never hidden.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Start here",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/how-to-use", label: "How to use OpenAdKit" },
      { href: "/providers", label: "Which AI should I use?" },
      { href: "/brand", label: "Clients · Brand Brain" },
      { href: "/brand/new", label: "+ Add new client" },
      { href: "/suggestions", label: "✨ AI Suggestions" },
      { href: "/platforms", label: "Pick a platform" },
      { href: "/launch/wizard", label: "⚡ 10-Minute Launch Wizard" },
      { href: "/batch", label: "Multi-client Batch Mode" },
      { href: "/launch-guide", label: "Step-by-step launch" },
      { href: "/generate/campaign-kit", label: "Full Campaign Kit" },
    ],
  },
  {
    title: "Meta · Facebook + Instagram",
    items: [
      { href: "/generate/meta", label: "Meta Ads · Feed/Reels" },
      { href: "/generate/reel-ideas", label: "Reel Ideas", query: "platform=instagram_reels" },
      { href: "/generate/lead-form", label: "Lead Form", query: "platform=meta" },
      { href: "/generate/hashtags", label: "Hashtags", query: "platform=instagram" },
      { href: "/generate/content-calendar", label: "Content Calendar" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts", query: "platform=Meta+Feed" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=Meta+Feed" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=Meta+Feed" },
      { href: "/optimize/audience", label: "Audience Targeting", query: "platform=meta" },
      { href: "/optimize/ad-fatigue", label: "Ad Fatigue", query: "platform=Meta+Feed" },
      { href: "/optimize/ab-test", label: "A/B Test Planner", query: "platform=Meta+Feed" },
      { href: "/optimize/landing-page", label: "Landing Page" },
      { href: "/optimize/bid-strategy", label: "Bid Strategy", query: "platform=Meta+Ads" },
    ],
  },
  {
    title: "Google · Search + PMax + Shopping",
    items: [
      { href: "/generate/google", label: "Google Search · RSA" },
      { href: "/generate/google-pmax", label: "Performance Max" },
      { href: "/generate/google-shopping", label: "Shopping" },
      { href: "/generate/display", label: "Display Banners" },
      { href: "/optimize/quality-score", label: "Quality Score Improver" },
      { href: "/optimize/keywords", label: "Keyword Builder" },
      // Was `platform=Google` — not one of this tool's options, so the select
      // rendered blank. The valid value is "Google Ads".
      { href: "/optimize/bid-strategy", label: "Bid Strategy", query: "platform=Google+Ads" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=Google+Search" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=Google+Search" },
      { href: "/optimize/audience", label: "Audience Targeting", query: "platform=google" },
      { href: "/optimize/landing-page", label: "Landing Page" },
      { href: "/optimize/ab-test", label: "A/B Test Planner", query: "platform=Google+Search" },
    ],
  },
  {
    title: "TikTok",
    items: [
      { href: "/generate/tiktok", label: "TikTok In-Feed · Hooks/UGC" },
      { href: "/generate/reel-ideas", label: "Reel Ideas", query: "platform=tiktok" },
      { href: "/generate/spark-ads", label: "Spark Ads" },
      { href: "/generate/branded-hashtag-challenge", label: "Branded Hashtag Challenge" },
      { href: "/generate/hashtags", label: "Hashtags", query: "platform=tiktok" },
      { href: "/generate/content-calendar", label: "Content Calendar" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts", query: "platform=TikTok+In-Feed" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=TikTok+In-Feed" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=TikTok+In-Feed" },
      { href: "/optimize/audience", label: "Audience Targeting", query: "platform=tiktok" },
      { href: "/optimize/ad-fatigue", label: "Ad Fatigue", query: "platform=TikTok+In-Feed" },
      { href: "/optimize/bid-strategy", label: "Bid Strategy", query: "platform=TikTok+Ads" },
    ],
  },
  {
    title: "LinkedIn · B2B",
    items: [
      { href: "/generate/linkedin", label: "LinkedIn Sponsored" },
      { href: "/generate/lead-form", label: "Lead Form", query: "platform=linkedin" },
      { href: "/generate/hashtags", label: "Hashtags", query: "platform=linkedin" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=LinkedIn+Sponsored" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=LinkedIn+Sponsored" },
      { href: "/optimize/audience", label: "Audience Targeting", query: "platform=linkedin" },
      { href: "/optimize/landing-page", label: "Landing Page" },
      { href: "/optimize/ab-test", label: "A/B Test Planner", query: "platform=LinkedIn" },
    ],
  },
  {
    title: "YouTube",
    items: [
      { href: "/generate/youtube", label: "YouTube · TrueView Scripts" },
      { href: "/generate/reel-ideas", label: "Shorts Ideas", query: "platform=youtube_shorts" },
      { href: "/generate/hashtags", label: "Hashtags", query: "platform=youtube" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts", query: "platform=YouTube+Shorts" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=YouTube+In-Stream" },
      { href: "/optimize/ad-fatigue", label: "Ad Fatigue", query: "platform=YouTube+In-Stream" },
    ],
  },
  {
    title: "X · Twitter",
    items: [
      { href: "/generate/twitter", label: "Twitter / X Ads" },
      { href: "/generate/hashtags", label: "Hashtags", query: "platform=twitter" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts", query: "platform=Twitter+/+X" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=Twitter/X" },
      { href: "/generate/content-calendar", label: "Content Calendar" },
    ],
  },
  {
    title: "Email + Display",
    items: [
      { href: "/generate/email-subjects", label: "Email Subjects" },
      { href: "/generate/display", label: "Display Banners" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts", query: "platform=Google+Display" },
      { href: "/optimize/creative-score", label: "Creative Score", query: "platform=Google+Display" },
    ],
  },
  {
    title: "Research & Insights",
    items: [
      { href: "/research/competitors", label: "Steal & Beat" },
      { href: "/research/reel-teardown", label: "Competitor Reel Teardown" },
      { href: "/research/compare", label: "Compare 2 Ads" },
      { href: "/benchmarks", label: "Benchmarks" },
      { href: "/strategy", label: "What Ad Should I Run" },
      { href: "/strategy/decision-tree", label: "Decision Tree" },
      { href: "/report", label: "Report Generator" },
      { href: "/optimize/budget", label: "Budget Waste" },
      { href: "/optimize/budget-planner", label: "Budget Planner" },
    ],
  },
  {
    title: "Routines",
    items: [
      { href: "/checklist/daily", label: "Daily" },
      { href: "/checklist/weekly", label: "Weekly" },
      { href: "/checklist/monthly", label: "Monthly" },
    ],
  },
  {
    title: "Learn",
    items: [
      { href: "/learn", label: "Concept Library" },
      { href: "/learn/courses", label: "Mini-courses" },
      { href: "/learn/frameworks", label: "Ad Copy School" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/history", label: "History" },
      { href: "/campaigns", label: "Campaigns" },
      { href: "/settings", label: "Settings" },
      { href: "/about", label: "About · DiceCodes" },
      { href: "/support", label: "♥ Support OpenAdKit" },
    ],
  },
];
