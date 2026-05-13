"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildKeywordPrompt, type KeywordInput } from "@/lib/prompts/keyword-strategy";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<KeywordInput & Record<string, unknown>> = {
  title: "Keyword Strategy Builder",
  subtitle: "Funnel-mapped keywords + match types + negatives + bid strategy. Anchored to your real Search Terms data so the negatives + ad groups reflect what's actually happening, not generic guesses.",
  platform: "google",
  campaign_type: "Keyword Plan",
  maxTokens: 4500,
  fields: [
    { name: "product", label: "Product / service", kind: "text", required: true, section: "Context", placeholder: "e.g. tax prep software", span: 2 },
    { name: "market", label: "Market / region", kind: "text", required: true, placeholder: "US small businesses" },
    { name: "competitors", label: "Known competitors", kind: "text", placeholder: "TurboTax, FreshBooks, HR Block" },
    { name: "current_keywords", label: "Current keywords (if any)", kind: "textarea", rows: 4, placeholder: "Paste your current list, one per line. Add the match-type prefix when you can:\n[exact] tax software for freelancers\n\"phrase only\"\nbroad term", span: 2 },

    // ----- Performance data from Search Terms report -----
    { name: "search_terms_report", label: "Search Terms report", kind: "textarea", rows: 6, section: "Performance data (from Google Ads → Search Terms report)", placeholder: "Paste rows in this shape — one per line:\n\nquery · impressions · clicks · CTR · conversions · cost · added/excluded\n\nExample:\n\"freelancer tax help\" · 1820 · 38 · 2.1% · 5 · $164 · added\n\"free tax software\" · 980 · 14 · 1.4% · 0 · $48 · not yet", span: 2, hint: "The single highest-leverage input. AI uses it to find missing negatives + waste + new long-tail opportunities." },
    { name: "monthly_budget", label: "Monthly Google Ads budget", kind: "text", placeholder: "e.g. $4000" },
    { name: "current_conversions_per_month", label: "Conversions / month (current)", kind: "number", placeholder: "e.g. 28", hint: "Drives the bidding-strategy recommendation (Manual vs Smart)." },
    { name: "target_cpa", label: "Target CPA (optional)", kind: "text", placeholder: "e.g. $35" },
    { name: "search_console_export", label: "Search Console organic queries (optional)", kind: "textarea", rows: 4, placeholder: "Optional — paste 10-20 top organic queries with impressions + clicks. AI flags queries you rank for organically AND should bid on, vs ones to skip paid.", span: 2 },

    // ----- Optional screenshot -----
    { name: "search_terms_screenshot", label: "Screenshot of Search Terms report (optional)", kind: "image", section: "Optional — drop a screenshot, AI reads it directly", placeholder: "Drop a Search Terms report screenshot. AI extracts the same data as the typed field above.", span: 2, hint: "Vision-capable providers only (Claude / OpenAI / Gemini)." },
  ],
  initial: {
    product: "",
    market: "",
    competitors: "",
    current_keywords: "",
    search_terms_report: "",
    monthly_budget: "",
    current_conversions_per_month: "" as any,
    target_cpa: "",
    search_console_export: "",
    search_terms_screenshot: null,
  } as any,
  buildPrompt: (input) => buildKeywordPrompt(input as unknown as KeywordInput),
  buildTitle: (i: any) => `Keywords · ${i.product}`,
  expectJson: true,
  renderJson: (json) => <KwOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/keywords" />;
}

const intentTone: Record<string, "pos" | "live" | "info" | "default"> = {
  transactional: "pos",
  commercial_investigation: "live",
  informational: "info",
  branded: "default",
  navigational: "default",
};

function KwOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.search_terms_analysis ? (
        <Section title="Search Terms analysis — from your data">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <Kv k="waste spotted" v={json.search_terms_analysis.estimated_waste ?? "—"} />
            <Kv k="conversion queries" v={json.search_terms_analysis.high_intent_queries_count ?? "—"} />
            <Kv k="zero-click queries" v={json.search_terms_analysis.zero_conversion_queries_count ?? "—"} />
            <Kv k="match-type gaps" v={json.search_terms_analysis.match_type_gaps ?? "—"} />
          </div>
          {json.search_terms_analysis.summary ? (
            <p className="text-[12px] text-ink-muted leading-relaxed">{json.search_terms_analysis.summary}</p>
          ) : null}
        </Section>
      ) : null}

      <Section title={`Keywords · ${json?.keywords?.length ?? 0}`} actions={<CopyButton text={(json?.keywords ?? []).map((k: any) => `${k.term}\t${k.match_type}`).join("\n")} label="copy tsv" />}>
        <ul className="space-y-1">
          {(json?.keywords ?? []).map((k: any, i: number) => (
            <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5 text-xs">
              <Pill text={k.intent?.replace(/_/g, " ")} tone={intentTone[k.intent] ?? "default"} />
              <span className="font-mono text-[10px] uppercase tracking-ui-mega text-ink-faint w-14">{k.match_type}</span>
              <span className="flex-1 text-ink">{k.term}</span>
              <span className="text-ink-subtle truncate w-32">{k.ad_group_suggestion}</span>
              <span className={`font-mono text-[10px] tabular ${k.competition_guess === "high" ? "text-neg" : k.competition_guess === "medium" ? "text-live" : "text-pos"}`}>{k.competition_guess}</span>
            </li>
          ))}
        </ul>
      </Section>

      {json?.negative_keywords?.length ? (
        <Section title="Negatives" actions={<CopyButton text={json.negative_keywords.map((n: any) => typeof n === "string" ? n : n.term).join("\n")} label="copy" />}>
          <ul className="space-y-1">
            {json.negative_keywords.map((n: any, i: number) => {
              const term = typeof n === "string" ? n : n.term;
              const reason = typeof n === "string" ? null : n.reason;
              return (
                <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5 text-xs">
                  <span className="text-neg">−</span>
                  <span className="text-ink font-mono">{term}</span>
                  {reason ? <span className="text-ink-muted text-[11px] flex-1">{reason}</span> : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {json?.ad_group_structure?.length ? (
        <Section title="Ad group structure">
          <ul className="space-y-1.5">
            {json.ad_group_structure.map((g: any, i: number) => (
              <li key={i} className="border border-base-700 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{g.name}</span>
                  <Pill text={`${g.keyword_count} kw`} />
                  <span className="text-ink-muted text-[11px]">{g.theme}</span>
                </div>
                <div className="text-[11px] text-ink-subtle mt-1">examples: {g.example_keywords?.join(", ")}</div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.long_tail_opportunities?.length ? (
        <Section title="Long-tail opportunities">
          <ul className="list-disc list-inside text-sm text-ink space-y-0.5">{json.long_tail_opportunities.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
        </Section>
      ) : null}

      {json?.competitor_gaps?.length ? (
        <Section title="Competitor gaps">
          <ul className="list-disc list-inside text-sm text-ink space-y-0.5">{json.competitor_gaps.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
        </Section>
      ) : null}

      {json?.bidding_recommendation ? (
        <Section title="Bidding">
          <div className="grid md:grid-cols-2 gap-2">
            <Kv k="strategy" v={json.bidding_recommendation.strategy} />
            <Kv k="learning days" v={json.bidding_recommendation.learning_phase_days} />
          </div>
          <p className="text-xs text-ink-muted mt-2">{json.bidding_recommendation.reason}</p>
          {json.bidding_recommendation.switch_to_smart_when ? (
            <p className="text-xs text-pos mt-1">→ upgrade when: {json.bidding_recommendation.switch_to_smart_when}</p>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
