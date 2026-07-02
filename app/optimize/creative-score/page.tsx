"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill, ScoreBar } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildCreativeScorePrompt, type CreativeScoreInput } from "@/lib/prompts/creative-score";
import { CreativeScoreSchema } from "@/lib/schemas/creative-score";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<CreativeScoreInput & Record<string, unknown>> = {
  title: "Creative Score",
  subtitle: "Paste any ad copy. Get a brutally honest 5-lever score + 3 named fixes + predicted CTR band + scale/iterate/rewrite/kill verdict.",
  platform: "meta",
  campaign_type: "Creative Score",
  maxTokens: 2500,
  temperature: 0.4,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      options: [
        { value: "Google Search", label: "Google Search" },
        { value: "Google Display", label: "Google Display" },
        { value: "Meta Feed", label: "Meta Feed" },
        { value: "Meta Reels", label: "Meta Reels" },
        { value: "Meta Stories", label: "Meta Stories" },
        { value: "TikTok In-Feed", label: "TikTok In-Feed" },
        { value: "YouTube In-Stream", label: "YouTube In-Stream" },
        { value: "LinkedIn Sponsored", label: "LinkedIn Sponsored" },
        { value: "Twitter/X", label: "Twitter / X" },
      ],
    },
    { name: "audience_context", label: "Audience (optional)", kind: "text", placeholder: "e.g. SMB owners 25-44" },
    { name: "ad_copy", label: "Ad copy to score", kind: "textarea", required: true, rows: 8, placeholder: "Paste headline + primary text + CTA…", span: 2 },
  ],
  initial: { platform: "Meta Feed", audience_context: "", ad_copy: "" } as any,
  buildPrompt: (input) => buildCreativeScorePrompt(input as unknown as CreativeScoreInput),
  buildTitle: (i: any) => `Score · ${i.platform}`,
  expectJson: true,
  schema: CreativeScoreSchema,
  renderJson: (json) => <ScoreOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="optimize/creative-score" />;
}

const tierTone: Record<string, "pos" | "live" | "neg" | "default"> = {
  scale: "pos",
  iterate: "live",
  rewrite: "neg",
  kill: "neg",
};

function ScoreOutput({ json }: { json: any }) {
  // Schema now allows string scores ("7.5"); coerce so .toFixed / comparisons hold.
  const overall = Number(json?.overall_score) || 0;
  // tier may arrive with any casing ("Iterate"); lowercase for tone lookup + Pill.
  const tier = typeof json?.tier === "string" ? json.tier.toLowerCase() : "";
  const overallColor = overall >= 8.5 ? "text-pos" : overall >= 7 ? "text-live" : overall >= 5.5 ? "text-neg" : "text-neg";
  return (
    <div className="space-y-4 stagger">
      <Section title="Verdict">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Overall</div>
            <div className={`font-display italic text-6xl tabular ${overallColor} leading-none`}>{overall.toFixed(1)}<span className="text-ink-subtle text-3xl">/10</span></div>
          </div>
          <div>
            <Pill text={json?.tier ?? "—"} tone={tierTone[tier] ?? "default"} />
            {json?.predicted_ctr_band ? (
              <div className="text-[11px] text-ink-muted mt-2 font-mono">predicted CTR: {json.predicted_ctr_band}</div>
            ) : null}
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm text-ink leading-relaxed italic">"{json?.honest_verdict}"</p>
          </div>
        </div>
      </Section>

      {json?.scores ? (
        <Section title="Lever scores">
          <ul className="space-y-2">
            {Object.entries(json.scores).map(([k, v]: any) => (
              <li key={k} className="flex items-start gap-3 border border-base-700 px-3 py-2.5">
                <span className="font-medium text-[13px] text-ink w-40 mt-1 capitalize">{k.replace(/_/g, " ")}</span>
                <ScoreBar score={Math.round(Number(v.score) || 0)} />
                <span className="flex-1 text-[12px] text-ink-muted leading-relaxed">{v.reason ?? "—"}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.top_3_fixes?.length ? (
        <Section title="Top 3 fixes" actions={<CopyButton text={json.top_3_fixes.map((f: any, i: number) => `${i + 1}. ${f.lever}: "${f.exact_phrase_to_change}" → "${f.replacement}"`).join("\n")} />}>
          <ol className="space-y-2">
            {json.top_3_fixes.map((f: any, i: number) => (
              <li key={i} className="border border-base-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-display italic text-2xl text-live tabular leading-none">{i + 1}</span>
                  <Pill text={f.lever?.replace(/_/g, " ")} tone="live" />
                  <span className="text-[11px] text-pos uppercase tracking-wider ml-auto">{f.expected_lift}</span>
                </div>
                <div className="text-xs space-y-1 ml-9">
                  <div><span className="text-ink-faint">Change:</span> <span className="line-through text-ink-subtle">{f.exact_phrase_to_change}</span></div>
                  <div><span className="text-pos">To:</span> <span className="text-ink">{f.replacement}</span></div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
