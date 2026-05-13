"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, ScoreBar, Kv } from "@/components/OutputBlocks";
import { CharBadge } from "@/components/CharBadge";
import { CopyButton } from "@/components/CopyButton";
import { buildLandingPrompt, type LandingPageInput } from "@/lib/prompts/landing-page";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<LandingPageInput & Record<string, unknown>> = {
  title: "Landing Page Grader",
  subtitle: "8 levers scored against your actual traffic + conversion data. Specific fixes with exact quote → replacement. Above-the-fold rewrite included.",
  platform: "google",
  campaign_type: "LP Grade",
  maxTokens: 4000,
  fields: [
    { name: "landing_page_url", label: "Landing page URL", kind: "text", section: "Page", placeholder: "https://example.com/lp", span: 2 },
    { name: "ad_promise", label: "Ad promise (exact wording the visitor clicked)", kind: "text", required: true, placeholder: "Get 50% off your first month", span: 2 },
    { name: "landing_copy", label: "Landing page copy", kind: "textarea", required: true, rows: 8, placeholder: "Paste H1 + subhead + above-the-fold + first sections.", span: 2 },
    { name: "audience", label: "Audience", kind: "text", required: true, placeholder: "Solo founders, 25-40, US/CA", span: 2 },

    // ----- Performance data -----
    { name: "visitors", label: "Paid visitors / period", kind: "number", section: "Performance data (last 7-30 days)", placeholder: "e.g. 1850" },
    { name: "conversions", label: "Conversions", kind: "number", placeholder: "e.g. 28" },
    { name: "bounce_rate", label: "Bounce rate %", kind: "text", placeholder: "e.g. 68%", hint: "From GA4 or your analytics platform." },
    { name: "time_on_page", label: "Avg. time on page", kind: "text", placeholder: "e.g. 24s", hint: "Below 30s usually signals weak message match." },
    { name: "lcp", label: "LCP (Largest Contentful Paint)", kind: "text", placeholder: "e.g. 2.4s", hint: "From PageSpeed Insights or Vercel/CrUX. >2.5s hurts Google QS." },
    { name: "mobile_pct", label: "% mobile traffic", kind: "text", placeholder: "e.g. 72%", hint: "Above 60% means mobile-first review." },

    { name: "primary_goal", label: "Primary conversion goal", kind: "select", section: "Goal", options: [
      { value: "lead", label: "Lead capture (form / email)" },
      { value: "trial", label: "Free trial signup" },
      { value: "purchase", label: "Purchase / checkout" },
      { value: "demo", label: "Book a demo" },
      { value: "subscribe", label: "Newsletter / waitlist" },
    ] },
    { name: "lp_screenshot", label: "Screenshot of the landing page (optional)", kind: "image", section: "Optional — drop a screenshot, AI reads it directly", placeholder: "Full-page screenshot. AI judges visual hierarchy, CTA prominence, message match against the ad promise.", span: 2, hint: "Vision-capable providers only (Claude / OpenAI / Gemini)." },
  ],
  initial: {
    landing_page_url: "",
    ad_promise: "",
    landing_copy: "",
    audience: "",
    visitors: "" as any,
    conversions: "" as any,
    bounce_rate: "",
    time_on_page: "",
    lcp: "",
    mobile_pct: "",
    primary_goal: "lead",
    lp_screenshot: null,
  } as any,
  buildPrompt: (input) => buildLandingPrompt(input as unknown as LandingPageInput),
  buildTitle: (i: any) => `LP · ${i.ad_promise?.slice(0, 30)}`,
  expectJson: true,
  renderJson: (json) => <LpOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/landing-page" />;
}

function LpOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.computed_metrics ? (
        <Section title="Computed metrics — from your numbers">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kv k="conversion rate" v={json.computed_metrics.conversion_rate ?? "—"} />
            <Kv k="bounce vs benchmark" v={json.computed_metrics.bounce_vs_benchmark ?? "—"} />
            <Kv k="LCP verdict" v={json.computed_metrics.lcp_verdict ?? "—"} />
            <Kv k="engagement" v={json.computed_metrics.engagement_health ?? "—"} />
          </div>
          {json.computed_metrics.notes ? (
            <p className="text-[11px] text-ink-muted mt-2">{json.computed_metrics.notes}</p>
          ) : null}
        </Section>
      ) : null}

      {json?.overall_grade_pulse ? (
        <Section title="Pulse">
          <div className="grid md:grid-cols-3 gap-2">
            <Stat label="message match" value={`${json.overall_grade_pulse.message_match_score}/10`} />
            <Stat label="est drop-off" value={`${json.overall_grade_pulse.estimated_post_click_drop_off_pct}%`} tone="neg" />
            <Stat label="biggest fix" value={json.overall_grade_pulse.single_biggest_fix} small />
          </div>
        </Section>
      ) : null}

      {json?.scores ? (
        <Section title="Levers">
          <ul className="space-y-2">
            {Object.entries(json.scores).map(([k, v]: any) => (
              <li key={k} className="flex items-start gap-3 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-ink-faint w-32 mt-1">{k.replace(/_/g, " ")}</span>
                <ScoreBar score={v.score} />
                <span className="flex-1 text-xs text-ink-muted">{v.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.fixes?.length ? (
        <Section title="Fixes — ranked by lift">
          <ul className="space-y-2">
            {json.fixes.map((f: any, i: number) => (
              <li key={i} className="border border-base-700 p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Pill text={f.lever?.replace(/_/g, " ")} tone="live" />
                  <Pill text={f.expected_impact} tone={f.expected_impact === "high" ? "pos" : "default"} label="impact" />
                </div>
                <div className="text-xs space-y-1">
                  <div><span className="text-ink-faint">change:</span> <span className="line-through text-ink-subtle">{f.exact_phrase_to_change}</span></div>
                  <div><span className="text-pos">to:</span> <span className="text-ink">{f.replacement}</span></div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.rewrite_above_the_fold ? (
        <Section title="Above-the-fold rewrite" actions={<CopyButton text={`${json.rewrite_above_the_fold.h1}\n${json.rewrite_above_the_fold.subhead}\n${json.rewrite_above_the_fold.bullets?.join("\n")}\n${json.rewrite_above_the_fold.cta_button}`} />}>
          <div className="space-y-2">
            <div>
              <CharBadge count={json.rewrite_above_the_fold.h1?.length || 0} max={60} />
              <p className="font-display italic text-xl text-ink leading-tight mt-1">{json.rewrite_above_the_fold.h1}</p>
            </div>
            <div>
              <CharBadge count={json.rewrite_above_the_fold.subhead?.length || 0} max={140} />
              <p className="text-sm text-ink-muted mt-1">{json.rewrite_above_the_fold.subhead}</p>
            </div>
            <ul className="list-disc list-inside text-sm text-ink space-y-0.5">{json.rewrite_above_the_fold.bullets?.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
            <Pill text={json.rewrite_above_the_fold.cta_button} tone="live" label="cta" />
          </div>
        </Section>
      ) : null}

      {(json?.biggest_opportunity || json?.biggest_problem) ? (
        <Section title="One-line takeaways">
          {json.biggest_problem ? <p className="text-sm text-neg">↓ {json.biggest_problem}</p> : null}
          {json.biggest_opportunity ? <p className="text-sm text-pos mt-1">↑ {json.biggest_opportunity}</p> : null}
        </Section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone = "default", small }: { label: string; value: string; tone?: "pos" | "neg" | "default"; small?: boolean }) {
  const toneMap: Record<string, string> = { pos: "text-pos", neg: "text-neg", default: "text-ink" };
  return (
    <div className="border border-base-600 bg-base-900/30 p-3">
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">{label}</div>
      <div className={`mt-1 ${small ? "text-xs leading-relaxed" : "font-display italic text-2xl tabular"} ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}
