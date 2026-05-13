"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, ScoreBar, Kv } from "@/components/OutputBlocks";
import { buildFatiguePrompt, type FatigueInput } from "@/lib/prompts/ad-fatigue";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<FatigueInput & Record<string, unknown>> = {
  title: "Ad Fatigue Detector",
  subtitle: "Reads frequency, CTR decay, CPM creep, and audience-saturation signals from your numbers. Refresh options ranked by effort, with a hard kill threshold.",
  platform: "meta",
  campaign_type: "Fatigue",
  maxTokens: 3200,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      section: "Context",
      options: [
        { value: "Meta Feed", label: "Meta Feed" },
        { value: "Meta Stories/Reels", label: "Meta Stories/Reels" },
        { value: "TikTok In-Feed", label: "TikTok In-Feed" },
        { value: "Google Display", label: "Google Display" },
        { value: "YouTube In-Stream", label: "YouTube In-Stream" },
      ],
    },
    { name: "days_running", label: "Days the ad has been running", kind: "number", required: true, placeholder: "21" },
    { name: "ad_copy", label: "Current ad copy", kind: "textarea", required: true, rows: 4, placeholder: "Paste the ad — headline + body + CTA.", span: 2 },
    { name: "audience_size", label: "Audience size (approx)", kind: "text", placeholder: "e.g. 1.2M", hint: "Smaller audiences fatigue faster — algorithm uses this." },

    // ----- Performance signals -----
    { name: "current_frequency", label: "Current frequency", kind: "text", required: true, section: "Performance signals (real numbers, not adjectives)", placeholder: "e.g. 3.4", hint: "Meta: >3 is the warning line, >5 is severe. TikTok burns at lower freq." },
    { name: "impressions_week_1", label: "Impressions · week 1", kind: "number", placeholder: "e.g. 42000" },
    { name: "impressions_week_latest", label: "Impressions · latest week", kind: "number", placeholder: "e.g. 18000", hint: "AI computes reach decay = (latest / week1) − 1." },
    { name: "ctr_week_1", label: "CTR · week 1", kind: "text", placeholder: "e.g. 1.8%" },
    { name: "ctr_week_latest", label: "CTR · latest week", kind: "text", placeholder: "e.g. 1.1%", hint: "AI computes CTR decay %. >25% decay = moderate fatigue, >40% = severe." },
    { name: "cpm_week_1", label: "CPM · week 1", kind: "text", placeholder: "e.g. $14" },
    { name: "cpm_week_latest", label: "CPM · latest week", kind: "text", placeholder: "e.g. $19", hint: "CPM creep is a textbook saturation signal — rising CPM at falling reach = penalty cycle." },
    { name: "conversions_week_1", label: "Conversions · week 1", kind: "number", placeholder: "e.g. 18" },
    { name: "conversions_week_latest", label: "Conversions · latest week", kind: "number", placeholder: "e.g. 6" },
    { name: "negative_feedback_seen", label: "Negative feedback score (Meta)", kind: "select", options: [
      { value: "unknown", label: "Don't know / not Meta" },
      { value: "below_average", label: "Below average — hurting delivery" },
      { value: "average", label: "Average" },
      { value: "above_average", label: "Above average" },
    ] },

    // ----- Optional screenshot -----
    { name: "fatigue_screenshot", label: "Screenshot of the ad's performance trend (optional)", kind: "image", section: "Optional — drop a screenshot, AI reads it directly", placeholder: "Drop a Meta / TikTok / Google performance graph. AI reads frequency, CTR, CPM trends directly.", span: 2, hint: "Vision-capable providers only (Claude / OpenAI / Gemini)." },
  ],
  initial: {
    platform: "Meta Feed",
    days_running: 7,
    ad_copy: "",
    audience_size: "",
    current_frequency: "",
    impressions_week_1: "" as any,
    impressions_week_latest: "" as any,
    ctr_week_1: "",
    ctr_week_latest: "",
    cpm_week_1: "",
    cpm_week_latest: "",
    conversions_week_1: "" as any,
    conversions_week_latest: "" as any,
    negative_feedback_seen: "unknown",
    fatigue_screenshot: null,
  } as any,
  buildPrompt: (input) => buildFatiguePrompt(input as unknown as FatigueInput),
  buildTitle: (i: any) => `Fatigue · ${i.platform}`,
  expectJson: true,
  renderJson: (json) => <FatigueOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/ad-fatigue" />;
}

const sevTone: Record<string, "pos" | "live" | "neg" | "default"> = {
  none: "pos",
  mild: "default",
  moderate: "live",
  severe: "neg",
};

function FatigueOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.computed_decay ? (
        <Section title="Decay computed from your weekly numbers">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kv k="reach decay" v={json.computed_decay.reach_decay ?? "—"} />
            <Kv k="CTR decay" v={json.computed_decay.ctr_decay ?? "—"} />
            <Kv k="CPM creep" v={json.computed_decay.cpm_creep ?? "—"} />
            <Kv k="conv decay" v={json.computed_decay.conversion_decay ?? "—"} />
          </div>
          {json.computed_decay.notes ? (
            <p className="text-[11px] text-ink-muted mt-2">{json.computed_decay.notes}</p>
          ) : null}
        </Section>
      ) : null}

      <Section title="Severity">
        <div className="flex items-center gap-3 flex-wrap">
          <Pill text={json?.fatigue_severity_overall ?? "—"} tone={sevTone[json?.fatigue_severity_overall] ?? "default"} />
          <span className="text-xs text-ink-muted">{json?.severity_reason}</span>
        </div>
      </Section>

      {json?.signals ? (
        <Section title="Signals">
          <ul className="space-y-2">
            {Object.entries(json.signals).map(([k, v]: any) => (
              <li key={k} className="flex items-start gap-3 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-ink-faint w-32 mt-1">{k.replace(/_/g, " ")}</span>
                <ScoreBar score={v.score} />
                <span className="flex-1 text-xs text-ink-muted">{v.reading}</span>
                {v.threshold_breached ? <Pill text="breached" tone="neg" /> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.refresh_options ? (
        <Section title="Refresh options">
          {(["low_effort", "medium_effort", "high_effort"] as const).map((tier) => {
            const items = json.refresh_options?.[tier] ?? [];
            if (!items.length) return null;
            return (
              <div key={tier} className="border-t border-base-700 pt-3 first:border-t-0 first:pt-0 mt-3 first:mt-0">
                <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2">{tier.replace(/_/g, " ")}</div>
                <ul className="space-y-1.5">
                  {items.map((it: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5 text-xs">
                      <span className="font-medium text-ink w-32">{it.action}</span>
                      <span className="flex-1 text-ink-muted">{it.specific_change}</span>
                      <span className="text-pos font-mono uppercase tracking-ui-wide text-[10px]">{it.expected_lift}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Section>
      ) : null}

      {json?.new_angles_to_test?.length ? (
        <Section title="New angles to test">
          <ul className="space-y-1.5">
            {json.new_angles_to_test.map((a: any, i: number) => (
              <li key={i} className="flex items-start gap-2 border border-base-700 px-2 py-1.5 text-xs">
                <Pill text={a.angle_label} tone="live" />
                <div className="flex-1">
                  <div className="text-ink font-medium">{a.angle}</div>
                  <div className="text-ink-muted">{a.rationale}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.kill_threshold ? (
        <Section title="Kill threshold">
          <p className="text-sm text-neg font-mono">{json.kill_threshold}</p>
        </Section>
      ) : null}
    </div>
  );
}
