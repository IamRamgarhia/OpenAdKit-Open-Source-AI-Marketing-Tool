"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { getCurrency } from "@/lib/currency";
import { buildBudgetWastePrompt, parseImpressionShare, type BudgetWasteInput } from "@/lib/prompts/budget-waste";
import type { GeneratorConfig } from "@/lib/generator-config";
import { BudgetWasteSchema } from "@/lib/schemas/generators";

const config: GeneratorConfig<BudgetWasteInput & Record<string, unknown>> = {
  title: "Budget Waste Analyzer",
  subtitle: "Three pulse numbers. Named contributors. No letter grades. STOP-conditions enforced.",
  platform: "google",
  campaign_type: "Budget Audit",
  maxTokens: 3500,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      options: [
        { value: "Google Ads", label: "Google Ads" },
        { value: "Meta Ads", label: "Meta Ads" },
        { value: "TikTok Ads", label: "TikTok Ads" },
        { value: "LinkedIn Ads", label: "LinkedIn Ads" },
      ],
    },
    { name: "monthly_spend", label: "Monthly spend", kind: "text", required: true, placeholder: "5000", hint: "Your selected currency (see Settings)." },
    { name: "campaign_summary", label: "Campaigns & setup", kind: "textarea", required: true, rows: 5, placeholder: "Describe your campaigns: structure, audiences, match types, recent CPA, conversion volume.", span: 2 },
    { name: "match_types", label: "Match types used", kind: "text", placeholder: "broad / phrase / exact" },
    { name: "has_negatives", label: "Negative list?", kind: "text", placeholder: "yes / no / partial" },
    { name: "schedule", label: "Ad scheduling", kind: "text", placeholder: "always-on / business hours / custom" },
    { name: "device_targeting", label: "Devices", kind: "text", placeholder: "all / mobile-only / etc" },
    { name: "geo_targeting", label: "Geo", kind: "text", placeholder: "US / 10mi from store / etc" },
    { name: "excludes_customers", label: "Excludes existing customers?", kind: "text", placeholder: "yes / no" },
    { name: "impression_share_pct", label: "Impression share (%)", kind: "text", placeholder: "e.g. 42", hint: "From the platform's Search impression share column. Blank = demand-captured is not shown." },
  ],
  initial: {
    platform: "Google Ads",
    monthly_spend: "",
    campaign_summary: "",
    match_types: "",
    has_negatives: "",
    schedule: "",
    device_targeting: "",
    geo_targeting: "",
    excludes_customers: "",
    impression_share_pct: "",
  } as any,
  buildPrompt: (input) => buildBudgetWastePrompt(input as unknown as BudgetWasteInput),
  buildTitle: (i: any) => `Budget · ${i.platform}`,
  expectJson: true,
  schema: BudgetWasteSchema,
  renderJson: (json, input) => <BudgetOutput json={json} input={input} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/budget" />;
}

const priorityTone: Record<string, "neg" | "live" | "default" | "pos"> = {
  critical: "neg",
  high: "neg",
  medium: "live",
  low: "default",
};

function BudgetOutput({ json, input }: { json: any; input: Partial<BudgetWasteInput> }) {
  const sym = getCurrency().symbol;
  // Demand captured comes from the user's impression share, never the model.
  const share = parseImpressionShare(input?.impression_share_pct);
  if (json?.stop_condition) {
    return (
      <Section title="STOP">
        <p className="text-sm text-neg font-medium">{json.stop_condition}</p>
        <p className="text-xs text-ink-muted mt-2">Resolve the stop condition before any optimization recommendations make sense.</p>
      </Section>
    );
  }
  return (
    <div className="space-y-4 stagger">
      {json?.pulse ? (
        <Section title="Pulse">
          <div className={`grid gap-2 ${share !== null ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <PulseCard label="waste / month" value={`${sym}${(json.pulse.waste_per_month_usd?.value ?? 0).toLocaleString()}`} contrib={json.pulse.waste_per_month_usd?.top_contributor} fix={json.pulse.waste_per_month_usd?.fix_pointer} tone="neg" />
            {share !== null ? (
              <PulseCard label="demand captured · your impression share" value={`${share}%`} contrib={json.pulse.demand_captured_pct?.top_contributor} fix={json.pulse.demand_captured_pct?.fix_pointer} tone="live" />
            ) : null}
            <PulseCard label="cpa efficiency" value={`${json.pulse.cpa_efficiency_ratio?.value ?? 0}×`} contrib={json.pulse.cpa_efficiency_ratio?.top_contributor} fix={json.pulse.cpa_efficiency_ratio?.fix_pointer} tone="info" />
          </div>
          {share === null ? (
            <p className="text-[11px] text-ink-muted mt-2">Add your impression share to see how much available demand you capture — it isn't estimated.</p>
          ) : null}
        </Section>
      ) : null}

      {json?.audit?.length ? (
        <Section title={`Audit · ${json.audit.length} checks`}>
          <ul className="space-y-1.5">
            {json.audit.map((a: any, i: number) => (
              <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5">
                <Pill text={a.answer} tone={a.answer === "hit" ? "neg" : a.answer === "miss" ? "pos" : "default"} />
                <Pill text={a.priority} tone={priorityTone[a.priority] ?? "default"} label="pri" />
                <div className="flex-1 text-xs">
                  <div className="text-ink">{a.question}</div>
                  <div className="text-ink-muted mt-0.5">{a.evidence}</div>
                  {a.fix ? <div className="text-pos mt-0.5">→ {a.fix}</div> : null}
                </div>
                <span className="font-mono text-[11px] text-neg tabular shrink-0">{sym}{(a.estimated_waste_usd ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.top_5_fixes_by_roi?.length ? (
        <Section title="Top fixes by ROI">
          <ul className="space-y-1.5">
            {json.top_5_fixes_by_roi.map((f: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5 text-xs">
                <span className="font-mono text-ink-faint w-5 tabular">{i + 1}</span>
                <span className="flex-1 text-ink">{f.fix}</span>
                <Kv k="rec" v={`${sym}${f.estimated_recovery_usd?.toLocaleString() ?? 0}`} pos />
                <Kv k="hr" v={f.effort_hours ?? 0} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.reallocation_plan ? (
        <Section title="Reallocation plan">
          <p className="text-sm text-ink">{json.reallocation_plan}</p>
        </Section>
      ) : null}
    </div>
  );
}

function PulseCard({ label, value, contrib, fix, tone }: { label: string; value: string; contrib?: string; fix?: string; tone: "neg" | "live" | "info" }) {
  const toneMap: Record<string, string> = { neg: "text-neg", live: "text-live", info: "text-info" };
  return (
    <div className="border border-base-600 bg-base-900/30 p-4">
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">{label}</div>
      <div className={`font-display italic text-3xl mt-1 tabular ${toneMap[tone]}`}>{value}</div>
      {contrib ? <div className="text-[11px] text-ink mt-2 leading-relaxed">{contrib}</div> : null}
      {fix ? <div className="text-[11px] text-pos mt-1 leading-relaxed">→ {fix}</div> : null}
    </div>
  );
}
