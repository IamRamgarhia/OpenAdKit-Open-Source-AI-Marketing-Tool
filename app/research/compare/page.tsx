"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { objEntries, obj, txt, num } from "@/lib/safe-json";
import { Section, Pill, ScoreBar } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildCompareAdsPrompt, type CompareAdsInput } from "@/lib/prompts/compare-ads";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<CompareAdsInput & Record<string, unknown>> = {
  title: "Compare two ads",
  subtitle: "Head-to-head AI teardown of two creatives. 5-lever scoring. Winner. Hybrid proposal that takes the best of both.",
  platform: "meta",
  campaign_type: "Compare",
  maxTokens: 3000,
  temperature: 0.4,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      options: [
        { value: "Google Search", label: "Google Search" },
        { value: "Meta Feed", label: "Meta Feed" },
        { value: "Meta Reels", label: "Meta Reels" },
        { value: "TikTok In-Feed", label: "TikTok In-Feed" },
        { value: "LinkedIn", label: "LinkedIn" },
      ],
    },
    { name: "goal", label: "Goal", kind: "text", required: true, placeholder: "trial signups / sales / leads" },
    { name: "audience", label: "Audience", kind: "text", required: true, placeholder: "Who is this for?", span: 2 },
    { name: "ad_a", label: "Ad A", kind: "textarea", required: true, rows: 6, placeholder: "Paste the full first ad — headline, primary text, CTA…", span: 2 },
    { name: "ad_b", label: "Ad B", kind: "textarea", required: true, rows: 6, placeholder: "Paste the full second ad…", span: 2 },
  ],
  initial: { platform: "Meta Feed", goal: "", audience: "", ad_a: "", ad_b: "" } as any,
  buildPrompt: (input) => buildCompareAdsPrompt(input as unknown as CompareAdsInput),
  buildTitle: (i: any) => `Compare · ${i.platform}`,
  expectJson: true,
  renderJson: (json) => <CompareOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="research/compare" />;
}

const winnerTone: Record<string, "pos" | "live" | "default"> = { A: "pos", B: "live", tie: "default" };

function CompareOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      <Section title="Winner">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="font-display italic text-6xl text-live leading-none">
            {json?.winner === "tie" ? "Tie" : txt(json?.winner) ? `Ad ${txt(json?.winner)}` : "—"}
          </div>
          <p className="text-sm text-ink-muted leading-relaxed max-w-2xl flex-1 min-w-[200px]">{json?.winner_reason}</p>
        </div>
      </Section>

      {/* No schema on this tool: a lever can come back null or as a string,
          and `v.winner` on null used to crash the whole output. */}
      {objEntries(json?.scores).length ? (
        <Section title="Lever-by-lever">
          <ul className="space-y-2">
            {objEntries(json?.scores).map(([k, v]) => (
              <li key={k} className="border border-base-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-medium text-ink capitalize w-40">{k.replace(/_/g, " ")}</span>
                  <Pill text={`Winner: ${txt(v.winner) || "—"}`} tone={winnerTone[txt(v.winner)] ?? "default"} />
                </div>
                <div className="grid md:grid-cols-2 gap-3 mb-2">
                  <div className="flex items-center gap-2"><span className="text-[11px] text-pos font-mono w-6">A</span><ScoreBar score={Math.round(num(v.a))} /></div>
                  <div className="flex items-center gap-2"><span className="text-[11px] text-live font-mono w-6">B</span><ScoreBar score={Math.round(num(v.b))} /></div>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{txt(v.reason)}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        {(["ad_a", "ad_b"] as const).map((k, idx) => {
          const data = obj(json?.[k]);
          if (!Object.keys(data).length) return null;
          return (
            <Section key={k} title={`Ad ${idx === 0 ? "A" : "B"} · profile`}>
              {data.biggest_strength && typeof data.biggest_strength === "object" ? (
                <div className="border border-pos/40 bg-pos/5 p-3 mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-pos mb-1">strength</div>
                  <p className="text-sm text-ink italic">"{data.biggest_strength.quote}"</p>
                  <p className="text-[11px] text-ink-muted mt-1">{data.biggest_strength.why}</p>
                </div>
              ) : null}
              {data.biggest_weakness && typeof data.biggest_weakness === "object" ? (
                <div className="border border-neg/40 bg-neg/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-neg mb-1">weakness</div>
                  <p className="text-sm text-ink italic">"{data.biggest_weakness.quote}"</p>
                  <p className="text-[11px] text-ink-muted mt-1">{data.biggest_weakness.why}</p>
                </div>
              ) : null}
            </Section>
          );
        })}
      </div>

      {Object.keys(obj(json?.hybrid_proposal)).length ? (
        <Section title="Hybrid — take the best of both" actions={<CopyButton text={[txt(json.hybrid_proposal.headline_or_hook), txt(json.hybrid_proposal.body), txt(json.hybrid_proposal.cta)].join("\n\n")} />}>
          <div className="font-display italic text-2xl text-live leading-tight">{txt(json.hybrid_proposal.headline_or_hook)}</div>
          <p className="text-sm text-ink mt-3 whitespace-pre-line">{txt(json.hybrid_proposal.body)}</p>
          {txt(json.hybrid_proposal.cta) ? <Pill text={txt(json.hybrid_proposal.cta)} tone="live" label="cta" /> : null}
          <p className="text-[11px] text-ink-muted mt-3 border-t border-base-700 pt-2 italic">{txt(json.hybrid_proposal.explanation)}</p>
        </Section>
      ) : null}
    </div>
  );
}
