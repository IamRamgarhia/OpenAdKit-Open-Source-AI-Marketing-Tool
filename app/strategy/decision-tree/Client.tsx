"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/OutputBlocks";

type Goal = "sales" | "leads" | "awareness" | "traffic" | "app_installs";
type BudgetTier = "lt500" | "500_2k" | "2k_10k" | "gt10k";
type ProductType = "ecom_visual" | "saas_b2c" | "saas_b2b" | "local_service" | "service_b2b" | "info_product";
type Timeline = "fast" | "patient";

interface Path {
  goal?: Goal;
  budget?: BudgetTier;
  product?: ProductType;
  timeline?: Timeline;
}

const GOALS: { v: Goal; t: string; d: string }[] = [
  { v: "sales", t: "Sales", d: "Drive purchases / transactions" },
  { v: "leads", t: "Leads", d: "Capture contact info for sales follow-up" },
  { v: "awareness", t: "Awareness", d: "Reach new audiences, build brand recall" },
  { v: "traffic", t: "Traffic", d: "Get qualified visitors to a page" },
  { v: "app_installs", t: "App installs", d: "Drive mobile app downloads" },
];
const BUDGETS: { v: BudgetTier; t: string }[] = [
  { v: "lt500", t: "< $500 / month" },
  { v: "500_2k", t: "$500 – $2,000 / month" },
  { v: "2k_10k", t: "$2,000 – $10,000 / month" },
  { v: "gt10k", t: "> $10,000 / month" },
];
const PRODUCTS: { v: ProductType; t: string }[] = [
  { v: "ecom_visual", t: "E-commerce (visual product)" },
  { v: "saas_b2c", t: "B2C app / SaaS" },
  { v: "saas_b2b", t: "B2B SaaS" },
  { v: "local_service", t: "Local service / brick-and-mortar" },
  { v: "service_b2b", t: "B2B service / agency" },
  { v: "info_product", t: "Info product / course" },
];

function recommend(p: Path) {
  const { goal, budget, product, timeline } = p;
  if (!goal || !budget || !product || !timeline) return null;

  // Decision rules (mirror the strategy prompt rules)
  let primary = "Google Search";
  let secondary: string | null = null;
  let format: string[] = [];
  let kit: string[] = [];
  let avoid: string[] = [];
  let why = "";

  if (budget === "lt500") {
    primary = "Google Search";
    why = "At < $500/mo, only intent-based search captures meaningful results. Awareness-driven platforms need volume.";
    avoid = ["Awareness campaigns", "Broad-prospecting Meta", "TikTok ACO without creative pipeline"];
    format = ["RSA"];
    kit = ["/generate/google", "/optimize/keywords", "/optimize/quality-score"];
  } else if (product === "saas_b2b" && (budget === "2k_10k" || budget === "gt10k")) {
    primary = "LinkedIn Sponsored Content";
    secondary = "Google Search (branded + intent)";
    why = "B2B at > $2k/mo: LinkedIn for decision-maker reach, Google Search to capture in-market intent.";
    avoid = ["TikTok (audience mismatch unless youth-leaning ICP)", "Meta cold prospecting (B2B intent thin)"];
    format = ["LinkedIn Lead Gen Form", "Sponsored thought leadership"];
    kit = ["/generate/linkedin", "/generate/google", "/generate/lead-form"];
  } else if (product === "ecom_visual") {
    primary = "Meta Carousel + Reels";
    secondary = (budget as string) === "lt500" ? null : "Google Shopping + TikTok UGC";
    why = "Visual ecom: Meta dominates for catalog visualization; Google Shopping captures bottom-funnel.";
    avoid = ["LinkedIn (wrong context)", "Display before retargeting infrastructure"];
    format = ["Carousel", "Reels", "Shopping feed"];
    kit = ["/generate/meta", "/generate/google-shopping", "/generate/tiktok"];
  } else if (product === "local_service") {
    primary = "Google Local Search";
    secondary = "Meta retargeting site visitors";
    why = "Local service: people search when they need it. Capture intent first, retarget for consideration.";
    avoid = ["TikTok (wrong moment of need)", "Broad-geo prospecting"];
    format = ["RSA", "Local Service Ads (LSA)"];
    kit = ["/generate/google", "/optimize/keywords", "/optimize/audience"];
  } else if (product === "saas_b2c" || product === "info_product") {
    primary = "Meta + TikTok";
    secondary = (budget as string) === "lt500" ? null : "Google UAC (for app)";
    why = "Consumer SaaS / info products: scroll-stopping creative + UGC; awareness compounds.";
    avoid = ["LinkedIn", "Display before retargeting"];
    format = ["Reels", "UGC scripts", "Hooks-led In-Feed"];
    kit = ["/generate/meta", "/generate/tiktok", "/generate/spark-ads"];
  } else if (product === "service_b2b") {
    primary = "LinkedIn + Google Search";
    why = "B2B services: paid social for awareness + intent capture for warmer leads.";
    format = ["LinkedIn Sponsored", "Search RSA"];
    kit = ["/generate/linkedin", "/generate/google", "/generate/lead-form"];
  } else {
    primary = "Google Search";
    why = "Default — start where intent is highest.";
    format = ["RSA"];
    kit = ["/generate/google"];
  }

  if (goal === "awareness") {
    primary = "Meta + YouTube";
    why = "Awareness needs volume — Meta Reels and YouTube in-stream are the cheapest impression engines.";
    format = ["Reels", "YouTube In-Stream", "YouTube Bumpers"];
    kit = ["/generate/meta", "/generate/youtube"];
  }
  if (goal === "app_installs") {
    primary = "Google UAC + Meta App";
    why = "Apps: UAC + Meta App ads are the only campaigns optimized for install attribution.";
    format = ["App promotion creative", "Reels"];
    kit = ["/generate/meta", "/generate/google"];
  }

  if (timeline === "fast" && budget !== "lt500") {
    avoid = [...avoid, "tROAS / tCPA Smart Bidding (needs 30+ conv/mo to leave learning fast)"];
  }

  return { primary, secondary, why, avoid, format, kit, goal, budget, product, timeline };
}

export default function Client() {
  return <Inner />;
}

function Inner() {
  const [p, setP] = useState<Path>({});
  const result = recommend(p);

  return (
    <div>
      <PageHeader
        scope="strategy/decision-tree"
        title="Campaign Type Selector"
        subtitle="Click through five questions. Get a specific platform + format + workflow recommendation."
      />

      <div className="space-y-4 stagger">
        <Step done={!!p.goal} n={1} title="Goal" desc="What is this campaign actually for?">
          <Grid>
            {GOALS.map((g) => (
              <Choice key={g.v} active={p.goal === g.v} onClick={() => setP({ ...p, goal: g.v })}>
                <div className="text-ink font-medium">{g.t}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{g.d}</div>
              </Choice>
            ))}
          </Grid>
        </Step>
        {p.goal ? (
          <Step
            done={!!p.budget}
            n={2}
            title="Monthly budget"
            desc="Be honest. Mismatched budget is the #1 cause of bad results."
          >
            <Grid cols={4}>
              {BUDGETS.map((b) => (
                <Choice key={b.v} active={p.budget === b.v} onClick={() => setP({ ...p, budget: b.v })}>
                  <div className="text-ink font-medium text-sm">{b.t}</div>
                </Choice>
              ))}
            </Grid>
          </Step>
        ) : null}
        {p.budget ? (
          <Step done={!!p.product} n={3} title="What are you selling?">
            <Grid>
              {PRODUCTS.map((pp) => (
                <Choice key={pp.v} active={p.product === pp.v} onClick={() => setP({ ...p, product: pp.v })}>
                  <div className="text-ink font-medium">{pp.t}</div>
                </Choice>
              ))}
            </Grid>
          </Step>
        ) : null}
        {p.product ? (
          <Step done={!!p.timeline} n={4} title="Timeline pressure">
            <Grid cols={2}>
              <Choice active={p.timeline === "fast"} onClick={() => setP({ ...p, timeline: "fast" })}>
                <div className="text-ink font-medium">Need results in 30 days</div>
                <div className="text-[11px] text-ink-muted">Skew toward intent-based + manual control</div>
              </Choice>
              <Choice active={p.timeline === "patient"} onClick={() => setP({ ...p, timeline: "patient" })}>
                <div className="text-ink font-medium">Building for 6+ months</div>
                <div className="text-[11px] text-ink-muted">Smart bidding + creative pipeline + retargeting infra</div>
              </Choice>
            </Grid>
          </Step>
        ) : null}
        {result ? <Result result={result} reset={() => setP({})} /> : null}
      </div>
    </div>
  );
}

function Step({ n, title, desc, done, children }: { n: number; title: string; desc?: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className={`border ${done ? "border-base-700 bg-base-900/20" : "border-live/40 bg-live/5"} p-5`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={`font-mono tabular text-[10px] uppercase tracking-ui-mega ${done ? "text-ink-faint" : "text-live"}`}>step {n}</span>
        <h3 className="font-display italic text-xl text-ink">{title}</h3>
        {done ? <span className="text-[10px] font-mono uppercase tracking-ui-mega text-pos ml-auto">✓</span> : null}
      </div>
      {desc ? <p className="text-xs text-ink-muted mb-3">{desc}</p> : null}
      {children}
    </div>
  );
}

function Grid({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid gap-2 ${cols === 4 ? "md:grid-cols-4" : cols === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>{children}</div>;
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-left border p-3 transition ${active ? "border-live bg-live/5" : "border-base-600 hover:bg-base-800/40"}`}>
      {children}
    </button>
  );
}

function Result({ result, reset }: { result: any; reset: () => void }) {
  return (
    <div className="border border-live/60 bg-live/5 p-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-2">
        <Pill text="recommendation" tone="live" />
        <button onClick={reset} className="ml-auto btn-ghost text-[10px]">start over</button>
      </div>
      <div className="font-display italic text-3xl text-live leading-tight">{result.primary}</div>
      {result.secondary ? (
        <div className="font-display italic text-lg text-ink leading-tight mt-1">+ {result.secondary}</div>
      ) : null}
      <p className="text-sm text-ink-muted mt-3 leading-relaxed">{result.why}</p>

      <div className="mt-4 grid md:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1.5">recommended formats</div>
          <div className="flex flex-wrap gap-1">{result.format.map((f: string, i: number) => <Pill key={i} text={f} tone="info" />)}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg mb-1.5">avoid</div>
          <ul className="space-y-0.5 text-ink-muted">{result.avoid.map((a: string, i: number) => <li key={i}>✕ {a}</li>)}</ul>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-base-700">
        <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-2">your workflow in OpenAdKit</div>
        <div className="flex flex-wrap gap-2">
          {result.kit.map((href: string, i: number) => (
            <Link key={i} href={href} className="btn-primary">
              {href.replace("/", " ").trim()} →
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle">
        want a written plan with budget split + KPIs? → <Link href="/strategy" className="text-live hover:underline">use /strategy with Claude</Link>
      </div>
    </div>
  );
}
