"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { buildAudienceTargetingPrompt, type AudienceTargetingInput } from "@/lib/prompts/audience-targeting";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<AudienceTargetingInput & Record<string, unknown>> = {
  title: "Audience Targeting Plan",
  subtitle: "Layered targeting (cold / warm / hot) sized to your actual budget + tested against current performance. Paste real numbers — the AI rebalances based on what's working.",
  platform: "meta",
  campaign_type: "Audience Plan",
  maxTokens: 3500,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      section: "Context",
      options: [
        { value: "meta", label: "Meta" },
        { value: "google", label: "Google" },
        { value: "linkedin", label: "LinkedIn" },
        { value: "tiktok", label: "TikTok" },
      ],
    },
    { name: "product", label: "Product", kind: "text", required: true, placeholder: "e.g. accounting SaaS for solopreneurs", span: 2 },
    { name: "audience_who", label: "Who buys this", kind: "textarea", required: true, rows: 2, placeholder: "Solo freelancers + 1-3 person agencies, US/CA, $1k-10k MRR", span: 2 },
    { name: "geo", label: "Geo", kind: "text", required: true, placeholder: "US + Canada" },
    { name: "goal", label: "Goal", kind: "text", required: true, placeholder: "trial signups · purchases · qualified leads" },

    // ----- Performance data -----
    { name: "budget_monthly", label: "Budget / mo (USD)", kind: "text", required: true, section: "Performance data (last 7-30 days)", placeholder: "e.g. 3000", hint: "What you can spend per month total across all tiers." },
    { name: "current_cpa", label: "Current CPA", kind: "text", placeholder: "e.g. $42", hint: "Cost per acquired customer / signup / lead so far." },
    { name: "current_cvr", label: "Current conversion rate", kind: "text", placeholder: "e.g. 2.1%", hint: "Click → goal completion rate." },
    { name: "current_aov_or_ltv", label: "AOV or LTV", kind: "text", placeholder: "e.g. $120 AOV / $480 LTV", hint: "Helps the AI rebalance toward higher-LTV cohorts." },
    { name: "existing_audiences", label: "Audiences currently running", kind: "textarea", rows: 3, placeholder: "List the audience-name + monthly spend + CPA for each currently active audience. e.g.\nLAL 1% Purchasers — $1200/mo — $38 CPA\nInterest: 'Bookkeeping' — $400/mo — $89 CPA", span: 2, hint: "AI uses this to decide what to scale, pause, or replace." },
    { name: "best_creator_audience", label: "Best-performing audience signal", kind: "text", placeholder: "e.g. LAL 1% Purchasers (last 180d)", hint: "Optional — name the audience you'd seed a new lookalike from." },

    // ----- Optional screenshot -----
    { name: "audience_screenshot", label: "Screenshot of your Audiences tab (optional)", kind: "image", section: "Optional — drop a screenshot, AI reads it directly", placeholder: "Drop a Meta Ads Manager / Google Audiences screenshot. AI extracts size + spend + CPA per row.", span: 2, hint: "Vision-capable providers only (Claude / OpenAI / Gemini)." },
  ],
  initial: {
    platform: "meta",
    product: "",
    audience_who: "",
    budget_monthly: "",
    geo: "",
    goal: "",
    current_cpa: "",
    current_cvr: "",
    current_aov_or_ltv: "",
    existing_audiences: "",
    best_creator_audience: "",
    audience_screenshot: null,
  } as any,
  buildPrompt: (input) => buildAudienceTargetingPrompt(input as unknown as AudienceTargetingInput),
  buildTitle: (i: any) => `Audience · ${i.platform} · ${i.product?.slice(0, 24)}`,
  expectJson: true,
  renderJson: (json) => <AudienceOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/audience" />;
}

function Tier({ title, data, tone }: { title: string; data: any; tone: "info" | "live" | "pos" }) {
  if (!data) return null;
  return (
    <div className="border border-base-600 bg-base-900/40">
      <div className="flex items-center justify-between border-b border-base-700 px-4 py-2">
        <h3 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">{title}</h3>
        <Pill text={`${data.budget_pct ?? 0}% budget`} tone={tone} />
      </div>
      <div className="p-4 space-y-3 text-sm">
        {data.audience_size_range ? <Kv k="size range" v={data.audience_size_range} /> : null}
        {data.interests_stacks?.length ? (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">interest stacks</div>
            <ul className="space-y-1">
              {data.interests_stacks.map((s: any, i: number) => (
                <li key={i} className="border border-base-700 px-2 py-1 text-xs">
                  <span className="text-live">{s.label}: </span><span className="text-ink">{s.items?.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.audiences?.length ? (
          <ul className="space-y-1.5">
            {data.audiences.map((a: any, i: number) => (
              <li key={i} className="border border-base-700 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-ink font-medium">{a.name}</span>
                  <Pill text={a.expected_size ?? "?"} label="size" />
                </div>
                <div className="text-ink-muted mt-0.5">{a.rule}</div>
              </li>
            ))}
          </ul>
        ) : null}
        {data.lookalike_seeds?.length ? (
          <div className="text-xs">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">lookalike seeds</div>
            {data.lookalike_seeds.map((l: any, i: number) => (
              <div key={i} className="text-ink">{l.match_pct}% from <span className="font-mono text-info">{l.source_list_name}</span></div>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          {data.kpi_target ? <Kv k="kpi" v={data.kpi_target} /> : null}
          {data.frequency_cap ? <Kv k="freq cap" v={data.frequency_cap} /> : null}
          {data.creative_format ? <Kv k="format" v={data.creative_format} /> : null}
        </div>
      </div>
    </div>
  );
}

function AudienceOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.computed_targets ? (
        <Section title="Reality check — computed from your numbers">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Kv k="CPA ceiling" v={json.computed_targets.cpa_target_ceiling ?? "—"} />
            <Kv k="LTV : CPA" v={json.computed_targets.ltv_to_cpa_health ?? "—"} />
            <Kv k="next move" v={json.computed_targets.scale_or_squeeze ?? "—"} />
          </div>
        </Section>
      ) : null}
      {json?.audience_diagnosis ? (
        <Section title="Existing setup · diagnosis">
          <p className="text-sm text-ink leading-relaxed">{json.audience_diagnosis}</p>
        </Section>
      ) : null}
      <Tier title="Cold prospecting" data={json?.cold_prospecting} tone="info" />
      <Tier title="Warm retargeting" data={json?.warm_retargeting} tone="live" />
      <Tier title="Hot remarketing" data={json?.hot_remarketing} tone="pos" />

      {json?.exclusions?.length ? (
        <Section title="Exclusions (apply across tiers)">
          <ul className="space-y-1">
            {json.exclusions.map((e: any, i: number) => (
              <li key={i} className="flex gap-2 border border-base-700 px-2 py-1.5 text-xs">
                <span className="text-ink font-medium w-32">{e.name}</span>
                <span className="flex-1 text-ink-muted">{e.rule}</span>
                <span className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint">{e.applies_to_tiers?.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.platform_specific_features_to_enable?.length ? (
        <Section title="Platform features to enable">
          <ul className="space-y-1.5">
            {json.platform_specific_features_to_enable.map((f: any, i: number) => (
              <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5 text-xs">
                <Pill text={f.use ? "on" : "off"} tone={f.use ? "pos" : "default"} />
                <div className="flex-1">
                  <div className="text-ink">{f.feature}</div>
                  <div className="text-ink-muted text-[11px]">{f.rationale}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
