"use client";

import { Fragment, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, Sparkles, StopCircle } from "lucide-react";
import { RequireKeyAction } from "@/components/RequireKeyAction";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { useThrottledStream } from "@/lib/stream-hook";
import { getApiKey, getModel, getActiveBrainId, addUsage, getLanguage, getToneOverride } from "@/lib/settings";
import { streamClaude, estimateCostUsd, tryParseJson } from "@/lib/claude";
import { getBrain } from "@/lib/storage";
import { buildBrandSystemPrompt } from "@/lib/brand-brain";
import { buildTrainerPrompt, FRAMEWORK_INFO, type Framework, type TrainerInput } from "@/lib/prompts/framework-trainer";

export default function Client() {
  return <Inner />;
}

function Inner() {
  const [framework, setFramework] = useState<Framework>("aida");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [attempt, setAttempt] = useState("");
  const [running, setRunning] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const stream = useThrottledStream();
  const abortRef = useRef<AbortController | null>(null);

  const fw = FRAMEWORK_INFO[framework];

  async function run() {
    setError(null);
    setParsed(null);
    stream.reset();
    if (!product.trim() || !audience.trim()) {
      setError("Product and audience are required.");
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("No API key.");
      return;
    }
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const id = getActiveBrainId();
      const brain = id ? (await getBrain(id)) ?? null : null;
      const input: TrainerInput = { framework, product, audience, user_attempt: attempt };
      const res = await streamClaude(
        {
          apiKey,
          // "" would override the provider default and 404.
          model: getModel() || undefined,
          system: buildBrandSystemPrompt(brain, { language: getLanguage(), tone_override: getToneOverride() }),
          messages: [{ role: "user", content: buildTrainerPrompt(input) }],
          maxTokens: 2500,
          temperature: 0.7,
          signal: controller.signal,
        },
        { onDelta: stream.append }
      );
      addUsage(estimateCostUsd(res.providerId, res.modelId, res.usage), res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      // stream.text here is the closure's stale pre-run "" — read the live buffer.
      setParsed(tryParseJson(res.text || stream.getText()));
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Failed");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div>
      <PageHeader
        scope="learn/frameworks"
        title="Ad Copy School"
        subtitle="Pick a copywriting framework, try writing an ad, get a critique + rewrite."
        showLive={running}
      />

      <div className="mb-4 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
        ← <Link href="/learn" className="text-live hover:underline">concept library</Link> · <Link href="/learn/courses" className="text-live hover:underline">mini-courses</Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(FRAMEWORK_INFO) as Framework[]).map((k) => (
          <button
            key={k}
            onClick={() => setFramework(k)}
            className={`border px-3 py-1.5 text-[11px] font-mono uppercase tracking-ui-wide ${
              framework === k ? "border-live text-live bg-live/5" : "border-base-600 text-ink-muted hover:text-ink"
            }`}
          >
            {FRAMEWORK_INFO[k].name}
          </button>
        ))}
      </div>

      <div className="border border-base-600 bg-base-900/40 p-4 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">structure</div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {fw.structure.map((s, i) => (
            <Fragment key={s}>
              <Pill text={s} tone="live" />
              {i < fw.structure.length - 1 ? <span className="text-ink-faint">→</span> : null}
            </Fragment>
          ))}
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">{fw.when}</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 border border-base-600 bg-base-900/40 p-5 space-y-3">
          <h3 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">your ad attempt</h3>
          <div>
            <label className="label">product *</label>
            <input className="input-base" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. AI photo editor" />
          </div>
          <div>
            <label className="label">audience *</label>
            <input className="input-base" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. amateur photographers, busy parents" />
          </div>
          <div>
            <label className="label">your attempt · optional</label>
            <textarea
              rows={6}
              className="input-base"
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
              placeholder={`Write your ad using ${fw.name}. Try to hit each step:\n${fw.structure.map((s) => `[${s}] …`).join("\n")}`}
            />
            <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-1">
              leave blank to just see a reference example
            </p>
          </div>
          {error ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">{error}</div>
          ) : null}
          <RequireKeyAction what="the AI coach">
            <div className="flex gap-2">
              <button onClick={run} disabled={running} className="btn-primary flex-1">
                {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {running ? "coaching" : attempt.trim() ? "critique + rewrite" : "show reference"}
              </button>
              {running ? <button onClick={() => abortRef.current?.abort()} className="btn-ghost"><StopCircle size={12} /></button> : null}
            </div>
          </RequireKeyAction>
        </section>

        <section className="lg:col-span-3 space-y-4">
          {!running && !stream.text && !parsed ? (
            <div className="border border-dashed border-base-600 bg-base-900/20 text-[11px] font-mono uppercase tracking-ui-mega text-ink-faint min-h-[260px] grid place-items-center">
              {`reference example ${attempt.trim() ? "+ your critique + rewrite" : ""} will appear here`}
            </div>
          ) : null}

          {parsed ? <TrainerOutput parsed={parsed} /> : stream.text ? (
            <div className="border border-base-600 bg-base-900/40 p-5">
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink caret">{stream.text}</pre>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function TrainerOutput({ parsed }: { parsed: any }) {
  return (
    <div className="space-y-4 stagger">
      {parsed?.reference_example ? (
        <Section title="Reference example" actions={<CopyButton text={parsed.reference_example.labeled_beats?.map((b: any) => `[${b.step}] ${b.text}`).join("\n")} />}>
          <ol className="space-y-1.5">
            {parsed.reference_example.labeled_beats?.map((b: any, i: number) => (
              <li key={i} className="flex gap-2 border border-base-700 px-2 py-1.5 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-live w-32 mt-1 shrink-0">[{b.step}]</span>
                <span className="text-ink">{b.text}</span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-ink-muted mt-3 border-t border-base-700 pt-2">{parsed.reference_example.rationale}</p>
        </Section>
      ) : null}

      {parsed?.user_critique ? (
        <Section title="Critique of your attempt">
          {parsed.user_critique.step_mapping?.length ? (
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">step mapping</div>
              <ul className="space-y-1 text-xs">
                {parsed.user_critique.step_mapping.map((m: any, i: number) => {
                  const mismatch = m.intended_step !== m.actually_serves;
                  return (
                    <li key={i} className="border border-base-700 px-2 py-1.5">
                      <div className="text-ink mb-1">"{m.user_line}"</div>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-ui-wide">
                        <Pill text={m.intended_step} label="meant" />
                        <span className="text-ink-faint">→</span>
                        <Pill text={m.actually_serves} tone={mismatch ? "neg" : "pos"} label="actually" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {parsed.user_critique.missing_steps?.length ? (
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg mb-1">missing steps</div>
              <div className="flex flex-wrap gap-1.5">{parsed.user_critique.missing_steps.map((s: string, i: number) => <Pill key={i} text={s} tone="neg" />)}</div>
            </div>
          ) : null}
          {parsed.user_critique.lines_that_work?.length ? (
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-pos mb-1">lines that work</div>
              <ul className="space-y-0.5 text-sm text-ink">{parsed.user_critique.lines_that_work.map((l: string, i: number) => <li key={i}>✓ {l}</li>)}</ul>
            </div>
          ) : null}
          {parsed.user_critique.lines_that_dont?.length ? (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg mb-1">lines that don't</div>
              <ul className="space-y-1 text-xs">{parsed.user_critique.lines_that_dont.map((l: any, i: number) => (
                <li key={i} className="border border-base-700 px-2 py-1.5"><div className="text-ink">✕ {l.line}</div><div className="text-ink-muted mt-0.5">{l.why}</div></li>
              ))}</ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {parsed?.user_rewrite ? (
        <Section title="Rewrite — your voice + framework" actions={<CopyButton text={parsed.user_rewrite.labeled_beats?.map((b: any) => `[${b.step}] ${b.text}`).join("\n")} />}>
          <ol className="space-y-1.5">
            {parsed.user_rewrite.labeled_beats?.map((b: any, i: number) => (
              <li key={i} className="flex gap-2 border border-base-700 bg-base-900/30 px-2 py-1.5 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-ui-mega text-live w-32 mt-1 shrink-0">[{b.step}]</span>
                <span className="text-ink">{b.text}</span>
              </li>
            ))}
          </ol>
          {parsed.user_rewrite.what_changed?.length ? (
            <div className="mt-3 pt-2 border-t border-base-700">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">what changed</div>
              <ul className="space-y-0.5 text-[11px] text-ink-muted">{parsed.user_rewrite.what_changed.map((c: string, i: number) => <li key={i}>· {c}</li>)}</ul>
            </div>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
