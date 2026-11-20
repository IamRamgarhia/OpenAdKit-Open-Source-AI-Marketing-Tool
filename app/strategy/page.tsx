"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { arr, joinList, num, obj, strList, txt } from "@/lib/safe-json";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { buildStrategyPrompt, type StrategyInput } from "@/lib/prompts/strategy-recommender";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<StrategyInput & Record<string, unknown>> = {
  title: "What ad should I run?",
  subtitle: "Platform recommendation based on your actual budget, business, and audience — with anti-recommendations.",
  platform: "google",
  campaign_type: "Strategy Plan",
  maxTokens: 2800,
  fields: [
    {
      name: "business_type",
      label: "Business type",
      kind: "select",
      options: [
        { value: "ecommerce", label: "E-commerce" },
        { value: "saas_b2b", label: "B2B SaaS" },
        { value: "saas_b2c", label: "B2C app / SaaS" },
        { value: "local_service", label: "Local service business" },
        { value: "agency", label: "Agency / consultancy" },
        { value: "publisher", label: "Publisher / media" },
        { value: "education", label: "Education / coaching" },
        { value: "marketplace", label: "Marketplace" },
      ],
    },
    { name: "product", label: "Product / service", kind: "text", required: true, placeholder: "e.g. AI photo editor", span: 2 },
    { name: "monthly_budget", label: "Budget / month (USD)", kind: "text", required: true, placeholder: "1500" },
    { name: "goal", label: "Primary goal", kind: "text", required: true, placeholder: "free trial signups" },
    { name: "timeline", label: "Timeline", kind: "text", placeholder: "3 weeks to first read" },
    { name: "audience_age", label: "Audience age band", kind: "text", placeholder: "25-44" },
    { name: "geo", label: "Geo", kind: "text", placeholder: "US + Canada" },
  ],
  initial: { business_type: "ecommerce", product: "", monthly_budget: "", goal: "", timeline: "", audience_age: "", geo: "" } as any,
  buildPrompt: (input) => buildStrategyPrompt(input as unknown as StrategyInput),
  buildTitle: (i: any) => `Strategy · ${i.product}`,
  expectJson: true,
  renderJson: (json) => <StrategyOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="strategy" />;
}

function StrategyOutput({ json }: { json: any }) {
  // No schema on this tool — read everything defensively (lib/safe-json).
  const primary = obj(json?.primary_platform);
  const secondary = obj(json?.secondary_platform);
  const kpis = arr(json?.kpi_targets).filter((k) => k && typeof k === "object");
  const split = arr(json?.month_one_budget_split).filter((b) => b && typeof b === "object");
  const anti = strList(json?.anti_recommendations);
  const stops = strList(json?.stop_conditions_to_resolve_first);
  return (
    <div className="space-y-4 stagger">
      <Section title="Primary platform">
        <div className="flex items-baseline gap-3">
          <div className="font-display italic text-3xl text-live">{txt(primary.name) || "—"}</div>
          <Pill label="min budget" text={`$${num(primary.min_budget_usd).toLocaleString()}/mo`} />
        </div>
        <p className="text-sm text-ink-muted mt-3 leading-relaxed">{txt(primary.reason)}</p>
      </Section>

      {txt(secondary.name) ? (
        <Section title="Secondary platform">
          <div className="flex items-baseline gap-3">
            <div className="font-display italic text-2xl text-ink">{txt(secondary.name)}</div>
            <Pill label="min" text={`$${num(secondary.min_budget_usd).toLocaleString()}/mo`} />
          </div>
          <p className="text-sm text-ink-muted mt-2">{txt(secondary.reason)}</p>
        </Section>
      ) : null}

      <Section title="Plan">
        <div className="grid md:grid-cols-3 gap-2">
          <Kv k="funnel stage" v={txt(json?.funnel_stage) || "—"} />
          <Kv k="timeline" v={`${txt(json?.timeline_to_first_read_days) || "—"} days`} />
          <Kv k="format priority" v={joinList(json?.creative_format_priority) || "—"} />
        </div>
      </Section>

      {kpis.length ? (
        <Section title="KPI targets">
          <ul className="space-y-1.5 text-xs">
            {kpis.map((k: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-ink-faint w-12">m{txt(k.month)}</span>
                <span className="flex-1 text-ink">{txt(k.metric)}</span>
                <span className="text-pos font-mono tabular">{txt(k.target)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {split.length ? (
        <Section title="Month 1 budget split">
          <ul className="space-y-1.5 text-sm">
            {split.map((b: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-live w-12 tabular">{txt(b.pct)}%</span>
                <span className="w-32 text-ink">{txt(b.platform)}</span>
                <span className="text-ink-muted text-xs tabular">${num(b.dollars).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {anti.length ? (
        <Section title="Anti-recommendations">
          <ul className="list-disc list-inside text-sm text-neg space-y-0.5">{anti.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </Section>
      ) : null}

      {stops.length ? (
        <Section title="Resolve before launch">
          <ul className="space-y-1 text-sm">{stops.map((st, i) => <li key={i} className="flex gap-2"><span className="text-live">○</span>{st}</li>)}</ul>
        </Section>
      ) : null}
    </div>
  );
}
