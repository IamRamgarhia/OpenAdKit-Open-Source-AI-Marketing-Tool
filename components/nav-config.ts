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
 * Optimizer, Hashtags, Content Calendar, etc.) intentionally appear in
 * multiple platform groups — the tool itself has a platform select, but
 * discovery happens by platform.
 *
 * Setup / Insights / Routines / Learn / Data stay as universal groups
 * at the top + bottom of the list.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Start here",
    defaultOpen: true,
    items: [
      { href: "/", label: "Dashboard" },
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
    defaultOpen: true,
    items: [
      { href: "/generate/meta", label: "Meta Ads · Feed/Reels" },
      { href: "/generate/reel-ideas", label: "Reel Ideas", query: "platform=instagram_reels" },
      { href: "/generate/lead-form", label: "Lead Form" },
      { href: "/generate/hashtags", label: "Hashtags" },
      { href: "/generate/content-calendar", label: "Content Calendar" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=Meta+Feed" },
      { href: "/optimize/creative-score", label: "Creative Score" },
      { href: "/optimize/audience", label: "Audience Targeting" },
      { href: "/optimize/ad-fatigue", label: "Ad Fatigue" },
      { href: "/optimize/ab-test", label: "A/B Test Planner" },
      { href: "/optimize/landing-page", label: "Landing Page" },
      { href: "/optimize/bid-strategy", label: "Bid Strategy" },
    ],
  },
  {
    title: "Google · Search + PMax + Shopping",
    items: [
      { href: "/generate/google", label: "Google Search · RSA" },
      { href: "/generate/google-pmax", label: "Performance Max" },
      { href: "/generate/google-shopping", label: "Shopping" },
      { href: "/generate/display", label: "Display banners" },
      { href: "/optimize/quality-score", label: "Quality Score Improver" },
      { href: "/optimize/keywords", label: "Keyword Builder" },
      { href: "/optimize/bid-strategy", label: "Bid Strategy", query: "platform=Google" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=Google+Search" },
      { href: "/optimize/audience", label: "Audience Targeting" },
      { href: "/optimize/landing-page", label: "Landing Page" },
      { href: "/optimize/ab-test", label: "A/B Test Planner" },
    ],
  },
  {
    title: "TikTok",
    items: [
      { href: "/generate/tiktok", label: "TikTok In-Feed · Hooks/UGC" },
      { href: "/generate/reel-ideas", label: "Reel Ideas", query: "platform=tiktok" },
      { href: "/generate/spark-ads", label: "Spark Ads" },
      { href: "/generate/branded-hashtag-challenge", label: "Branded Hashtag Challenge" },
      { href: "/generate/hashtags", label: "Hashtags" },
      { href: "/generate/content-calendar", label: "Content Calendar" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=TikTok+In-Feed" },
      { href: "/optimize/creative-score", label: "Creative Score" },
      { href: "/optimize/audience", label: "Audience Targeting" },
      { href: "/optimize/ad-fatigue", label: "Ad Fatigue" },
    ],
  },
  {
    title: "LinkedIn · B2B",
    items: [
      { href: "/generate/linkedin", label: "LinkedIn Sponsored" },
      { href: "/generate/lead-form", label: "Lead Form" },
      { href: "/optimize/ctr", label: "CTR Optimizer", query: "platform=LinkedIn+Sponsored" },
      { href: "/optimize/audience", label: "Audience Targeting" },
      { href: "/optimize/landing-page", label: "Landing Page" },
      { href: "/optimize/ab-test", label: "A/B Test Planner" },
    ],
  },
  {
    title: "YouTube",
    items: [
      { href: "/generate/youtube", label: "YouTube · TrueView Scripts" },
      { href: "/generate/reel-ideas", label: "Shorts Ideas", query: "platform=youtube_shorts" },
      { href: "/generate/hashtags", label: "Hashtags" },
      { href: "/generate/creative-prompts", label: "Image / Video Prompts" },
      { href: "/optimize/creative-score", label: "Creative Score" },
    ],
  },
  {
    title: "X · Twitter",
    items: [
      { href: "/generate/twitter", label: "Twitter / X Ads" },
      { href: "/generate/hashtags", label: "Hashtags" },
      { href: "/generate/content-calendar", label: "Content Calendar" },
    ],
  },
  {
    title: "Email + Display",
    items: [
      { href: "/generate/email-subjects", label: "Email Subjects" },
      { href: "/generate/display", label: "Display Banners" },
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
      { href: "/about", label: "About · Dicecodes" },
    ],
  },
];
