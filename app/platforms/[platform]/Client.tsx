"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { ExternalLink, ArrowLeft, ArrowRight, Rocket, Sparkles, Activity } from "lucide-react";
import { PLATFORM_HUBS } from "@/lib/platform-hubs";

export default function PlatformClient({ platform }: { platform: string }) {
  return <Inner platform={platform} />;
}

function Inner({ platform }: { platform: string }) {
  const hub = PLATFORM_HUBS[platform];

  if (!hub) {
    return (
      <div>
        <PageHeader scope="platforms/not-found" title="Platform not found" />
        <Link href="/platforms" className="btn-ghost"><ArrowLeft size={11} /> all platforms</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader scope={`platforms/${hub.slug}`} title={hub.name} subtitle={hub.tagline} />

      <div className="mb-4">
        <Link href="/platforms" className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint hover:text-ink">
          ← all platforms
        </Link>
      </div>

      <div className="border border-base-600 bg-base-900/40 p-5 mb-6">
        <p className="text-sm text-ink leading-relaxed">{hub.intro}</p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Pill text={`Best for: ${hub.best_for}`} tone="pos" />
          <Pill text={`Not for: ${hub.not_for}`} tone="neg" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Link href={`/launch-guide?platform=${hub.slug}`} className="border border-live/40 bg-live/5 p-4 hover:bg-live/10 transition group">
          <div className="flex items-center gap-2 text-live mb-1">
            <Rocket size={14} />
            <span className="text-[10px] font-mono uppercase tracking-ui-mega">launch guide</span>
            <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
          </div>
          <p className="text-sm text-ink mt-1">Step-by-step walkthrough — every click, every field, every dropdown, from open to publish.</p>
        </Link>
        <Link href="/suggestions" className="border border-info/40 bg-info/5 p-4 hover:bg-info/10 transition group">
          <div className="flex items-center gap-2 text-info mb-1">
            <Sparkles size={14} />
            <span className="text-[10px] font-mono uppercase tracking-ui-mega">ai suggestions</span>
            <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
          </div>
          <p className="text-sm text-ink mt-1">What should this brand run on {hub.name}? AI proposes 3 campaigns based on your brand brain.</p>
        </Link>
        <Link href={hub.generators[0]?.href || "#"} className="border border-pos/40 bg-pos/5 p-4 hover:bg-pos/10 transition group">
          <div className="flex items-center gap-2 text-pos mb-1">
            <Activity size={14} />
            <span className="text-[10px] font-mono uppercase tracking-ui-mega">jump to generator</span>
            <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
          </div>
          <p className="text-sm text-ink mt-1">Generate copy + creative briefs right now using your active brand.</p>
        </Link>
      </div>

      <Section title={`Ad formats on ${hub.name}`}>
        <div className="grid md:grid-cols-2 gap-2">
          {hub.formats.map((f, i) => (
            <div key={i} className="border border-base-700 bg-base-900/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-ink text-sm">{f.name}</span>
                {f.generator_href ? (
                  <Link href={f.generator_href} className="text-[10px] font-mono uppercase tracking-ui-wide text-live hover:underline inline-flex items-center gap-1">
                    generate <ArrowRight size={9} />
                  </Link>
                ) : null}
              </div>
              <p className="text-[11px] font-mono text-ink-faint mb-1.5">{f.spec}</p>
              <p className="text-xs text-ink-muted leading-relaxed">{f.best_for}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Generators for this platform">
        <div className="flex flex-wrap gap-2">
          {hub.generators.map((g, i) => (
            <Link key={i} href={g.href} className="btn-ghost">
              <Sparkles size={11} /> {g.label}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Optimization tools for this platform">
        <div className="flex flex-wrap gap-2">
          {hub.optimizers.map((g, i) => (
            <Link key={i} href={g.href} className="btn-ghost">
              <Activity size={11} /> {g.label}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Audience targeting playbook">
        <ul className="space-y-1 text-sm text-ink">
          {hub.audience_notes.map((n, i) => <li key={i} className="flex gap-2"><span className="text-live mt-1">○</span>{n}</li>)}
        </ul>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Best practices">
          <ul className="space-y-1 text-sm">
            {hub.best_practices.map((p, i) => <li key={i} className="text-pos flex gap-2"><span>✓</span><span className="text-ink">{p}</span></li>)}
          </ul>
        </Section>
        <Section title="Common mistakes">
          <ul className="space-y-1 text-sm">
            {hub.common_mistakes.map((p, i) => <li key={i} className="text-neg flex gap-2"><span>✕</span><span className="text-ink">{p}</span></li>)}
          </ul>
        </Section>
      </div>

      {hub.external_links.length ? (
        <Section title="External tools">
          <ul className="space-y-1 text-sm">
            {hub.external_links.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-1">
                  {l.label} <ExternalLink size={10} />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
