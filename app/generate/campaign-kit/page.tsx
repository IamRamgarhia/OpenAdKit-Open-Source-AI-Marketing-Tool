"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildCampaignKitPrompt, type CampaignKitInput } from "@/lib/prompts/campaign-kit";
import { CampaignKitSchema } from "@/lib/schemas/campaign-kit";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<CampaignKitInput & Record<string, unknown>> = {
  title: "Full Campaign Kit",
  subtitle: "One brief → message-matched copy + budget split + KPIs across every major platform.",
  platform: "google",
  campaign_type: "Campaign Kit",
  maxTokens: 5500,
  temperature: 0.85,
  fields: [
    { name: "campaign_name", label: "Campaign name", kind: "text", required: true, placeholder: "Q3 trial blitz", span: 2 },
    { name: "product", label: "Product / service", kind: "text", required: true, placeholder: "e.g. AI design tool" },
    { name: "primary_offer", label: "Primary offer", kind: "text", required: true, placeholder: "14-day free trial" },
    { name: "audience", label: "Audience", kind: "textarea", required: true, rows: 2, placeholder: "Who exactly?", span: 2 },
    { name: "goal", label: "Goal", kind: "text", required: true, placeholder: "1,000 trial signups" },
    { name: "budget_monthly", label: "Budget / month", kind: "text", required: true, placeholder: "$5,000" },
  ],
  initial: { campaign_name: "", product: "", primary_offer: "", audience: "", goal: "", budget_monthly: "" } as any,
  buildPrompt: (input, brain) => buildCampaignKitPrompt(input as unknown as CampaignKitInput, brain),
  buildTitle: (i: any) => `Kit · ${i.campaign_name}`,
  expectJson: true,
  schema: CampaignKitSchema,
  renderJson: (json) => <KitOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="generate/campaign-kit" />;
}

function KitOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      <Section title="Master hook">
        <div className="font-display italic text-2xl text-live leading-tight">{json?.master_hook}</div>
        <p className="text-sm text-ink-muted mt-3">{json?.master_usp}</p>
      </Section>

      <Section title="Google RSA" actions={<CopyButton text={(json?.google_rsa?.headlines || []).join("\n") + "\n\n" + (json?.google_rsa?.descriptions || []).join("\n")} />}>
        <Block label="headlines" items={json?.google_rsa?.headlines} />
        <Block label="descriptions" items={json?.google_rsa?.descriptions} />
      </Section>

      <Section title="Meta Feed" actions={<CopyButton text={JSON.stringify(json?.meta_feed, null, 2)} />}>
        <Block label="primary text" items={json?.meta_feed?.primary_text} />
        <Block label="headlines" items={json?.meta_feed?.headlines} />
        <Pill label="cta" text={json?.meta_feed?.cta} tone="live" />
      </Section>

      {json?.tiktok?.hooks?.length || json?.tiktok?.ugc_brief ? (
        <Section title="TikTok">
          <Block label="hooks" items={json?.tiktok?.hooks} />
          {json?.tiktok?.ugc_brief ? (
            <div className="mt-3 border-t border-base-700 pt-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">ugc brief</div>
              <p className="text-sm text-ink whitespace-pre-line">{json.tiktok.ugc_brief}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {json?.youtube_in_stream && ["hook", "value", "cta"].some((k) => json.youtube_in_stream[k]?.vo) ? (
        <Section title="YouTube In-Stream (15s)">
          {["hook", "value", "cta"].map((k) => {
            const v = json.youtube_in_stream[k];
            return v ? (
              <div key={k} className="flex gap-2 text-xs mb-1.5">
                <span className="font-mono text-ink-faint w-12">{v.t}</span>
                <span className="text-[9px] font-mono uppercase tracking-ui-mega text-live w-12 mt-0.5">{k}</span>
                <div className="flex-1 text-ink">{v.vo}<div className="text-ink-subtle text-[11px]">visual: {v.visual}</div></div>
              </div>
            ) : null;
          })}
        </Section>
      ) : null}

      {json?.linkedin?.intro || json?.linkedin?.headline ? (
        <Section title="LinkedIn">
          <p className="text-sm text-ink whitespace-pre-line">{json.linkedin.intro}</p>
          <p className="text-sm font-medium text-ink mt-2">{json.linkedin.headline}</p>
        </Section>
      ) : null}

      {json?.twitter?.filter?.((t: unknown) => typeof t === "string" && t.trim()).length ? (
        <Section title="Twitter / X">
          <Block label="tweets" items={json.twitter} />
        </Section>
      ) : null}

      {json?.email_subjects?.length ? (
        <Section title="Email subject lines">
          <Block label="" items={json.email_subjects} />
        </Section>
      ) : null}

      {json?.landing_hero ? (
        <Section title="Landing hero">
          <p className="font-display italic text-xl text-ink leading-tight">{json.landing_hero.h1}</p>
          <p className="text-sm text-ink-muted mt-1">{json.landing_hero.subhead}</p>
          <ul className="list-disc list-inside text-sm text-ink mt-3 space-y-0.5">
            {json.landing_hero.bullets?.map((b: string, i: number) => <li key={i}>{b}</li>)}
          </ul>
          <Pill text={json.landing_hero.cta_button} tone="live" label="cta" />
        </Section>
      ) : null}

      {json?.budget_split?.length ? (
        <Section title="Budget split">
          <ul className="space-y-1.5 text-sm">
            {json.budget_split.map((b: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-live w-12 tabular">{b.pct}%</span>
                <span className="w-24 text-ink font-medium">{b.platform}</span>
                <span className="flex-1 text-xs text-ink-muted">{b.rationale}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.kpi_targets?.length ? (
        <Section title="KPI targets">
          <ul className="grid md:grid-cols-3 gap-2 text-xs">
            {json.kpi_targets.map((k: any, i: number) => (
              <li key={i} className="border border-base-700 p-2">
                <div className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint">{k.metric}</div>
                <div className="font-mono text-live text-lg tabular">{k.target}</div>
                <div className="text-[11px] text-ink-muted mt-1">{k.by_when}</div>
                {k.basis ? <div className="text-[10px] text-ink-faint mt-1">basis: {k.basis}</div> : null}

              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function Block({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className={label ? "border-t border-base-700 pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0" : ""}>
      {label ? <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">{label}</div> : null}
      <ul className="space-y-0.5 text-sm text-ink">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
