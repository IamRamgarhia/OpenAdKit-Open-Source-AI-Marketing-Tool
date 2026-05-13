"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { Section, Pill } from "@/components/OutputBlocks";
import { CharBadge } from "@/components/CharBadge";
import { CopyButton } from "@/components/CopyButton";
import { buildEmailSubjectsPrompt, EMAIL_SUBJECT_LIMITS, type EmailSubjectInput } from "@/lib/prompts/email-subjects";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<EmailSubjectInput & Record<string, unknown>> = {
  title: "Email subject lines",
  subtitle: "12 angle-distinct subjects + preheaders. Mobile-cutoff-aware. Spam-risk flagged.",
  platform: "google",
  campaign_type: "Email Subjects",
  maxTokens: 2500,
  skip_framework_stack: true,
  fields: [
    {
      name: "campaign_type",
      label: "Campaign type",
      kind: "select",
      options: [
        { value: "promotional", label: "Promotional" },
        { value: "newsletter", label: "Newsletter" },
        { value: "cart_abandonment", label: "Cart abandonment" },
        { value: "welcome", label: "Welcome series" },
        { value: "winback", label: "Winback" },
        { value: "announcement", label: "Announcement" },
      ],
    },
    { name: "product_or_topic", label: "Product / topic", kind: "text", required: true, placeholder: "Black Friday — 40% off all annual plans", span: 2 },
    { name: "audience", label: "Audience", kind: "text", required: true, placeholder: "Existing free-trial users, 14-day cohort" },
    { name: "primary_outcome", label: "Primary outcome", kind: "text", required: true, placeholder: "Upgrade to paid annual" },
  ],
  initial: { campaign_type: "promotional", product_or_topic: "", audience: "", primary_outcome: "" } as any,
  buildPrompt: (input) => buildEmailSubjectsPrompt(input as unknown as EmailSubjectInput),
  buildTitle: (i: any) => `Email · ${i.campaign_type} · ${i.product_or_topic?.slice(0, 24)}`,
  expectJson: true,
  renderJson: (json) => <EmailOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="generate/email-subjects" />;
}

const spamTone: Record<string, "pos" | "live" | "neg"> = { low: "pos", medium: "live", high: "neg" };

function EmailOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      <Section title={`Subjects · ${json?.subjects?.length ?? 0}`} actions={<CopyButton text={(json?.subjects ?? []).map((s: any) => `${s.subject}\n${s.preheader}`).join("\n\n")} label="copy all" />}>
        <ul className="divide-y divide-base-700">
          {(json?.subjects ?? []).map((s: any, i: number) => (
            <li key={i} className="py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-faint w-5 tabular">{s.label}</span>
                <Pill text={s.angle} tone="live" />
                <Pill text={s.spam_risk ?? "low"} tone={spamTone[s.spam_risk] ?? "pos"} label="spam" />
                <div className="flex-1" />
                <CopyButton text={s.subject} label="" />
              </div>
              <div className="flex items-center gap-2 pl-7">
                <CharBadge count={s.subject_chars ?? s.subject?.length ?? 0} max={EMAIL_SUBJECT_LIMITS.subject_desktop_cutoff} />
                <CharBadge count={s.subject_chars_mobile_visible ?? Math.min(s.subject?.length ?? 0, EMAIL_SUBJECT_LIMITS.subject_mobile_cutoff)} max={EMAIL_SUBJECT_LIMITS.subject_mobile_cutoff} />
                <span className="text-sm text-ink font-medium">{s.subject}</span>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <CharBadge count={s.preheader_chars ?? s.preheader?.length ?? 0} max={EMAIL_SUBJECT_LIMITS.preheader_optimal} />
                <span className="text-xs text-ink-muted">{s.preheader}</span>
              </div>
              {s.spam_risk_reason ? <div className="text-[11px] text-neg pl-7">⚠ {s.spam_risk_reason}</div> : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Send strategy">
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <div className="border border-base-700 p-2">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">first send</div>
            <div className="text-live font-display italic text-xl mt-1">{json?.best_for_first_send}</div>
          </div>
          <div className="border border-base-700 p-2">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">resend non-openers</div>
            <div className="text-live font-display italic text-xl mt-1">{json?.best_for_resend_to_non_openers}</div>
          </div>
        </div>
        {json?.best_for_segments?.length ? (
          <ul className="mt-3 space-y-1 text-xs">
            {json.best_for_segments.map((s: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1">
                <span className="text-ink-muted flex-1">{s.segment}</span>
                <Pill text={s.use} tone="live" />
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
