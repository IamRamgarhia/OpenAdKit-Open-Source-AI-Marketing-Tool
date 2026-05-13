"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { CharBadge } from "@/components/CharBadge";
import { buildQualityScorePrompt, type QualityScoreInput } from "@/lib/prompts/quality-score";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<QualityScoreInput & Record<string, unknown>> = {
  title: "Quality Score Improver",
  subtitle: "Paste the three Quality Score factor ratings exactly as Google shows them, plus real performance numbers. The AI scores each factor and names the exact change to lift it.",
  platform: "google",
  campaign_type: "QS Improve",
  maxTokens: 3500,
  fields: [
    // ----- The keyword + status block -----
    { name: "keyword", label: "Target keyword", kind: "text", required: true, section: "Keyword", placeholder: "e.g. project management software", span: 2 },
    { name: "match_type", label: "Match type", kind: "select", options: [
      { value: "exact", label: "Exact" },
      { value: "phrase", label: "Phrase" },
      { value: "broad", label: "Broad" },
    ] },
    { name: "current_qs", label: "Current QS (1-10)", kind: "text", placeholder: "e.g. 5", hint: "From Keywords table → status column → tooltip." },

    // ----- The three Google QS factors -----
    {
      name: "expected_ctr_rating",
      label: "Expected CTR rating",
      kind: "select",
      section: "Google's three QS factors (copy from the QS tooltip)",
      options: [
        { value: "below_average", label: "Below average" },
        { value: "average", label: "Average" },
        { value: "above_average", label: "Above average" },
        { value: "unknown", label: "Not sure / no data yet" },
      ],
    },
    {
      name: "ad_relevance_rating",
      label: "Ad relevance rating",
      kind: "select",
      options: [
        { value: "below_average", label: "Below average" },
        { value: "average", label: "Average" },
        { value: "above_average", label: "Above average" },
        { value: "unknown", label: "Not sure / no data yet" },
      ],
    },
    {
      name: "landing_page_rating",
      label: "Landing page experience rating",
      kind: "select",
      options: [
        { value: "below_average", label: "Below average" },
        { value: "average", label: "Average" },
        { value: "above_average", label: "Above average" },
        { value: "unknown", label: "Not sure / no data yet" },
      ],
    },

    // ----- Ad copy + LP context -----
    { name: "current_ad_copy", label: "Current ad copy", kind: "textarea", required: true, section: "Ad + landing page", rows: 5, placeholder: "Paste all 15 headlines + all 4 descriptions for this RSA, one per line.", span: 2 },
    { name: "landing_page_url", label: "Landing page URL", kind: "text", placeholder: "https://example.com/lp" },
    { name: "landing_page_summary", label: "Landing page summary", kind: "textarea", required: true, rows: 4, placeholder: "H1 + hero copy + primary CTA + social proof + page load (LCP) if known.", span: 2 },

    // ----- Performance data -----
    { name: "impressions", label: "Impressions", kind: "number", section: "Performance data (last 7-30 days)", placeholder: "e.g. 8200" },
    { name: "clicks", label: "Clicks", kind: "number", placeholder: "e.g. 124" },
    { name: "conversions", label: "Conversions", kind: "number", placeholder: "e.g. 7" },
    { name: "avg_cpc", label: "Avg. CPC", kind: "text", placeholder: "e.g. $4.20" },
    { name: "top_search_terms", label: "Top search terms triggering this keyword", kind: "textarea", rows: 4, placeholder: "Paste 5-10 actual queries from Search Terms report — one per line.", span: 2 },
  ],
  initial: {
    keyword: "",
    match_type: "phrase",
    current_qs: "",
    expected_ctr_rating: "unknown",
    ad_relevance_rating: "unknown",
    landing_page_rating: "unknown",
    current_ad_copy: "",
    landing_page_url: "",
    landing_page_summary: "",
    impressions: "" as any,
    clicks: "" as any,
    conversions: "" as any,
    avg_cpc: "",
    top_search_terms: "",
  } as any,
  buildPrompt: (input) => buildQualityScorePrompt(input as unknown as QualityScoreInput),
  buildTitle: (i: any) => `QS · ${i.keyword}`,
  expectJson: true,
  renderJson: (json) => <QsOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/quality-score" />;
}

const ratingTone: Record<string, "neg" | "live" | "pos" | "default"> = {
  low: "neg",
  below_average: "neg",
  average: "live",
  above_average: "pos",
};

function QsOutput({ json }: { json: any }) {
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
        </Section>
      ) : null}

      {json?.projected_qs ? (
        <Section title="Projection">
          <div className="grid grid-cols-3 gap-2">
            <Kv k="current qs" v={json.projected_qs.current ?? "—"} />
            <Kv k="after fixes" v={json.projected_qs.after_fixes ?? "—"} pos />
            <Kv k="cpc savings" v={json.projected_qs.cpc_savings_estimate ?? "—"} pos />
          </div>
          {json.projected_qs.reasoning ? (
            <p className="text-[11px] text-ink-muted mt-2">{json.projected_qs.reasoning}</p>
          ) : null}
        </Section>
      ) : null}

      {json?.current_factors ? (
        <Section title="Three factors · diagnosis">
          <ul className="space-y-2">
            {Object.entries(json.current_factors).map(([k, v]: any) => (
              <li key={k} className="flex items-start gap-3 border border-base-700 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-ink-faint w-36 mt-0.5">{k.replace(/_/g, " ")}</span>
                <Pill text={v.rating?.replace(/_/g, " ")} tone={ratingTone[v.rating] ?? "default"} />
                <span className="flex-1 text-xs text-ink-muted">{v.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.search_term_signals?.length ? (
        <Section title="Search-term signals">
          <ul className="space-y-1 text-xs">
            {json.search_term_signals.map((s: any, i: number) => (
              <li key={i} className="border border-base-700 px-2 py-1.5 flex items-start gap-2">
                <Pill text={s.intent} tone={s.intent === "wrong_audience" || s.intent === "low_intent" ? "neg" : s.intent === "buying" ? "pos" : "default"} />
                <span className="text-ink-muted flex-1">{s.observation}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.fixes?.length ? (
        <Section title="Specific fixes — ranked by lift">
          <ul className="space-y-2 text-sm">
            {json.fixes.map((f: any, i: number) => (
              <li key={i} className="flex gap-2 border border-base-700 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-live w-28 mt-0.5">{f.factor?.replace(/_/g, " ")}</span>
                <div className="flex-1">
                  <div className="text-ink">{f.fix}</div>
                  {f.expected_impact ? (
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-pos mt-1">{f.expected_impact}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.improved_headlines?.length ? (
        <Section title="Improved headlines (RSA-ready)">
          <ul className="space-y-1">
            {json.improved_headlines.map((h: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
                <CharBadge count={h.chars ?? h.text?.length ?? 0} max={30} />
                <span className="text-sm text-ink flex-1">{h.text}</span>
                <span className="text-[10px] font-mono uppercase tracking-ui-mega text-pos">{h.targets_factor?.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.negative_keywords?.length ? (
        <Section title="Negatives to add (from search terms)">
          <div className="flex flex-wrap gap-1.5">
            {json.negative_keywords.map((n: string, i: number) => (
              <span key={i} className="border border-base-700 bg-base-900/30 px-2 py-1 text-xs text-ink">−{n}</span>
            ))}
          </div>
        </Section>
      ) : null}

      {json?.landing_page_checklist?.length ? (
        <Section title="Landing page checklist">
          <ul className="space-y-1 text-sm">
            {json.landing_page_checklist.map((c: any, i: number) => (
              <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5">
                <Pill text={c.status_guess} tone={c.status_guess === "ok" ? "pos" : c.status_guess === "issue" ? "neg" : "default"} />
                <div className="flex-1">
                  <div className="text-ink">{c.item}</div>
                  {c.fix_if_issue ? <div className="text-xs text-ink-muted mt-0.5">{c.fix_if_issue}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
