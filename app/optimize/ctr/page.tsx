"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, ScoreBar, Pill, Kv } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildCtrPrompt, type CtrInput } from "@/lib/prompts/ctr-optimizer";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<CtrInput & Record<string, unknown>> = {
  title: "CTR Optimizer",
  subtitle: "Paste your real Google Ads / Meta data — the AI computes CTR, CPA, and conversion rate from the numbers first, then prescribes specific rewrites that target the weakest lever.",
  platform: "google",
  campaign_type: "CTR Optimize",
  maxTokens: 3500,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      section: "Context",
      options: [
        { value: "Google Search", label: "Google Search" },
        { value: "Google Display", label: "Google Display" },
        { value: "Meta Feed", label: "Meta Feed" },
        { value: "Meta Stories", label: "Meta Stories" },
        { value: "Meta Reels", label: "Meta Reels" },
        { value: "TikTok In-Feed", label: "TikTok In-Feed" },
        { value: "LinkedIn Sponsored", label: "LinkedIn Sponsored" },
      ],
    },
    { name: "industry", label: "Industry", kind: "text", required: true, placeholder: "e.g. b2b_saas, ecommerce, finance, healthcare, legal, real_estate" },
    { name: "current_copy", label: "Current ad copy", kind: "textarea", required: true, rows: 6, placeholder: "Headlines + descriptions exactly as they appear in the platform UI.", span: 2 },

    // ----- Performance data block -----
    { name: "impressions", label: "Impressions", kind: "number", section: "Performance data (last 7-30 days)", placeholder: "e.g. 12450", hint: "Total impressions in the reporting window." },
    { name: "clicks", label: "Clicks", kind: "number", placeholder: "e.g. 178", hint: "Total clicks. AI computes CTR = clicks / impressions." },
    { name: "conversions", label: "Conversions", kind: "number", placeholder: "e.g. 14", hint: "Goal completions, leads, or sales attributed to this ad." },
    { name: "spend", label: "Spend (in account currency)", kind: "text", placeholder: "e.g. $812 or ₹65,000", hint: "Total ad spend over the same window." },
    { name: "avg_cpc", label: "Avg. CPC", kind: "text", placeholder: "e.g. $4.56", hint: "Optional — AI can compute spend / clicks if omitted." },
    { name: "search_terms", label: "Top search terms / queries", kind: "textarea", rows: 4, placeholder: "Paste up to 10 actual queries triggering this ad, one per line. From Google Ads → Search Terms report.", span: 2, hint: "Optional but high-leverage: lets the AI tie copy to real user intent." },
    { name: "reporting_window", label: "Reporting window", kind: "text", placeholder: "last 7 days · last 30 days · since launch", hint: "Helps the AI scale lift expectations." },

    // ----- Optional screenshot -----
    { name: "dashboard_screenshot", label: "Screenshot of your Ads dashboard (optional)", kind: "image", section: "Optional — drop a screenshot, AI reads it directly", placeholder: "Drop a Google Ads / Meta Ads Manager screenshot here. Vision-capable providers only (Claude / OpenAI / Gemini).", span: 2, hint: "When provided, the AI reads the metrics straight from the image — you can skip retyping the number fields above." },

    // ----- Goal block -----
    { name: "goal", label: "Primary goal", kind: "select", section: "Goal", options: [
      { value: "increase_ctr", label: "Increase CTR" },
      { value: "lower_cpa", label: "Lower CPA" },
      { value: "increase_conversion_rate", label: "Increase conversion rate" },
      { value: "scale_volume", label: "Scale volume without losing CTR" },
    ] },
    { name: "audience_one_liner", label: "Audience (one line)", kind: "text", placeholder: "e.g. SMB ops managers, 30-50, in companies with 10-200 people", hint: "Skipped if brand brain is active." },
  ],
  initial: {
    platform: "Google Search",
    industry: "",
    current_copy: "",
    impressions: "" as any,
    clicks: "" as any,
    conversions: "" as any,
    spend: "",
    avg_cpc: "",
    search_terms: "",
    reporting_window: "last 30 days",
    dashboard_screenshot: null,
    goal: "increase_ctr",
    audience_one_liner: "",
  } as any,
  buildPrompt: (input) => buildCtrPrompt(input as unknown as CtrInput),
  buildTitle: (i: any) => `CTR · ${i.platform} · ${i.industry || ""}`.trim(),
  expectJson: true,
  renderJson: (json) => <CtrOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/ctr" />;
}

const verdictTone: Record<string, "pos" | "live" | "neg" | "default"> = {
  above_avg: "pos",
  at_avg: "default",
  below_avg: "live",
  severely_below: "neg",
};

function CtrOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.computed_metrics ? (
        <Section title="Computed metrics — from your numbers">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kv k="CTR" v={json.computed_metrics.ctr ?? "—"} />
            <Kv k="conv rate" v={json.computed_metrics.conversion_rate ?? "—"} />
            <Kv k="CPA" v={json.computed_metrics.cpa ?? "—"} />
            <Kv k="CPC" v={json.computed_metrics.cpc ?? "—"} />
          </div>
          {json.computed_metrics.notes ? (
            <p className="text-[11px] text-ink-muted mt-2">{json.computed_metrics.notes}</p>
          ) : null}
        </Section>
      ) : null}

      <Section title="Verdict">
        <div className="flex items-center gap-3 flex-wrap">
          <Pill text={json?.verdict?.replace(/_/g, " ") ?? "—"} tone={verdictTone[json?.verdict] ?? "default"} label="ctr vs benchmark" />
          <span className="text-xs text-ink-muted">{json?.industry_benchmark_cited}</span>
        </div>
        {json?.diagnosis_summary ? (
          <p className="text-sm text-ink mt-2 leading-relaxed">{json.diagnosis_summary}</p>
        ) : null}
      </Section>

      {json?.search_term_signals?.length ? (
        <Section title="Search-term signals">
          <ul className="space-y-1 text-xs">
            {json.search_term_signals.map((s: any, i: number) => (
              <li key={i} className="border border-base-700 px-2 py-1.5 flex items-start gap-2">
                <Pill text={s.intent} tone={s.intent === "low_intent" ? "neg" : s.intent === "buying" ? "pos" : "default"} />
                <span className="text-ink-muted flex-1">{s.observation}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Lever scores">
        <ul className="space-y-2">
          {Object.entries(json?.scores ?? {}).map(([k, v]: any) => (
            <li key={k} className="flex items-start gap-3 border border-base-700 px-2 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-ui-mega text-ink-faint w-32">{k.replace(/_/g, " ")}</span>
              <ScoreBar score={v.score} />
              <span className="flex-1 text-xs text-ink-muted">{v.reason}</span>
            </li>
          ))}
        </ul>
      </Section>

      {json?.rewrites?.length ? (
        <Section title="Rewrites">
          <ul className="space-y-2">
            {json.rewrites.map((r: any, i: number) => (
              <li key={i} className="border border-base-700 p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Pill text={r.lever_targeted?.replace(/_/g, " ")} tone="live" label="lever" />
                  <span className="text-[10px] font-mono uppercase tracking-ui-mega text-pos">{r.expected_lift_directional}</span>
                </div>
                <div className="text-xs space-y-1">
                  <div><span className="text-ink-faint">before:</span> <span className="line-through text-ink-subtle">{r.before}</span></div>
                  <div><span className="text-pos">after:</span> <span className="text-ink">{r.after}</span></div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.full_rewritten_version ? (
        <Section title="Full rewrite" actions={<CopyButton text={json.full_rewritten_version} />}>
          <p className="text-sm text-ink whitespace-pre-line">{json.full_rewritten_version}</p>
        </Section>
      ) : null}

      {json?.kill_or_iterate ? (
        <Section title="Decision">
          <div className="flex items-center gap-2 flex-wrap">
            <Pill text={json.kill_or_iterate} tone={json.kill_or_iterate === "kill" ? "neg" : json.kill_or_iterate === "iterate" ? "pos" : "live"} />
            <span className="text-xs text-ink-muted">{json.kill_or_iterate_reason}</span>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
