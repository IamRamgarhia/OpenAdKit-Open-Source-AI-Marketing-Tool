"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Brain, History, Settings, Rocket, Target, FileBarChart, Activity, ClipboardList, BookOpen, Hash, ImageIcon, Search, GitBranch, Calendar, Lock, KeyRound, Cpu, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FeatureTour } from "@/components/FeatureTour";
import { getActiveBrainId } from "@/lib/settings";
import { useHasAnyKeyStatus } from "@/lib/hooks/use-has-key";
import { listBrains, listAds, type GeneratedAd } from "@/lib/storage";
import type { BrandBrain } from "@/lib/brand-brain";

const tiles: { href: string; label: string; sub: string; icon: any; accent?: boolean }[] = [
  { href: "/suggestions", label: "✨ AI Suggestions for active brand", sub: "What this brand should run — 3 campaigns + 30-day plan + quick wins", icon: Sparkles, accent: true },
  { href: "/platforms", label: "Pick a platform", sub: "YouTube · Meta · TikTok · Google · LinkedIn · X — formats, generators, launch guide", icon: Target, accent: true },
  { href: "/launch-guide", label: "Step-by-step launch guide", sub: "Walk through Facebook/Google UI from start to publish — for any skill level", icon: Rocket, accent: true },
  { href: "/optimize/creative-score", label: "Creative Score", sub: "5-lever brutal score on any ad copy + 3 named fixes + AI estimate (directional) of CTR band", icon: Activity, accent: true },
  { href: "/research/compare", label: "Compare 2 ads", sub: "Head-to-head AI teardown · pick winner · hybrid proposal", icon: Search },
  { href: "/research/competitors", label: "Steal & Beat competitors", sub: "Teardown of Meta Ads Library + Google Transparency ads", icon: Search },
  { href: "/generate/campaign-kit", label: "Full Campaign Kit", sub: "One brief → every platform", icon: Sparkles },
  { href: "/generate/content-calendar", label: "Social content calendar", sub: "Per-day posts · captions · hashtags · image+video prompts with tool links", icon: Calendar },
  { href: "/generate/creative-prompts", label: "AI image/video prompts", sub: "Midjourney · Runway · DALL-E · Pika prompts", icon: ImageIcon },
  { href: "/generate/google", label: "Google · RSA", sub: "Search Responsive Search Ad", icon: Sparkles },
  { href: "/generate/meta", label: "Meta · Feed/Reels", sub: "Facebook + Instagram, 3 angles", icon: Sparkles },
  { href: "/generate/tiktok", label: "TikTok · Hooks/UGC", sub: "50 hooks per click + UGC scripts", icon: Sparkles },
  { href: "/generate/hashtags", label: "Hashtags · any language", sub: "Tiered broad / niche / branded", icon: Hash },
  { href: "/optimize/ctr", label: "CTR Optimizer", sub: "Lever-by-lever rewrites", icon: Activity },
  { href: "/optimize/budget", label: "Budget Waste", sub: "Pulse audit, named contributors", icon: Activity },
  { href: "/strategy/decision-tree", label: "Decision tree", sub: "Click through to a platform recommendation", icon: GitBranch },
  { href: "/benchmarks", label: "Benchmarks", sub: "Industry CTR / CPC / CVR / ROAS ranges", icon: Target },
  { href: "/report", label: "Report generator", sub: "Markdown, client-ready", icon: FileBarChart },
  { href: "/checklist/daily", label: "Daily routine", sub: "15-20 min ops checklist", icon: ClipboardList },
  { href: "/learn/frameworks", label: "Ad Copy School", sub: "Interactive framework trainer", icon: BookOpen },
  { href: "/brand", label: "Brand Brain", sub: "Persistent brand intelligence", icon: Brain },
  { href: "/history", label: "History", sub: "Every generation, locally stored", icon: History },
];

/**
 * `/` is both the public landing page and the dashboard.
 *
 * It used to redirect to /setup whenever no key was stored, so crawlers and
 * first-time visitors never saw what OpenAdKit is — and users who imported a
 * backup or added a key in Settings (without clicking through /setup's
 * "onboarded" flag) got bounced back to onboarding. Now: any stored provider
 * key = dashboard; otherwise (and during SSR, so the HTML is indexable) the
 * landing page.
 */
export default function Home() {
  const status = useHasAnyKeyStatus();
  if (status === "yes") return <Dashboard />;
  return <Landing />;
}

const LANDING_POINTS: { icon: any; title: string; body: string }[] = [
  { icon: Sparkles, title: "18 ad generators · 11 optimizers", body: "Google RSA, PMax, Shopping, Meta, TikTok, LinkedIn, YouTube, X, email subjects, hashtags, reel ideas — plus CTR, Quality Score, budget and creative-score optimizers." },
  { icon: KeyRound, title: "Bring your own AI key", body: "Claude, GPT, Gemini, Groq, Cerebras, OpenRouter, Together, DeepSeek or Mistral. Free tiers work. Calls go straight from your browser to the provider." },
  { icon: Lock, title: "Runs in your browser", body: "No accounts, no backend, no telemetry. Brand brains, history and keys stay on this device." },
  { icon: Brain, title: "Brand brain per client", body: "Paste a website URL and every tool writes in that client's voice, for that audience, with its real offers." },
];

const LANDING_LINKS: { href: string; label: string; sub: string; icon: any }[] = [
  { href: "/learn", label: "Learn paid ads", sub: "Plain-English concept library + free courses", icon: GraduationCap },
  { href: "/benchmarks", label: "Benchmarks", sub: "Directional CTR / CPC / CVR / ROAS ranges", icon: Target },
  { href: "/platforms", label: "Platform guides", sub: "Formats, specs and best practices per network", icon: Rocket },
  { href: "/providers", label: "Which AI should I use?", sub: "Prices, free tiers and limits per provider", icon: Cpu },
];

function Landing() {
  return (
    <div className="max-w-5xl">
      <section className="py-6 md:py-10 animate-fade-up">
        <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-3">free · open source · MIT</div>
        <h1 className="font-display italic text-4xl md:text-5xl text-ink leading-tight">
          OpenAdKit — the open-source AI marketing tool
        </h1>
        <p className="text-base text-ink-muted mt-4 max-w-2xl leading-relaxed">
          Write, score and plan ads for every major platform with the AI provider you already use. Bring your own key, keep
          your data in your browser, pay $0 to us — forever.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-6">
          <Link href="/setup" className="btn-primary text-base">
            <Sparkles size={14} /> Get started
          </Link>
          <Link href="/how-to-use" className="btn-ghost">How it works</Link>
          <Link href="/alternatives" className="btn-ghost">vs Jasper / AdCreative / Anyword</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-3 mb-10" aria-label="What OpenAdKit does">
        {LANDING_POINTS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="border border-base-600 bg-base-900/40 p-4">
              <Icon size={16} className="text-live mb-2" />
              <h2 className="text-[15px] font-semibold text-ink">{p.title}</h2>
              <p className="text-[13px] text-ink-muted mt-1 leading-relaxed">{p.body}</p>
            </div>
          );
        })}
      </section>

      <section aria-label="Free resources, no key needed">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink mb-3">Free to read — no key needed</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {LANDING_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group border border-base-600 bg-base-900/40 p-4 hover:bg-base-800/60 hover:border-base-500 transition">
                <Icon size={15} className="text-ink-muted group-hover:text-live" />
                <div className="font-display italic text-lg text-ink mt-2 leading-tight">{l.label}</div>
                <p className="text-[12px] text-ink-muted mt-1">{l.sub}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Dashboard() {
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [recent, setRecent] = useState<GeneratedAd[]>([]);
  const [activeBrainId, setActiveBrainIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      const active = getActiveBrainId();
      setActiveBrainIdState(active);
      // Scope recent generations to the active client when one is selected —
      // every other "active client" surface in the app does the same, so the
      // dashboard's recent list shouldn't be the one place showing other
      // clients' work.
      Promise.all([listBrains(), listAds(active ? { brand_id: active } : undefined)]).then(([b, a]) => {
        setBrains(b);
        setRecent(a.slice(0, 6));
        setLoading(false);
      });
    };
    load();
    const onChange = () => load();
    window.addEventListener("ados:brains-changed", onChange);
    window.addEventListener("ados:active-brain-changed", onChange);
    return () => {
      window.removeEventListener("ados:brains-changed", onChange);
      window.removeEventListener("ados:active-brain-changed", onChange);
    };
  }, []);

  // Skeleton instead of `return null` to avoid the blank-flash + layout shift
  // when the user returns to the dashboard. (Audit finding #54.)
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-16 mb-6 border-b border-base-700/40" />
        <div className="grid md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 border border-base-700 bg-base-900/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <FeatureTour />
      <PageHeader
        scope="dashboard"
        title="OpenAdKit — open source AI marketing tool"
        subtitle="Every ad platform, every AI provider (BYOK), runs in your browser. Everything you generate stays on this device."
      />

      {/* First-touch CTA: a fresh install has no brand brain yet. Without it,
          every generator below produces generic copy. Surface this clearly
          before the user starts clicking tools and wonders why the output
          sounds nothing like their brand. */}
      {brains.length === 0 ? (
        <div className="mb-6 border border-live/40 bg-live/4 p-6 grid md:grid-cols-[1fr_auto] items-center gap-4 animate-fade-up">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-1">step 1 of 1</div>
            <h2 className="font-display italic text-2xl text-ink leading-tight">Add your first client to unlock everything.</h2>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed max-w-xl">
              OpenAdKit's brand brain is what makes every output sound like <em>this</em> client — not generic AI copy. Paste a website URL and the AI auto-extracts the niche, products, platforms, content pillars, and tone in ~10 seconds.
            </p>
          </div>
          <Link
            href="/brand/new"
            className="btn-primary whitespace-nowrap text-base"
          >
            <Brain size={14} />
            Create first client
          </Link>
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`group border bg-base-900/40 p-4 transition flex flex-col gap-2 ${
                t.accent
                  ? "border-live/60 hover:bg-live/5"
                  : "border-base-600 hover:bg-base-800/60 hover:border-base-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon size={16} className={t.accent ? "text-live" : "text-ink-muted group-hover:text-ink"} />
                <span className="text-[12px] text-ink-faint group-hover:text-live transition">↗</span>
              </div>
              <div>
                <div className={`font-display italic text-xl leading-tight ${t.accent ? "text-live" : "text-ink"}`}>
                  {t.label}
                </div>
                <p className="text-[13px] text-ink-muted mt-2 leading-relaxed">{t.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="mt-10 stagger">
        <div className="flex items-center justify-between mb-3 hairline pb-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink">
            Recent generations
            {activeBrainId ? (
              <span className="ml-2 text-[10px] font-mono uppercase tracking-ui-wide text-live normal-case">
                · scoped to active client
              </span>
            ) : null}
          </h2>
          <Link href="/history" className="text-[12px] font-medium uppercase tracking-wide text-live hover:underline">
            view all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="border border-base-600 bg-base-900/40 px-4 py-3 text-sm text-ink-muted flex items-center gap-3">
            <Rocket size={14} className="text-live" />
            Nothing here yet.{" "}
            <Link href="/generate/google" className="text-live hover:underline">
              Hit Generate · Google
            </Link>{" "}
            to make your first ad.
          </div>
        ) : (
          <div>
            {recent.map((a) => (
              <Link
                key={a.id}
                href={`/history?focus=${encodeURIComponent(a.id)}`}
                className="flex items-center justify-between border-b border-base-700 last:border-b-0 px-3 py-2 hover:bg-base-800/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live w-16">{a.platform}</span>
                  <span className="text-sm text-ink truncate flex-1">{a.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
                    {a.campaign_type}
                  </span>
                  <span className="text-[10px] font-mono text-ink-subtle tabular">
                    ${(Number.isFinite(Number(a.cost_usd)) ? Number(a.cost_usd) : 0).toFixed(4)}
                  </span>
                  <span className="text-[10px] font-mono text-ink-subtle">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint flex items-center gap-3">
        <Link href="/settings" className="inline-flex items-center gap-1.5 hover:text-ink-muted">
          <Settings size={11} /> settings
        </Link>
        <span>·</span>
        <span>{brains.length} brand brain{brains.length === 1 ? "" : "s"} loaded</span>
      </div>
    </div>
  );
}
