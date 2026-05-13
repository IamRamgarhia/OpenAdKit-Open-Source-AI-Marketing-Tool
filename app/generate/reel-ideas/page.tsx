"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildReelIdeasPrompt, type ReelIdeasInput } from "@/lib/prompts/reel-ideas";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<ReelIdeasInput & Record<string, unknown>> = {
  title: "Reel Ideas — Hook-First Generator",
  subtitle: "10 proven hook formulas rotated across the batch · platform-native rules baked in · paste a competitor URL or captions and AI finds the blue-ocean angles they're missing.",
  platform: "tiktok",
  campaign_type: "Reel Ideas",
  maxTokens: 7000,
  temperature: 0.85,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      section: "Where it ships",
      options: [
        { value: "instagram_reels", label: "Instagram Reels" },
        { value: "tiktok", label: "TikTok" },
        { value: "youtube_shorts", label: "YouTube Shorts" },
        { value: "facebook_reels", label: "Facebook Reels" },
      ],
    },
    { name: "reel_count", label: "How many ideas", kind: "number", placeholder: "12" },
    { name: "duration_seconds", label: "Target length (sec)", kind: "number", placeholder: "30" },
    {
      name: "goal",
      label: "Primary goal",
      kind: "select",
      section: "What it's for",
      options: [
        { value: "awareness", label: "Awareness — get on the FYP" },
        { value: "education", label: "Education — teach a thing" },
        { value: "sales", label: "Sales — drive trial / purchase" },
        { value: "community", label: "Community — build the inside-joke" },
        { value: "launch", label: "Launch — product/feature reveal" },
      ],
    },
    { name: "pillars", label: "Content pillars to rotate through", kind: "textarea", rows: 2, placeholder: "Leave blank to use the brand brain's pillars. Otherwise one per line:\nFounder stories\nProduct education\nCustomer wins", span: 2, hint: "Auto-fills from the active client's brand brain when blank." },
    { name: "hook_seed", label: "Hook seed / theme (optional)", kind: "text", placeholder: "e.g. 'the hidden cost of free tools'", span: 2, hint: "Anchor the batch around a single big idea. Blank = let the AI range." },

    // ----- Competitor intel -----
    { name: "competitor_profile_url", label: "Competitor profile URL", kind: "text", section: "Competitor intel (optional — anchor to what's working in your niche)", placeholder: "https://www.tiktok.com/@competitor or https://www.instagram.com/competitor", span: 2, hint: "URL ingest happens in a follow-up step — for now, paste captions below." },
    { name: "competitor_pasted_content", label: "Competitor recent posts / captions", kind: "textarea", rows: 5, placeholder: "Paste captions from 5-10 of their best-performing reels. Separate with --- on its own line.", span: 2 },

    // ----- Own context -----
    { name: "own_recent_reels", label: "Your own recent reels (avoid duplicating)", kind: "textarea", section: "Avoid duplicating yourself", rows: 4, placeholder: "Paste captions of 5-10 reels you already posted. AI won't repeat these.", span: 2 },

    { name: "tone_override", label: "Tone override (optional)", kind: "text", placeholder: "Override the brand brain tone just for this batch." },
    { name: "must_avoid", label: "Must avoid", kind: "text", placeholder: "trends, controversy, specific claims, etc." },
  ],
  initial: {
    platform: "instagram_reels",
    reel_count: 12,
    duration_seconds: 30,
    goal: "awareness",
    pillars: "",
    hook_seed: "",
    competitor_profile_url: "",
    competitor_pasted_content: "",
    own_recent_reels: "",
    tone_override: "",
    must_avoid: "",
  } as any,
  buildPrompt: (input) => buildReelIdeasPrompt(input as unknown as ReelIdeasInput),
  buildTitle: (i: any) => `Reels · ${i.platform} · ${i.reel_count} ideas`,
  expectJson: true,
  renderJson: (json) => <ReelOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="generate/reel-ideas" />;
}

const hookFormulaTone: Record<string, "live" | "info" | "pos" | "default"> = {
  POV: "live",
  CONTRADICTION: "info",
  LISTICLE_TEASE: "default",
  NUMBER_PROMISE: "pos",
  QUESTION_PATTERN_INTERRUPT: "live",
  BEFORE_AFTER: "pos",
  STORY: "default",
  DEMO: "info",
  CONTROVERSY: "live",
  INSIDER: "info",
};

const shootTone: Record<string, "pos" | "live" | "default"> = {
  easy_phone_only: "pos",
  needs_b_roll: "live",
  needs_screen_recording: "default",
  needs_guest: "default",
};

function ReelOutput({ json }: { json: any }) {
  const ideas = json?.ideas ?? [];
  return (
    <div className="space-y-4 stagger">
      {json?.competitor_pattern_summary ? (
        <Section title="Competitor pattern read">
          <p className="text-sm text-ink leading-relaxed">{json.competitor_pattern_summary}</p>
          {json.blue_ocean_angles?.length ? (
            <ul className="mt-3 space-y-1">
              {json.blue_ocean_angles.map((a: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm border border-base-700 px-2 py-1.5">
                  <span className="text-pos">↑</span>
                  <span className="text-ink">{a}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      <Section title={`Ideas · ${ideas.length}`}>
        <ul className="space-y-3">
          {ideas.map((r: any) => (
            <li key={r.id} className="border border-base-700 bg-base-900/30 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-mono text-[10px] tabular text-ink-faint">#{r.id}</span>
                <Pill text={r.hook_formula?.replace(/_/g, " ")} tone={hookFormulaTone[r.hook_formula] ?? "default"} label="hook" />
                <Pill text={r.content_pillar} />
                <Pill text={r.shoot_difficulty?.replace(/_/g, " ")} tone={shootTone[r.shoot_difficulty] ?? "default"} label="shoot" />
                <Pill text={`${r.duration_seconds}s`} />
                <span className="ml-auto text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle">{r.estimated_reach_driver}</span>
                <CopyButton text={`${r.hook}\n\n${r.script}\n\nCTA: ${r.cta}\n\nCaption: ${r.caption}`} />
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">hook (first 3 sec)</div>
                  <p className="font-display italic text-lg text-live leading-tight">{r.hook}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">visual brief</div>
                  <p className="text-xs text-ink-muted">{r.visual_brief}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">script</div>
                  <p className="text-sm text-ink whitespace-pre-line leading-relaxed">{r.script}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-base-700">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">CTA</div>
                    <p className="text-sm text-pos">{r.cta}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">when to post</div>
                    <p className="text-sm text-ink">{r.when_to_post?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">caption</div>
                  <p className="text-sm text-ink whitespace-pre-line">{r.caption}</p>
                </div>
                {r.hashtags_extra ? (
                  <div className="pt-2 border-t border-base-700">
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">hashtag stack</div>
                    <div className="flex flex-wrap gap-1">
                      {r.hashtags_extra.tier_a?.map((h: string, i: number) => (
                        <span key={"a" + i} className="border border-base-700 bg-base-900/40 px-1.5 py-0.5 text-[10px] text-live">#{h.replace(/^#/, "")}</span>
                      ))}
                      {r.hashtags_extra.tier_b?.map((h: string, i: number) => (
                        <span key={"b" + i} className="border border-base-700 bg-base-900/40 px-1.5 py-0.5 text-[10px] text-info">#{h.replace(/^#/, "")}</span>
                      ))}
                      {r.hashtags_extra.tier_c?.map((h: string, i: number) => (
                        <span key={"c" + i} className="border border-base-700 bg-base-900/40 px-1.5 py-0.5 text-[10px] text-ink-muted">#{h.replace(/^#/, "")}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
