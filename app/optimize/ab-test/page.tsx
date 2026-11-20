"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { buildAbTestPrompt, type AbTestInput } from "@/lib/prompts/ab-test";
import type { GeneratorConfig } from "@/lib/generator-config";
import { AbTestSchema } from "@/lib/schemas/generators";
import { planAbTest } from "@/lib/ab-math";
import { arr, obj, strList, txt } from "@/lib/safe-json";

const config: GeneratorConfig<AbTestInput & Record<string, unknown>> = {
  title: "A/B Test Planner",
  subtitle: "Single-variable plan with kill/winner rules. Sample size is computed from YOUR baseline, effect size and traffic — not guessed by the AI.",
  platform: "google",
  campaign_type: "A/B Plan",
  maxTokens: 2800,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      options: [
        { value: "Google Search", label: "Google Search" },
        { value: "Meta Feed", label: "Meta Feed" },
        { value: "TikTok In-Feed", label: "TikTok In-Feed" },
        { value: "LinkedIn", label: "LinkedIn" },
      ],
    },
    { name: "baseline_rate_pct", label: "Baseline conversion rate (%)", kind: "text", required: true, placeholder: "e.g. 3.2", hint: "Control's current rate for the test metric (CTR, CVR…)." },
    { name: "mde_pct", label: "Min. detectable effect (%)", kind: "text", required: true, placeholder: "e.g. 20", hint: "Relative lift worth detecting: 20 = +20%." },
    { name: "daily_visitors_per_variant", label: "Daily visitors per variant", kind: "text", required: true, placeholder: "e.g. 400", hint: "Clicks / impressions / sessions — the rate's denominator." },
    { name: "current_ad", label: "Current control ad", kind: "textarea", required: true, rows: 5, placeholder: "Paste the full ad…", span: 2 },
    { name: "hypothesis_to_test", label: "What you want to test", kind: "textarea", required: true, rows: 2, placeholder: "e.g. does urgency in the headline lift CTR?", span: 2 },
  ],
  initial: { platform: "Google Search", baseline_rate_pct: "", mde_pct: "20", daily_visitors_per_variant: "", current_ad: "", hypothesis_to_test: "" } as any,
  buildPrompt: (input) => buildAbTestPrompt(input as unknown as AbTestInput),
  buildTitle: (i: any) => `A/B · ${i.platform}`,
  expectJson: true,
  schema: AbTestSchema,
  renderJson: (json, input) => <AbOutput json={json} input={input} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/ab-test" />;
}

function AbOutput({ json, input }: { json: any; input: Partial<AbTestInput> }) {
  const plan = planAbTest(input?.baseline_rate_pct, input?.mde_pct, input?.daily_visitors_per_variant);
  const variants = arr(json?.variants).filter((v) => v && typeof v === "object");
  const rules = Object.entries(obj(json?.decision_rules)).filter(([, v]) => txt(v));
  const failures = strList(json?.failure_modes_to_avoid);
  return (
    <div className="space-y-4 stagger">
      <Section title="Hypothesis">
        <p className="text-sm text-ink leading-relaxed">{txt(json?.hypothesis)}</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {txt(json?.primary_metric) ? <Pill text={txt(json?.primary_metric)} tone="live" label="primary" /> : null}
          {strList(json?.secondary_metrics).map((m, i) => (
            <Pill key={i} text={m} label="2nd" />
          ))}
        </div>
      </Section>

      <Section title="Variants">
        <ul className="space-y-2">
          {variants.map((v: any, i: number) => (
            <li key={i} className="border border-base-700 bg-base-900/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Pill text={txt(v.label)} tone={v.label === "Control" ? "default" : "live"} />
                <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">change: {txt(v.single_change_from_control)}</span>
              </div>
              <p className="text-sm text-ink whitespace-pre-line">{txt(v.ad_copy)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Computed here from the user's inputs — the model is not asked for numbers. */}
      <Section title="Sample size · computed from your inputs">
        {plan ? (
          <>
            <div className="grid md:grid-cols-3 gap-2">
              <Kv k="sample / variant" v={plan.perVariant.toLocaleString()} />
              <Kv k="days to finish" v={plan.days !== null ? `${plan.days}` : "add daily traffic"} />
              <Kv k="detects" v={`${plan.baselinePct}% → ${plan.targetPct.toFixed(2)}%`} />
            </div>
            {plan.days !== null && plan.days > 28 ? (
              <p className="text-[12px] text-neg mt-2">
                Over 4 weeks at this traffic. Test a bolder change (larger effect) or a higher-traffic placement instead.
              </p>
            ) : null}
            <p className="text-[11px] text-ink-muted mt-2">
              Two-proportion z-test · α = 0.05 two-sided · 80% power · {plan.mdePct}% relative MDE. Don't stop early when one
              variant looks ahead — wait for the full sample.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Enter a baseline rate and minimum detectable effect to compute the required sample.
          </p>
        )}
      </Section>

      {rules.length ? (
        <Section title="Decision rules">
          <ul className="space-y-1.5 text-sm">
            {rules.map(([k, v]) => (
              <li key={k} className="flex gap-2 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-live w-32 mt-0.5">{k.replace(/_/g, " ")}</span>
                <span className="text-ink flex-1">{txt(v)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {failures.length ? (
        <Section title="Failure modes">
          <ul className="list-disc list-inside text-sm text-ink-muted space-y-0.5">
            {failures.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
