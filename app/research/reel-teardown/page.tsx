"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildReelTeardownPrompt, type ReelTeardownInput } from "@/lib/prompts/reel-teardown";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<ReelTeardownInput & Record<string, unknown>> = {
  title: "Competitor Reel Teardown",
  subtitle: "Paste a competitor's reel captions → AI maps their hook formulas, content pillars, CTA habits, then writes 5 'beat-their-reel' scripts anchored to your USP.",
  platform: "tiktok",
  campaign_type: "Reel Teardown",
  maxTokens: 6000,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      section: "Competitor",
      options: [
        { value: "instagram_reels", label: "Instagram Reels" },
        { value: "tiktok", label: "TikTok" },
        { value: "youtube_shorts", label: "YouTube Shorts" },
        { value: "facebook_reels", label: "Facebook Reels" },
      ],
    },
    { name: "competitor_handle_or_url", label: "Competitor handle / URL", kind: "text", required: true, placeholder: "@competitor or https://www.tiktok.com/@competitor", span: 2 },
    { name: "competitor_pasted_content", label: "Recent reels — captions + hooks", kind: "textarea", required: true, rows: 10, placeholder: "Paste 5-15 of their recent reels. One reel per block. Separator: --- on its own line.\n\nHook: \"POV: you're a freelancer at tax season\"\nCaption: Three things nobody tells you about Q4 taxes…\n---\nHook: \"Stop using TurboTax. Here's why.\"\nCaption: …", span: 2 },
    { name: "competitor_top_performers", label: "Top-performing reels (optional)", kind: "textarea", rows: 4, placeholder: "Paste their best reels with view / like counts when visible. AI weighs these heavier.\n\nReel 1 — 1.2M views — Hook: \"…\"\nReel 2 — 480K views — …", span: 2 },

    { name: "goal_for_us", label: "Our goal for the beat-reels", kind: "text", required: true, section: "Our side", placeholder: "e.g. drive trial signups · build audience awareness · launch new product", span: 2 },
  ],
  initial: {
    platform: "instagram_reels",
    competitor_handle_or_url: "",
    competitor_pasted_content: "",
    competitor_top_performers: "",
    goal_for_us: "",
  } as any,
  buildPrompt: (input) => buildReelTeardownPrompt(input as unknown as ReelTeardownInput),
  buildTitle: (i: any) => `Teardown · ${i.competitor_handle_or_url?.slice(0, 30)}`,
  expectJson: true,
  renderJson: (json) => <TeardownOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="research/reel-teardown" />;
}

function TeardownOutput({ json }: { json: any }) {
  const fm = json?.format_mix_percentages ?? json?.pattern_read?.format_mix_percentages;
  return (
    <div className="space-y-4 stagger">
      {json?.pattern_read ? (
        <Section title="Pattern read">
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1.5">hook formulas</div>
              <ul className="space-y-1">
                {(json.pattern_read.hook_formulas_used ?? []).map((h: any, i: number) => (
                  <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1">
                    <Pill text={h.formula?.replace(/_/g, " ")} />
                    <span className="text-ink-muted ml-auto">×{h.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1.5">content pillars</div>
              <ul className="space-y-1">
                {(json.pattern_read.content_pillars_used ?? []).map((p: string, i: number) => (
                  <li key={i} className="border border-base-700 px-2 py-1 text-ink">{p}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 grid md:grid-cols-3 gap-2 text-xs">
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">length pattern</div>
              <div className="text-ink mt-1">{json.pattern_read.length_pattern}</div>
            </div>
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">emotional register</div>
              <div className="text-ink mt-1">{json.pattern_read.emotional_register}</div>
            </div>
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">cta mechanics</div>
              <div className="text-ink mt-1">{(json.pattern_read.cta_mechanics ?? []).join(" · ")}</div>
            </div>
          </div>
          {fm ? (
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              {Object.entries(fm).map(([k, v]: any) => (
                <div key={k} className="border border-base-700 px-2 py-1.5 text-center">
                  <div className="font-display italic text-lg text-live tabular">{v}%</div>
                  <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint">{k.replace(/_/g, " ")}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {json?.weakness_map ? (
        <Section title="Weakness map · where they're exposed">
          <ul className="space-y-1.5 text-xs">
            <li className="flex gap-2"><span className="text-ink-faint w-44 font-mono uppercase tracking-ui-wide text-[10px]">overused hook</span><span className="text-ink flex-1">{json.weakness_map.overused_hook_formula}</span></li>
            <li className="flex gap-2"><span className="text-ink-faint w-44 font-mono uppercase tracking-ui-wide text-[10px]">missing pillars</span><span className="text-pos flex-1">{json.weakness_map.missing_pillars?.join(" · ")}</span></li>
            <li className="flex gap-2"><span className="text-ink-faint w-44 font-mono uppercase tracking-ui-wide text-[10px]">skipped cta</span><span className="text-ink flex-1">{json.weakness_map.skipped_cta_mechanic}</span></li>
            <li className="flex gap-2"><span className="text-ink-faint w-44 font-mono uppercase tracking-ui-wide text-[10px]">missing emotion</span><span className="text-ink flex-1">{json.weakness_map.missing_emotion}</span></li>
            {json.weakness_map.weak_proof_examples?.length ? (
              <li className="flex gap-2"><span className="text-neg w-44 font-mono uppercase tracking-ui-wide text-[10px]">weak proof flagged</span><span className="text-neg flex-1">{json.weakness_map.weak_proof_examples.join(" · ")}</span></li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      {json?.positioning_attack ? (
        <Section title="Positioning attack plan">
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">angle to own</div>
              <div className="text-ink mt-1">{json.positioning_attack.angle_to_own}</div>
            </div>
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">hook formula</div>
              <div className="text-ink mt-1">{json.positioning_attack.hook_formula_to_use}</div>
            </div>
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">proof flip</div>
              <div className="text-ink mt-1">{json.positioning_attack.proof_type_to_flip_to}</div>
            </div>
            <div className="border border-base-700 p-2">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">emotion to own</div>
              <div className="text-ink mt-1">{json.positioning_attack.emotional_register_to_occupy}</div>
            </div>
          </div>
        </Section>
      ) : null}

      {json?.beat_their_reel?.length ? (
        <Section title={`Beat-their-reel scripts · ${json.beat_their_reel.length}`}>
          <ul className="space-y-3">
            {json.beat_their_reel.map((b: any, i: number) => (
              <li key={i} className="border border-base-700 bg-base-900/30 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Pill text={`#${i + 1}`} />
                  <Pill text={b.our_angle} tone="live" label="angle" />
                  <CopyButton text={`${b.hook}\n\n${b.script}\n\nCTA: ${b.cta}\n\nCaption: ${b.caption}`} />
                </div>
                <div className="text-[11px] text-ink-muted italic mb-2">
                  beats: <span className="text-ink">"{b.target_competitor_reel}"</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">hook</div>
                    <p className="font-display italic text-lg text-live leading-tight">{b.hook}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">visual</div>
                    <p className="text-xs text-ink-muted">{b.visual_brief}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">script</div>
                    <p className="text-sm text-ink whitespace-pre-line leading-relaxed">{b.script}</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-base-700">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">CTA</div>
                      <p className="text-sm text-pos">{b.cta}</p>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">hashtags</div>
                      <p className="text-xs text-ink-muted">{(b.hashtags ?? []).map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">caption</div>
                    <p className="text-sm text-ink whitespace-pre-line">{b.caption}</p>
                  </div>
                  <p className="text-[11px] text-ink-muted pt-2 border-t border-base-700">{b.why_this_beats_them}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
