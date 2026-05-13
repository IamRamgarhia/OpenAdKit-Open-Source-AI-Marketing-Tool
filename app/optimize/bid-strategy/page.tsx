"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { buildBidStrategyPrompt, type BidStrategyInput } from "@/lib/prompts/bid-strategy";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<BidStrategyInput & Record<string, unknown>> = {
  title: "Bid Strategy Advisor",
  subtitle: "Strategy matched to your actual conversion volume + trend, not your aspirations. AI checks Smart Bidding readiness gates and tells you exactly when to graduate.",
  platform: "google",
  campaign_type: "Bid Advisor",
  maxTokens: 3000,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      section: "Context",
      options: [
        { value: "Google Ads", label: "Google Ads" },
        { value: "Meta Ads", label: "Meta Ads" },
        { value: "TikTok Ads", label: "TikTok Ads" },
      ],
    },
    { name: "campaign_type_setup", label: "Campaign type", kind: "text", required: true, placeholder: "Search / PMax / Sales / App Installs" },
    { name: "goal", label: "Goal", kind: "text", required: true, placeholder: "leads / sales / app installs" },

    // ----- Current setup -----
    { name: "current_strategy", label: "Current bid strategy in use", kind: "select", section: "Current setup", options: [
      { value: "manual_cpc", label: "Manual CPC" },
      { value: "ecpc", label: "Enhanced CPC" },
      { value: "maximize_clicks", label: "Maximize Clicks" },
      { value: "maximize_conversions", label: "Maximize Conversions" },
      { value: "target_cpa", label: "Target CPA" },
      { value: "target_roas", label: "Target ROAS" },
      { value: "lowest_cost", label: "Lowest Cost (Meta)" },
      { value: "cost_cap", label: "Cost Cap (Meta)" },
      { value: "minimum_roas", label: "Minimum ROAS (Meta)" },
      { value: "none", label: "No strategy set yet / new campaign" },
    ] },
    { name: "current_strategy_days_active", label: "Days since this strategy was last changed", kind: "number", placeholder: "e.g. 21", hint: "Smart Bidding needs 7+ uninterrupted days to learn. Below that, the AI flags it." },

    // ----- Performance data -----
    { name: "monthly_budget", label: "Budget / month", kind: "text", required: true, section: "Performance data", placeholder: "$5000" },
    { name: "conversions_per_month", label: "Conversions / month (campaign)", kind: "number", required: true, placeholder: "35" },
    { name: "conversions_last_7d", label: "Conversions in last 7 days (campaign)", kind: "number", placeholder: "e.g. 9", hint: "Smart Bidding tiers: ≥ 15/week for Target CPA, ≥ 30/week for Target ROAS." },
    { name: "account_monthly_conversions", label: "Account-wide conversions / month", kind: "number", placeholder: "e.g. 120", hint: "Some platforms (Google) borrow signal across campaigns. Higher = faster learning." },
    { name: "cpa_trend", label: "CPA trend (last 30 days)", kind: "select", options: [
      { value: "stable", label: "Stable (±10%)" },
      { value: "rising", label: "Rising — getting worse" },
      { value: "falling", label: "Falling — improving" },
      { value: "volatile", label: "Volatile — bouncing around" },
      { value: "unknown", label: "Don't know yet" },
    ] },
    { name: "current_cpa", label: "Current CPA", kind: "text", placeholder: "$45" },
    { name: "target_cpa", label: "Target CPA", kind: "text", placeholder: "$30" },
    { name: "target_roas", label: "Target ROAS", kind: "text", placeholder: "4.0" },

    // ----- Optional screenshot -----
    { name: "bid_screenshot", label: "Screenshot of Recommendations / Conversions column (optional)", kind: "image", section: "Optional — drop a screenshot, AI reads it directly", placeholder: "Drop a Google Ads Recommendations page or Meta Ads Manager Conversions column. AI extracts the metrics directly.", span: 2, hint: "Vision-capable providers only (Claude / OpenAI / Gemini)." },
  ],
  initial: {
    platform: "Google Ads",
    campaign_type_setup: "",
    goal: "",
    current_strategy: "manual_cpc",
    current_strategy_days_active: "" as any,
    monthly_budget: "",
    conversions_per_month: "" as any,
    conversions_last_7d: "" as any,
    account_monthly_conversions: "" as any,
    cpa_trend: "unknown",
    current_cpa: "",
    target_cpa: "",
    target_roas: "",
    bid_screenshot: null,
  } as any,
  buildPrompt: (input) => buildBidStrategyPrompt(input as unknown as BidStrategyInput),
  buildTitle: (i: any) => `Bid · ${i.platform} · ${i.campaign_type_setup}`,
  expectJson: true,
  renderJson: (json) => <BidOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/bid-strategy" />;
}

const readinessTone: Record<string, "pos" | "live" | "neg" | "default"> = {
  ready: "pos",
  borderline: "live",
  not_ready: "neg",
  unknown: "default",
};

function BidOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.smart_bidding_readiness ? (
        <Section title="Smart-bidding readiness · from your numbers">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Kv k="weekly conv (need)" v={json.smart_bidding_readiness.weekly_conversions_vs_threshold ?? "—"} />
            <Kv k="trend health" v={json.smart_bidding_readiness.trend_health ?? "—"} />
            <Kv k="overall" v={json.smart_bidding_readiness.overall ?? "—"} />
          </div>
          {json.smart_bidding_readiness.gates ? (
            <ul className="mt-3 space-y-1">
              {json.smart_bidding_readiness.gates.map((g: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs border border-base-700 px-2 py-1.5">
                  <Pill text={g.status?.replace(/_/g, " ")} tone={readinessTone[g.status] ?? "default"} />
                  <span className="text-ink flex-1">{g.gate}</span>
                  <span className="text-ink-muted text-[11px]">{g.observation}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      <Section title="Recommendation">
        <div className="font-display italic text-3xl text-live leading-tight">{json?.recommended_strategy}</div>
        <p className="text-sm text-ink-muted mt-3 leading-relaxed">{json?.reason}</p>
        {json?.fallback_strategy_if_data_insufficient ? (
          <div className="mt-3 border-t border-base-700 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">fallback: </span>
            <span className="text-sm text-ink">{json.fallback_strategy_if_data_insufficient}</span>
          </div>
        ) : null}
      </Section>

      {json?.learning_phase ? (
        <Section title="Learning phase">
          <Kv k="days to hold" v={`${json.learning_phase.days_to_hold} days`} />
          <div className="mt-3 grid md:grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg mb-1">do not change</div>
              <ul className="list-disc list-inside text-sm text-ink space-y-0.5">{json.learning_phase.do_not_change?.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-pos mb-1">ok to change</div>
              <ul className="list-disc list-inside text-sm text-ink space-y-0.5">{json.learning_phase.ok_to_change?.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
            </div>
          </div>
        </Section>
      ) : null}

      {json?.bid_adjustments?.length ? (
        <Section title="Bid adjustments">
          <ul className="space-y-1.5">
            {json.bid_adjustments.map((b: any, i: number) => (
              <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5 text-xs">
                <Pill text={b.dimension} label="dim" />
                <span className="text-ink flex-1">{b.adjustment}</span>
                <span className="text-ink-muted">{b.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.budget_pacing_recommendation ? (
        <Section title="Budget pacing">
          <p className="text-sm text-ink">{json.budget_pacing_recommendation}</p>
        </Section>
      ) : null}

      {json?.early_warning_signs?.length ? (
        <Section title="Early-warning signs">
          <ul className="list-disc list-inside text-sm text-ink-muted space-y-0.5">{json.early_warning_signs.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        </Section>
      ) : null}

      {json?.graduation_path ? (
        <Section title="Graduation path">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Pill text={json.graduation_path.current} />
            <span className="text-ink-faint">→</span>
            <Pill text={json.graduation_path.next_strategy} tone="live" />
            <span className="text-xs text-ink-muted ml-2">when: {json.graduation_path.trigger_threshold}</span>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
