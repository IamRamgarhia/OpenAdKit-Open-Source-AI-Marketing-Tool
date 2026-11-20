"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section } from "@/components/OutputBlocks";
import { CharBadge } from "@/components/CharBadge";
import { CopyButton } from "@/components/CopyButton";
import { buildTwitterPrompt, TWITTER_LIMITS, type TwitterInput } from "@/lib/prompts/twitter-ads";
import type { GeneratorConfig } from "@/lib/generator-config";
import { TwitterSchema } from "@/lib/schemas/generators";

const config: GeneratorConfig<TwitterInput & Record<string, unknown>> = {
  title: "Twitter / X",
  subtitle: "280 chars per tweet. Char-validated. Single-tweet variants or full thread.",
  platform: "twitter",
  campaign_type: "Promoted",
  maxTokens: 2500,
  fields: [
    {
      name: "format",
      label: "Format",
      kind: "select",
      options: [
        { value: "promoted_tweet", label: "Promoted Tweet (5 variants)" },
        { value: "promoted_video", label: "Promoted Video (5 variants)" },
        { value: "website_card", label: "Website Card (5 variants)" },
        { value: "follower_ad", label: "Follower Ad (5 variants)" },
        { value: "thread", label: "6-tweet thread" },
      ],
    },
    { name: "product", label: "Product", kind: "text", required: true, placeholder: "e.g. focus app for students", span: 2 },
    { name: "objective", label: "Objective", kind: "text", required: true, placeholder: "free trial signups" },
    { name: "voice", label: "Voice", kind: "text", placeholder: "direct, witty, scroll-stopping" },
    { name: "landing_url", label: "Landing URL", kind: "text", placeholder: "https://example.com/offer", hint: "Optional. Links count as 23 characters on X (t.co)." },
    { name: "audience_geo", label: "Audience country / region", kind: "text", placeholder: "e.g. India, US East Coast", hint: "Optional. Needed for a posting-time window." },
  ],
  initial: { format: "promoted_tweet", product: "", objective: "", voice: "", landing_url: "", audience_geo: "" } as any,
  buildPrompt: (input) => buildTwitterPrompt(input as unknown as TwitterInput),
  buildTitle: (i: any) => `Twitter · ${i.format} · ${i.product}`,
  expectJson: true,
  schema: TwitterSchema,
  renderJson: (json) => <TwitterOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="generate/twitter" />;
}

function TwitterOutput({ json }: { json: any }) {
  if (json?.thread) {
    return (
      <div className="space-y-4 stagger">
        <Section title="Thread" actions={<CopyButton text={json.thread.map((t: any) => `${t.position}/ ${t.text}`).join("\n\n")} label="copy thread" />}>
          <ol className="space-y-2">
            {json.thread.map((t: any, i: number) => (
              <li key={i} className="flex gap-2 border border-base-700 bg-base-900/30 px-3 py-2">
                <span className="font-mono text-[10px] text-ink-faint w-5 tabular mt-1">{t.position}/</span>
                <span className="text-[9px] font-mono uppercase tracking-ui-mega text-live w-14 mt-1.5">{t.role}</span>
                <div className="flex-1">
                  <CharBadge count={t.chars || t.text?.length || 0} max={TWITTER_LIMITS.tweet} />
                  <p className="text-sm text-ink mt-1 whitespace-pre-line">{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    );
  }
  if (json?.tweets) {
    return (
      <div className="space-y-4 stagger">
        <Section title={`Variants · ${json.tweets.length}`} actions={<CopyButton text={json.tweets.map((t: any) => t.trimmed_alt || t.text).join("\n\n---\n\n")} label="copy all" />}>
          <ul className="space-y-2">
            {json.tweets.map((t: any, i: number) => (
              <li key={i} className="flex gap-2 border border-base-700 bg-base-900/30 px-3 py-2">
                <span className="font-mono text-[10px] text-ink-faint w-5 tabular mt-1">{t.label}</span>
                <span className="text-[9px] font-mono uppercase tracking-ui-mega text-live w-16 mt-1.5">{t.angle}</span>
                <div className="flex-1">
                  <CharBadge count={t.chars || t.text?.length || 0} max={TWITTER_LIMITS.tweet} />
                  <p className={`text-sm mt-1 whitespace-pre-line ${t.status === "over" ? "line-through text-ink-subtle" : "text-ink"}`}>
                    {t.text}
                  </p>
                  {t.trimmed_alt ? <p className="text-xs text-pos mt-1">→ {t.trimmed_alt}</p> : null}
                </div>
                <CopyButton text={t.trimmed_alt || t.text} label="" />
              </li>
            ))}
          </ul>
        </Section>
        {json.website_card_title ? (
          <Section title="Website card headline" actions={<CopyButton text={json.website_card_title} label="" />}>
            <CharBadge count={String(json.website_card_title).length} max={TWITTER_LIMITS.website_card_title} />
            <p className="text-sm text-ink mt-1">{json.website_card_title}</p>
          </Section>
        ) : null}
        {json.best_time_window_utc ? (
          <p className="text-[11px] text-ink-muted font-mono uppercase tracking-ui-wide">best window utc: {json.best_time_window_utc}</p>
        ) : null}
      </div>
    );
  }
  return null;
}
