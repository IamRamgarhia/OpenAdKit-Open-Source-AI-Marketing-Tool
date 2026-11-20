"use client";

import { GeneratorShell } from "@/components/GeneratorShell";
import { arr, obj, strList, txt } from "@/lib/safe-json";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { buildLaunchGuidePrompt, type LaunchGuideInput } from "@/lib/prompts/launch-guide";
import type { GeneratorConfig } from "@/lib/generator-config";

const config: GeneratorConfig<LaunchGuideInput & Record<string, unknown>> = {
  title: "Step-by-step Launch Guide",
  subtitle: "Walks you through the actual ad platform UI — every click, every field, every dropdown choice — from open to publish.",
  platform: "google",
  campaign_type: "Launch Guide",
  maxTokens: 5500,
  temperature: 0.5,
  fields: [
    {
      name: "platform",
      label: "Platform",
      kind: "select",
      options: [
        { value: "meta", label: "Meta · Facebook + Instagram" },
        { value: "google", label: "Google Ads · Search/PMax/Display" },
        { value: "tiktok", label: "TikTok Ads Manager" },
        { value: "linkedin", label: "LinkedIn Campaign Manager" },
        { value: "youtube", label: "YouTube · via Google Ads" },
        { value: "twitter", label: "Twitter / X Ads" },
      ],
    },
    {
      name: "experience_level",
      label: "Your experience",
      kind: "select",
      options: [
        { value: "first_time", label: "First time launching an ad" },
        { value: "some", label: "Some experience" },
        { value: "experienced", label: "Experienced — just need the checklist" },
      ],
    },
    { name: "objective", label: "Objective", kind: "text", required: true, placeholder: "e.g. trial signups, sales, leads" },
    { name: "budget_monthly", label: "Monthly budget (USD)", kind: "text", required: true, placeholder: "500" },
    { name: "product", label: "Product / service", kind: "text", required: true, placeholder: "e.g. AI website builder", span: 2 },
    { name: "audience", label: "Audience description", kind: "textarea", required: true, rows: 2, placeholder: "Who exactly is this for?", span: 2 },
    { name: "geo", label: "Geo (countries / cities)", kind: "text", required: true, placeholder: "US, Canada — 25-65 age" },
  ],
  initial: { platform: "meta", experience_level: "first_time", objective: "", budget_monthly: "", product: "", audience: "", geo: "" } as any,
  buildPrompt: (input) => buildLaunchGuidePrompt(input as unknown as LaunchGuideInput),
  buildTitle: (i: any) => `Launch · ${i.platform} · ${i.product?.slice(0, 24)}`,
  expectJson: true,
  renderJson: (json) => <GuideOutput json={json} />,
};

export default function Page() {
  return <GeneratorShell config={config} scope="launch-guide" />;
}

function GuideOutput({ json }: { json: any }) {
  // No schema on this tool — guard every list/object (lib/safe-json).
  const isObj = (x: unknown) => Boolean(x && typeof x === "object");
  const preflight = arr(json?.preflight_checklist).filter(isObj);
  const sections = arr(json?.sections).filter(isObj);
  const dontTouch = strList(json?.do_not_touch_during_learning_phase);
  const postLaunch = obj(json?.post_launch);
  const links = arr(json?.links).filter((l: any) => isObj(l) && /^https?:\/\//i.test(txt(l.url)));
  return (
    <div className="space-y-4 stagger">
      {txt(json?.estimated_time_minutes) ? (
        <Section title="Time estimate">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">launch time</div>
              <div className="font-display italic text-3xl text-live tabular">~{txt(json.estimated_time_minutes)} min</div>
            </div>
            {txt(json?.estimated_launch_cost_first_week_usd) ? (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">est. first-week cost</div>
                <div className="font-display italic text-3xl text-pos tabular">${txt(json.estimated_launch_cost_first_week_usd)}</div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {preflight.length ? (
        <Section title="Pre-flight checklist · do these BEFORE you start">
          <ul className="space-y-1.5">
            {preflight.map((c: any, i: number) => (
              <li key={i} className="flex items-start gap-2 border border-base-700 px-3 py-2 text-xs">
                <input type="checkbox" className="mt-1 accent-live" />
                <div className="flex-1">
                  <div className="text-ink">{txt(c.item)}</div>
                  <div className="text-ink-muted text-[11px] mt-0.5">{txt(c.why)}</div>
                </div>
                {c.blocker_if_missing ? <Pill text="blocker" tone="neg" /> : <Pill text="recommended" />}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {sections.map((s: any, i: number) => (
        <Section key={i} title={`${i + 1}. ${txt(s.section_name)}`}>
          <ol className="space-y-2">
            {arr(s.steps).filter(isObj).map((step: any, j: number) => (
              <li key={`${txt(step.step_number)}-${j}`} className="border border-base-700 bg-base-900/30 p-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="font-display italic text-xl text-live tabular leading-none mt-0.5">{txt(step.step_number) || j + 1}</span>
                  <div className="flex-1">
                    <div className="text-ink font-medium">{txt(step.action)}</div>
                    {step.recommended_value ? (
                      <div className="mt-1.5 inline-block border border-pos/40 bg-pos/5 text-pos px-2 py-0.5 text-xs font-mono">
                        → {txt(step.recommended_value)}
                      </div>
                    ) : null}
                    {step.screenshot_anchor ? (
                      <div className="mt-1.5 text-[11px] font-mono uppercase tracking-ui-wide text-info">
                        look for: {txt(step.screenshot_anchor)}
                      </div>
                    ) : null}
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      {step.why_this_matters ? (
                        <div className="border border-base-700 p-2">
                          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">why this matters</div>
                          <div className="text-ink-muted text-[11px] mt-0.5">{txt(step.why_this_matters)}</div>
                        </div>
                      ) : null}
                      {step.common_mistake ? (
                        <div className="border border-neg/40 bg-neg/5 p-2">
                          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg flex items-center gap-1">
                            <AlertTriangle size={9} /> common mistake
                          </div>
                          <div className="text-ink-muted text-[11px] mt-0.5">{txt(step.common_mistake)}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ))}

      {dontTouch.length ? (
        <Section title="DO NOT touch during the first 7 days (learning phase)">
          <ul className="space-y-1 text-sm text-ink">
            {dontTouch.map((d, i) => (
              <li key={i} className="flex gap-2"><span className="text-neg">✕</span>{d}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {Object.keys(postLaunch).length ? (
        <Section title="Post-launch — what to do on day 1 / 3 / 7">
          {(["day_1", "day_3", "day_7"] as const).map((k) => (
            <div key={k} className="mb-3 last:mb-0">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-1">{k.replace("_", " ")}</div>
              <ul className="text-sm text-ink space-y-0.5">{strList(postLaunch[k]).map((a, i) => <li key={i}>✓ {a}</li>)}</ul>
            </div>
          ))}
        </Section>
      ) : null}

      {links.length ? (
        <Section title="Reference links">
          <ul className="space-y-1 text-sm">
            {links.map((l: any, i: number) => (
              <li key={i}>
                <a href={txt(l.url)} target="_blank" rel="noopener noreferrer" className="text-info hover:underline inline-flex items-center gap-1">
                  {txt(l.label) || txt(l.url)} <ExternalLink size={10} />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
