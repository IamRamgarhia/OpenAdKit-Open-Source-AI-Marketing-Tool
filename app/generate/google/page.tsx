"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { CharBadge } from "@/components/CharBadge";
import { CopyButton } from "@/components/CopyButton";
import { GoogleSearchMockup } from "@/components/AdMockup";
import { Section } from "@/components/OutputBlocks";
import {
  buildGoogleRsaPrompt,
  GOOGLE_RSA_LIMITS,
  type GoogleRsaInput,
  type GoogleRsaOutput,
} from "@/lib/prompts/google-ads";
import type { GeneratorConfig } from "@/lib/generator-config";
import { GoogleSchema } from "@/lib/schemas/generators";

const config: GeneratorConfig<GoogleRsaInput & Record<string, unknown>> = {
  title: "Google Responsive Search Ad",
  subtitle: "15 headlines, 4 descriptions, extensions, Quality Score tips. Char-validated, combinability-checked.",
  platform: "google",
  campaign_type: "RSA",
  maxTokens: 3500,
  temperature: 0.8,
  fields: [
    {
      name: "goal",
      label: "Goal",
      kind: "select",
      options: [
        { value: "sales", label: "Sales" },
        { value: "leads", label: "Leads" },
        { value: "traffic", label: "Traffic" },
        { value: "brand awareness", label: "Brand awareness" },
        { value: "app installs", label: "App installs" },
      ],
    },
    { name: "product", label: "Product / service", kind: "text", required: true, placeholder: "e.g. AI resume builder" },
    { name: "keyword", label: "Target keyword", kind: "text", required: true, placeholder: "resume builder online" },
    { name: "landing_url", label: "Landing URL", kind: "text", placeholder: "https://…" },
    { name: "offer", label: "Special offer", kind: "text", placeholder: "30% off first month", span: 2 },
  ],
  initial: { goal: "sales", product: "", keyword: "", landing_url: "", offer: "" } as any,
  buildPrompt: (input) => buildGoogleRsaPrompt(input as unknown as GoogleRsaInput),
  buildTitle: (input) => `${(input as any).product} — ${(input as any).keyword}`,
  expectJson: true,
  schema: GoogleSchema,
  renderJson: (json: GoogleRsaOutput) => <RsaOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="generate/google/rsa" />;
}

function RsaOutput({ json }: { json: GoogleRsaOutput }) {
  return (
    <div className="space-y-4 stagger">
      <Section title="Live preview · Google search result">
        <GoogleSearchMockup
          display_url="example.com"
          headlines={(json.headlines ?? []).map((h) => h.trimmed_alt || h.text)}
          descriptions={(json.descriptions ?? []).map((d) => d.trimmed_alt || d.text)}
          sitelinks={json.sitelinks}
        />
      </Section>

      {json.angles?.length ? (
        <Section title={`Angles · ${json.angles.length}`}>
          <div className="flex flex-wrap gap-1.5">
            {json.angles.map((a, i) => (
              <span key={i} className="border border-base-600 px-2 py-1 text-[10px] font-mono uppercase tracking-ui-wide">
                <span className="text-live">{a.label}</span>
                <span className="text-ink-subtle mx-1">·</span>
                <span className="text-ink-muted">{a.motivation}</span>
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={`Headlines · ${json.headlines?.length ?? 0}`} actions={<CopyButton text={(json.headlines ?? []).map((h) => h.trimmed_alt || h.text).join("\n")} />}>
        <ul className="divide-y divide-base-700">
          {(json.headlines ?? []).map((h, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <CharBadge count={h.chars || (h.text?.length ?? 0)} max={GOOGLE_RSA_LIMITS.headline} />
              <span className="w-20 text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint">{h.angle}</span>
              <span className={`text-sm flex-1 truncate ${h.status === "over" ? "line-through text-ink-subtle" : "text-ink"}`}>
                {h.text}
              </span>
              {h.trimmed_alt ? <span className="text-[10px] text-pos font-mono">→ {h.trimmed_alt}</span> : null}
              <CopyButton text={h.trimmed_alt || h.text} label="" />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Descriptions · ${json.descriptions?.length ?? 0}`} actions={<CopyButton text={(json.descriptions ?? []).map((d) => d.trimmed_alt || d.text).join("\n")} />}>
        <ul className="space-y-1.5">
          {(json.descriptions ?? []).map((d, i) => (
            <li key={i} className="flex items-start gap-2 border border-base-700 bg-base-900/30 px-2 py-1.5">
              <CharBadge count={d.chars || (d.text?.length ?? 0)} max={GOOGLE_RSA_LIMITS.description} />
              <span className="w-20 text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint mt-0.5">{d.angle}</span>
              <span className={`text-sm flex-1 ${d.status === "over" ? "line-through text-ink-subtle" : "text-ink"}`}>{d.text}</span>
              <CopyButton text={d.trimmed_alt || d.text} label="" />
            </li>
          ))}
        </ul>
      </Section>

      {json.sitelinks?.length ? (
        <Section title={`Sitelinks · ${json.sitelinks.length}`}>
          <div className="grid md:grid-cols-2 gap-2">
            {json.sitelinks.map((s, i) => (
              <div key={i} className="border border-base-700 bg-base-900/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CharBadge count={s.title.length} max={GOOGLE_RSA_LIMITS.sitelink_title} />
                  <span className="text-sm font-medium text-ink">{s.title}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1 flex gap-2 items-center">
                  <CharBadge count={s.desc1.length} max={GOOGLE_RSA_LIMITS.sitelink_desc} />
                  {s.desc1}
                </div>
                <div className="text-xs text-ink-muted mt-1 flex gap-2 items-center">
                  <CharBadge count={s.desc2.length} max={GOOGLE_RSA_LIMITS.sitelink_desc} />
                  {s.desc2}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {json.callouts?.length ? (
        <Section title={`Callouts · ${json.callouts.length}`}>
          <div className="flex flex-wrap gap-1.5">
            {json.callouts.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 border border-base-700 bg-base-900/30 px-2 py-1 text-xs text-ink">
                <CharBadge count={c.length} max={GOOGLE_RSA_LIMITS.callout} />
                {c}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {json.structured_snippets?.values?.length ? (
        <Section title="Structured snippets">
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle mb-2">
            header: <span className="text-ink">{json.structured_snippets.header}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {json.structured_snippets.values.map((v, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 border border-base-700 bg-base-900/30 px-2 py-1 text-xs text-ink">
                <CharBadge count={v.length} max={GOOGLE_RSA_LIMITS.snippet_value} />
                {v}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {json.quality_score_tips?.length ? (
        <Section title="Quality Score Tips">
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-ink">
            {json.quality_score_tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </Section>
      ) : null}

      {json.self_check ? (
        <Section title="Self-check">
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <Kv k="combinable" v={json.self_check.combinable ? "yes" : "no"} pos={json.self_check.combinable} />
            <Kv k="mix balanced" v={json.self_check.headline_mix_balanced ? "yes" : "no"} pos={json.self_check.headline_mix_balanced} />
          </div>
          {json.self_check.notes ? (
            <p className="text-[12px] text-ink-muted mt-3 leading-relaxed">{json.self_check.notes}</p>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}

function Kv({ k, v, pos }: { k: string; v: string; pos: boolean }) {
  return (
    <div className="flex items-center gap-2 border border-base-700 bg-base-900/30 px-2 py-1.5">
      <span className="text-ink-faint uppercase tracking-ui-mega text-[10px]">{k}</span>
      <span className="flex-1" />
      <span className={pos ? "text-pos" : "text-neg"}>{v}</span>
    </div>
  );
}
