"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { buildHashtagPrompt, type HashtagInput } from "@/lib/prompts/hashtags";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<HashtagInput & Record<string, unknown>> = {
  title: "Hashtag Generator",
  subtitle: "Tiered (broad / medium / niche / branded) in any language, platform-tuned, banned-tag filtered.",
  platform: "tiktok",
  campaign_type: "Hashtags",
  maxTokens: 2500,
  temperature: 0.6,
  skip_framework_stack: true,
  fields: [
    { name: "title", label: "Title / topic", kind: "text", required: true, placeholder: "e.g. Best vegan recipes for beginners", span: 2 },
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      options: [
        { value: "instagram", label: "Instagram" },
        { value: "tiktok", label: "TikTok" },
        { value: "twitter", label: "Twitter / X" },
        { value: "linkedin", label: "LinkedIn" },
        { value: "youtube", label: "YouTube" },
        { value: "pinterest", label: "Pinterest" },
        { value: "any", label: "All platforms (master list)" },
      ],
    },
    { name: "language", label: "Language", kind: "text", required: true, placeholder: "English / Hindi / Spanish / Arabic / Japanese …" },
    { name: "context", label: "Extra context (optional)", kind: "textarea", rows: 2, placeholder: "Region, audience, season, brand voice…", span: 2 },
  ],
  initial: { title: "", platform: "instagram", language: "English", context: "" } as any,
  buildPrompt: (input) => buildHashtagPrompt(input as unknown as HashtagInput),
  buildTitle: (i: any) => `Hashtags · ${i.platform} · ${i.title?.slice(0, 28)}`,
  expectJson: true,
  renderJson: (json) => <HashtagOutput json={json} platform={(config.initial as any).platform} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="generate/hashtags" />;
}

function HashtagOutput({ json }: { json: any; platform: string }) {
  const recommended = json?.[`recommended_set_for_${json?.recommended_platform || "instagram"}`] || json?.recommended_set || [];
  const allTags = [
    ...(json?.tiers?.broad ?? []).map((x: any) => x.tag),
    ...(json?.tiers?.medium ?? []).map((x: any) => x.tag),
    ...(json?.tiers?.niche ?? []).map((x: any) => x.tag),
    ...(json?.tiers?.branded ?? []).map((x: any) => x.tag),
  ];

  return (
    <div className="space-y-4 stagger">
      {json?.language_used ? (
        <Section title="Language">
          <Pill text={json.language_used} tone="info" />
        </Section>
      ) : null}

      {recommended?.length ? (
        <Section title="Recommended set" actions={<CopyButton text={recommended.join(" ")} label="copy all" />}>
          <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-subtle mb-2">paste this directly into your caption</p>
          <p className="text-sm text-live font-mono leading-relaxed break-words">{recommended.join(" ")}</p>
        </Section>
      ) : null}

      {(["broad", "medium", "niche"] as const).map((tier) => {
        const items: any[] = json?.tiers?.[tier] ?? [];
        if (!items.length) return null;
        const toneMap: Record<string, "info" | "live" | "pos"> = { broad: "info", medium: "live", niche: "pos" };
        return (
          <Section key={tier} title={`${tier.toUpperCase()} · ${items.length}`} actions={<CopyButton text={items.map((x) => x.tag).join(" ")} label="copy tier" />}>
            <ul className="space-y-1">
              {items.map((t, i) => (
                <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5 text-xs">
                  <Pill text={tier} tone={toneMap[tier]} />
                  <span className="text-ink font-medium font-mono">{t.tag}</span>
                  {t.casing_variant ? <span className="text-ink-subtle font-mono">/ {t.casing_variant}</span> : null}
                  <span className="text-ink-faint text-[10px] font-mono uppercase tracking-ui-wide ml-auto">{t.estimated_volume}</span>
                  <CopyButton text={t.tag} label="" />
                </li>
              ))}
              <li className="text-[11px] text-ink-muted pt-2 border-t border-base-700">
                use for: {items[0]?.use_for}
              </li>
            </ul>
          </Section>
        );
      })}

      {json?.tiers?.branded?.length ? (
        <Section title="Branded tags" actions={<CopyButton text={json.tiers.branded.map((x: any) => x.tag).join(" ")} />}>
          <ul className="space-y-1">
            {json.tiers.branded.map((t: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-live/40 bg-live/5 px-2 py-1.5 text-xs">
                <span className="text-live font-mono">{t.tag}</span>
                <span className="text-ink-muted flex-1">{t.usage_hint}</span>
                <CopyButton text={t.tag} label="" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.english_crossover?.length ? (
        <Section title="English crossover for international reach">
          <ul className="space-y-1 text-xs">
            {json.english_crossover.map((t: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
                <span className="text-info font-mono">{t.tag}</span>
                <span className="text-ink-muted">{t.use_for}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.avoid?.length ? (
        <Section title="Avoid">
          <ul className="space-y-1 text-xs">
            {json.avoid.map((a: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-neg/40 bg-neg/5 px-2 py-1.5">
                <span className="text-neg font-mono">#{a.tag}</span>
                <span className="text-ink-muted">{a.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.platform_specific_notes ? (
        <Section title="Platform notes">
          <p className="text-sm text-ink leading-relaxed">{json.platform_specific_notes}</p>
        </Section>
      ) : null}

      <Section title="All tags · master copy" actions={<CopyButton text={allTags.join(" ")} label="copy everything" />}>
        <p className="text-xs text-ink-muted font-mono break-words leading-relaxed">{allTags.join(" ")}</p>
      </Section>
    </div>
  );
}
