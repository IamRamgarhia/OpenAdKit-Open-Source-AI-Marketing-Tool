"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { getCurrency } from "@/lib/currency";
import { buildBudgetPlannerPrompt, type BudgetPlannerInput } from "@/lib/prompts/budget-planner";
import type { GeneratorConfig } from "@/lib/generator-config";
import { BudgetPlannerSchema } from "@/lib/schemas/generators";
import { INDUSTRIES } from "@/lib/benchmarks";
import { estimateVolume, dailyFrom, parseNumber, type Assumption } from "@/lib/budget-estimates";
import { arr, obj, strList, txt } from "@/lib/safe-json";

const PROJECTION_PLATFORMS = ["Google Search", "Meta Feed", "TikTok In-Feed", "LinkedIn Sponsored"];

const config: GeneratorConfig<BudgetPlannerInput & Record<string, unknown>> = {
  title: "Ad Budget Planner",
  subtitle: "AI platform + funnel split and what NOT to spend on. Volume, CPA, ROAS and break-even are computed from your numbers (or labelled benchmarks) — not guessed by the AI.",
  platform: "google",
  campaign_type: "Budget Plan",
  maxTokens: 3500,
  fields: [
    { name: "total_monthly", label: "Total monthly budget", kind: "text", required: true, placeholder: "5000", hint: "Your selected currency (see Settings)." },
    { name: "goal", label: "Goal", kind: "text", required: true, placeholder: "trial signups / sales / leads" },
    { name: "business_type", label: "Business type", kind: "text", required: true, placeholder: "B2B SaaS / ecommerce / local service" },
    { name: "current_aov_or_ltv", label: "AOV / LTV", kind: "text", placeholder: "120 LTV", hint: "Your selected currency." },
    { name: "current_cvr", label: "Site CVR (%)", kind: "text", placeholder: "2.4", hint: "Blank = benchmark CVR (labelled)." },
    {
      name: "primary_platform",
      label: "Projection platform",
      kind: "select",
      section: "Volume projection inputs",
      options: PROJECTION_PLATFORMS.map((p) => ({ value: p, label: p })),
    },
    {
      name: "industry",
      label: "Industry (for benchmarks)",
      kind: "select",
      options: [{ value: "", label: "General / other" }, ...INDUSTRIES],
    },
    { name: "avg_cpc", label: "Your average CPC", kind: "text", placeholder: "e.g. 1.80", hint: "Your selected currency. Blank = benchmark CPC (USD budgets only)." },
    { name: "has_organic", label: "Organic traffic?", kind: "text", placeholder: "10k/mo SEO" },
    { name: "geo", label: "Geo", kind: "text", placeholder: "US + Canada", span: 2 },
  ],
  initial: { total_monthly: "", goal: "", business_type: "", current_aov_or_ltv: "", current_cvr: "", has_organic: "", geo: "", primary_platform: "Google Search", industry: "", avg_cpc: "" } as any,
  buildPrompt: (input) => buildBudgetPlannerPrompt(input as unknown as BudgetPlannerInput),
  buildTitle: (i: any) => `Budget Plan · ${i.total_monthly}/mo`,
  expectJson: true,
  schema: BudgetPlannerSchema,
  renderJson: (json, input) => <PlannerOutput json={json} input={input} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/budget-planner" />;
}

function fmt(n: number | null, digits = 0): string {
  return n === null || !Number.isFinite(n) ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function sourceLabel(a: Assumption): string {
  if (a.source === "input") return "your input";
  if (a.source === "benchmark") return a.note ?? "benchmark";
  return "not provided";
}

function PlannerOutput({ json, input }: { json: any; input: Partial<BudgetPlannerInput> }) {
  // Currency symbol from user setting — the AI's field names end in _usd but
  // the user's input was typed in their currency, so we display in that currency.
  const cur = getCurrency();
  const sym = cur.symbol;
  const platformSplit = arr(json?.platform_split).filter((p) => p && typeof p === "object");
  const funnel = arr(json?.funnel_split_overall).filter((f) => f && typeof f === "object");
  const breakout = arr(json?.campaign_breakout).filter((c) => c && typeof c === "object");
  const breakEven = obj(json?.break_even);
  const flags = arr(breakEven.saturation_flags).filter((f) => f && typeof f === "object");
  const reserve = obj(json?.reserve);
  const noGo = strList(json?.no_go_list);
  const est = estimateVolume({
    monthlyBudget: input?.total_monthly,
    platform: input?.primary_platform || "Google Search",
    industry: input?.industry || undefined,
    cpc: input?.avg_cpc,
    cvrPct: input?.current_cvr,
    aov: input?.current_aov_or_ltv,
    currencyCode: cur.code,
  });
  const budget = parseNumber(input?.total_monthly);
  const splitTotal = platformSplit.reduce((sum: number, p: any) => sum + (parseNumber(p.monthly_usd) ?? 0), 0);
  const splitOff = budget && splitTotal ? Math.abs(splitTotal - budget) / budget > 0.02 : false;
  return (
    <div className="space-y-4 stagger">
      {platformSplit.length ? (
        <Section title="Platform split · AI allocation">
          {splitOff ? (
            <p className="text-[11px] text-neg mb-2">
              The AI's split adds up to {sym}{fmt(splitTotal)} — not your {sym}{fmt(budget)} budget. Re-run or adjust by hand.
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {platformSplit.map((p: any, i: number) => (
              <li key={i} className="border border-base-700 px-2 py-2 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-live w-12 tabular text-base">{txt(p.pct)}%</span>
                  <span className="text-ink font-medium w-32">{txt(p.platform)}</span>
                  <span className="text-pos font-mono tabular">{sym}{fmt(parseNumber(p.monthly_usd))}/mo</span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-muted font-mono tabular">{sym}{fmt(dailyFrom(p.daily_usd, p.monthly_usd), 2)}/day</span>
                </div>
                <p className="text-ink-muted leading-relaxed">{txt(p.rationale)}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {funnel.length ? (
        <Section title="Funnel split">
          <div className="grid grid-cols-3 gap-2">
            {funnel.map((f: any, i: number) => (
              <div key={i} className="border border-base-700 p-3">
                <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">{txt(f.stage)}</div>
                <div className="font-display italic text-2xl text-ink mt-1 tabular">{txt(f.pct)}%</div>
                <div className="text-[11px] text-pos font-mono tabular">{sym}{fmt(parseNumber(f.monthly_usd))}</div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {breakout.length ? (
        <Section title="Campaign breakout">
          <ul className="space-y-1">
            {breakout.map((c: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5 text-xs flex-wrap">
                <span className="text-ink font-medium flex-1">{txt(c.campaign_name)}</span>
                {txt(c.platform) ? <Pill text={txt(c.platform)} /> : null}
                {txt(c.funnel_stage) ? <Pill text={txt(c.funnel_stage)} tone="live" /> : null}
                <span className="font-mono tabular text-pos w-20 text-right">{sym}{fmt(dailyFrom(c.daily_usd, c.monthly_usd), 2)}/d</span>
                <span className="font-mono tabular text-ink-subtle w-20 text-right">{sym}{fmt(parseNumber(c.monthly_usd))}/mo</span>
                {txt(c.learning_phase_note) ? <span className="basis-full text-[11px] text-ink-muted">{txt(c.learning_phase_note)}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Volume projection · estimate from your inputs">
        {est ? (
          <>
            <div className="grid md:grid-cols-3 gap-2">
              <Kv k="impressions" v={fmt(est.impressions)} />
              <Kv k="clicks" v={fmt(est.clicks)} />
              <Kv k="conversions" v={fmt(est.conversions, 1)} />
              <Kv k="cpa" v={est.cpa !== null ? `${sym}${fmt(est.cpa, 2)}` : "—"} />
              <Kv k="revenue" v={est.revenue !== null ? `${sym}${fmt(est.revenue)}` : "—"} />
              <Kv k="roas" v={est.roas !== null ? `${fmt(est.roas, 2)}×` : "—"} />
            </div>
            <div className="mt-3 text-[11px] text-ink-muted space-y-0.5" data-testid="projection-assumptions">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">assumptions ({input?.primary_platform || "Google Search"})</div>
              <div>Budget: {sym}{fmt(est.budget)} / month · your input</div>
              <div>CPC: {est.cpc.value !== null ? `${est.cpc.source === "benchmark" ? "$" : sym}${fmt(est.cpc.value, 2)}` : "—"} · {sourceLabel(est.cpc)}</div>
              <div>CVR: {est.cvrPct.value !== null ? `${fmt(est.cvrPct.value, 2)}%` : "—"} · {sourceLabel(est.cvrPct)}</div>
              <div>CTR (for impressions): {est.ctrPct.value !== null ? `${fmt(est.ctrPct.value, 2)}%` : "—"} · {sourceLabel(est.ctrPct)}</div>
              <div>AOV / LTV: {est.aov.value !== null ? `${sym}${fmt(est.aov.value, 2)}` : "—"} · {sourceLabel(est.aov)}</div>
              {est.cpc.source === "missing" ? (
                <div className="text-live">Enter your average CPC to project clicks — benchmark CPCs are USD and aren't applied to a {cur.code} budget.</div>
              ) : null}
            </div>
            <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">
              Estimates, not forecasts: clicks = budget ÷ CPC, conversions = clicks × CVR, revenue = conversions × AOV.
              Benchmarks are directional industry ranges — replace them with your own account data as soon as you have it.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">Enter a monthly budget to see the projection.</p>
        )}
      </Section>

      <Section title="Break-even">
        <Kv k="cpa break-even (gross)" v={est?.breakEvenCpa ? `${sym}${fmt(est.breakEvenCpa, 2)}` : "add AOV / LTV"} />
        <p className="text-[11px] text-ink-muted mt-2">CPA at which revenue equals ad spend, before margin. Your profitable CPA is lower — multiply by your gross margin.</p>
        {flags.length ? (
          <div className="mt-3">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg mb-1">saturation flags · AI judgement</div>
            <ul className="text-xs text-ink space-y-0.5">{flags.map((f: any, i: number) => (
              <li key={i}>
                <span className="text-ink">{txt(f.platform)}</span>
                {txt(f.reason) ? <span className="text-ink-muted"> — {txt(f.reason)}</span> : null}
              </li>
            ))}</ul>
          </div>
        ) : null}
      </Section>

      {Object.keys(reserve).length ? (
        <Section title="Reserve">
          <Kv k="reserve" v={`${txt(reserve.pct) || 0}% · ${sym}${fmt(parseNumber(reserve.monthly_usd))}`} pos />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {strList(reserve.uses).map((u, i) => <Pill key={i} text={u} />)}
          </div>
        </Section>
      ) : null}

      {noGo.length ? (
        <Section title="No-go list">
          <ul className="space-y-1 text-sm text-neg">{noGo.map((n, i) => <li key={i}>✕ {n}</li>)}</ul>
        </Section>
      ) : null}
    </div>
  );
}
