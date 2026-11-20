"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, StopCircle, Save, AlertTriangle, ArrowRight } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill, Kv } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";
import { getCurrency } from "@/lib/currency";
import { useThrottledStream } from "@/lib/stream-hook";
import { getActiveBrainId, addUsage } from "@/lib/settings";
import { llmStream, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { validateOrRetry, StructuredLlmError } from "@/lib/llm-structured";
import { SuggestionsSchema } from "@/lib/schemas/generators";
import { getBrain, saveAd, type GeneratedAd } from "@/lib/storage";
import { buildBrandSystemPrompt, type BrandBrain } from "@/lib/brand-brain";
import { buildSuggestedCampaignsPrompt } from "@/lib/prompts/suggested-campaigns";

export default function Page() {
  return (
    <ApiKeyGate>
      <Inner />
    </ApiKeyGate>
  );
}

function Inner() {
  const [brain, setBrain] = useState<BrandBrain | null>(null);
  const [running, setRunning] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [schemaRecovered, setSchemaRecovered] = useState(false);
  const stream = useThrottledStream();
  const abortRef = useRef<AbortController | null>(null);

  const ranOnceRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      const id = getActiveBrainId();
      const b = id ? (await getBrain(id)) ?? null : null;
      setBrain(b);
      // Auto-run on first arrival. Pass the brain DIRECTLY so we don't depend
      // on the next React render committing setBrain(b) — the previous
      // setTimeout(() => run(), 400) closed over `brain` state which was still
      // null at the render the setTimeout was scheduled in.
      if (b && !ranOnceRef.current) {
        ranOnceRef.current = true;
        runWithBrain(b);
      }
    };
    load();
    const h = () => load();
    window.addEventListener("ados:brains-changed", h);
    return () => window.removeEventListener("ados:brains-changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run() {
    return runWithBrain(brain);
  }

  async function runWithBrain(b: BrandBrain | null) {
    if (!b) {
      setError("No active Brand Brain. Add one at /brand first.");
      return;
    }
    setError(null);
    setParsed(null);
    setSavedId(null);
    setSchemaRecovered(false);
    stream.reset();
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const system = buildBrandSystemPrompt(b);
      const prompt = buildSuggestedCampaignsPrompt(b);
      const res = await llmStream(
        {
          system,
          messages: [{ role: "user", content: prompt }],
          maxTokens: 5500,
          temperature: 0.75,
          signal: controller.signal,
        },
        { onDelta: stream.append }
      );
      let cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      // Some providers (Gemini) sometimes return res.text empty even when
      // streaming worked. Fall back to the accumulated stream buffer so the
      // saved ad always has the actual generated content.
      let finalText = res.text || stream.text;
      // Schema-validate + retry once if shape is wrong. Mirrors GeneratorShell
      // so suggestions get the same "no false results" guarantee — without
      // this, a malformed `campaigns` array would crash the renderer's
      // .map() call on undefined.
      let json: any;
      try {
        const v = await validateOrRetry({
          schema: SuggestionsSchema,
          raw: finalText,
          system,
          originalPrompt: prompt,
          signal: controller.signal,
          maxTokens: 5500,
        });
        json = v.data;
        if (v.recovered) {
          setSchemaRecovered(true);
          cost += v.costUsd;
          addUsage(v.costUsd, v.usage?.input_tokens ?? 0, v.usage?.output_tokens ?? 0);
          window.dispatchEvent(new Event("ados:usage"));
          finalText = v.raw;
        }
      } catch (vErr) {
        if (vErr instanceof StructuredLlmError) {
          setError(
            "Model returned a shape we couldn't use, even after a correction pass. Try a different provider — Claude / GPT / Gemini are most reliable for structured output."
          );
          return;
        }
        throw vErr;
      }
      setParsed(json);
      const ad: GeneratedAd = {
        id: crypto.randomUUID(),
        brand_id: b.id,
        platform: "google",
        campaign_type: "Suggested Campaigns",
        title: `Suggestions · ${b.name || b.business_name}`,
        input: {},
        output_json: json,
        output_text: finalText,
        model_id: res.modelId,
        usage_input_tokens: res.usage?.input_tokens ?? 0,
        usage_output_tokens: res.usage?.output_tokens ?? 0,
        cost_usd: cost,
        starred: false,
        status: "draft",
        notes: "",
        created_at: Date.now(),
      };
      await saveAd(ad);
      setSavedId(ad.id);
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
        scope="suggestions"
        title="What this brand should run"
        subtitle="AI proactively designs an ad strategy from the active brand brain. Hit generate — get 3 campaigns to launch, content starter, quick wins, and a 30-day plan."
        showLive={running}
      />

      {!brain ? (
        <div className="border border-live/30 bg-live/5 text-live text-sm px-4 py-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={14} />
          No active brand. <Link href="/brand" className="underline">Add or activate a brand</Link> first.
        </div>
      ) : (
        <div className="border border-base-600 bg-base-900/40 p-4 mb-4 flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">analyzing brand</span>
          <span className="font-display italic text-xl text-live">{brain.name || brain.business_name}</span>
          {brain.usp ? <span className="text-[12px] text-ink-muted ml-auto truncate max-w-md">{brain.usp}</span> : null}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={run} disabled={running || !brain} className="btn-primary">
          {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {running ? "analyzing brand…" : parsed ? "regenerate suggestions" : "generate suggestions"}
        </button>
        {running ? <button onClick={() => abortRef.current?.abort()} className="btn-ghost"><StopCircle size={12} /></button> : null}
        {savedId ? <span className="text-[10px] text-pos font-mono uppercase tracking-ui-mega flex items-center gap-1"><Save size={11} /> saved to history</span> : null}
      </div>

      {error ? (
        <div className={`border ${/rate limit|quota|too many requests|429|retry in/i.test(error) ? "border-live/40 bg-live/5" : "border-neg/40 bg-neg/5"} px-3 py-3 mb-4 space-y-3`}>
          <div className={`${/rate limit|quota|too many requests|429|retry in/i.test(error) ? "text-live" : "text-neg"} text-sm`}>{error}</div>
          {/rate limit|quota|too many requests|429|retry in/i.test(error) ? (
            <ProviderSwitcher reason="rate-limit" />
          ) : null}
        </div>
      ) : null}

      {!running && !stream.text && !parsed ? (
        <div className="border border-dashed border-base-600 bg-base-900/20 text-[11px] font-mono uppercase tracking-ui-mega text-ink-faint min-h-[260px] grid place-items-center">
          click generate — output streams here
        </div>
      ) : null}

      {schemaRecovered && parsed ? (
        <div
          role="status"
          className="text-[11px] font-mono uppercase tracking-ui-mega text-live border border-live/30 bg-live/4 px-2 py-1 inline-block mb-3"
          title="The model's first reply didn't match the expected structure, so we automatically re-asked it to correct the JSON. Content below was returned by the second attempt."
        >
          ↻ ai output auto-corrected (schema retry)
        </div>
      ) : null}
      {parsed ? <SuggestionsOutput json={parsed} /> : stream.text ? (
        <div className="border border-base-600 bg-base-900/40 p-5">
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink caret">{stream.text}</pre>
        </div>
      ) : null}
    </div>
  );
}

function SuggestionsOutput({ json }: { json: any }) {
  return (
    <div className="space-y-4 stagger">
      {json?.campaigns?.length ? (
        <Section title={`Top campaigns to launch this week · ${json.campaigns.length}`}>
          <div className="space-y-3">
            {json.campaigns.map((c: any, i: number) => (
              <div key={i} className="border border-live/30 bg-live/5 p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-[10px] tabular text-ink-faint">#{i + 1}</span>
                  <Pill text={c.platform} tone="live" />
                  <Pill text={c.objective} />
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-ui-wide text-pos">{getCurrency().symbol}{c.monthly_budget_usd}/mo</span>
                </div>
                <h3 className="font-display italic text-2xl text-ink leading-tight">{c.name}</h3>
                <p className="text-sm text-ink-muted mt-2 leading-relaxed">{c.why_this_brand}</p>
                <div className="grid md:grid-cols-2 gap-2 mt-3 text-xs">
                  <Kv k="audience" v={c.target_audience} />
                  <Kv k="ctr target" v={c.kpi_targets?.ctr_pct ?? "—"} />
                </div>
                {c.hooks?.length ? (
                  <div className="mt-3">
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">hooks</div>
                    <ul className="space-y-0.5 text-sm text-live">{c.hooks.map((h: string, j: number) => <li key={j} className="italic">"{h}"</li>)}</ul>
                  </div>
                ) : null}
                {c.adOS_workflow?.length ? (
                  <div className="mt-3 pt-3 border-t border-base-700">
                    <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1.5">your workflow in OpenAdKit</div>
                    <div className="flex flex-wrap gap-2">
                      {c.adOS_workflow.map((w: any, j: number) => (
                        <Link key={j} href={w.url} className="btn-ghost text-[11px]">
                          {w.step} <ArrowRight size={10} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <CopyButton text={`${c.name}\n${c.why_this_brand}\n\nHooks:\n${(c.hooks || []).join("\n")}`} label="copy plan" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {json?.content_calendar_starter?.length ? (
        <Section title="Content calendar starter · week 1">
          <ul className="space-y-1.5 text-xs">
            {json.content_calendar_starter.map((p: any, i: number) => (
              <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
                <span className="font-mono text-ink-faint w-12">day {p.day}</span>
                <Pill text={p.platform} tone="live" />
                <span className="text-ink font-medium flex-1 truncate">{p.hook}</span>
                <span className="text-[10px] text-ink-muted">{p.pillar}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Link href="/generate/content-calendar" className="btn-ghost"><Sparkles size={11} /> Generate full calendar</Link>
          </div>
        </Section>
      ) : null}

      {json?.quick_wins?.length ? (
        <Section title="Quick wins · do today">
          <ul className="space-y-1.5">
            {json.quick_wins.map((w: any, i: number) => (
              <li key={i} className="border border-pos/30 bg-pos/5 p-3 text-sm">
                <div className="text-pos font-medium">{w.tactic}</div>
                <div className="text-xs text-ink-muted mt-1">where: {w.where}</div>
                <div className="text-xs text-ink-muted">impact: {w.expected_impact}</div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.thirty_day_plan?.length ? (
        <Section title="30-day plan">
          {json.thirty_day_plan.map((w: any) => (
            <div key={w.week} className="border border-base-700 p-3 mb-2 last:mb-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono tabular text-live">week {w.week}</span>
                <Pill text={`$${w.spend_usd}`} />
                <span className="text-sm text-ink font-medium">{w.focus}</span>
              </div>
              <ul className="text-xs text-ink-muted ml-4 space-y-0.5">{w.deliverables?.map((d: string, i: number) => <li key={i}>○ {d}</li>)}</ul>
            </div>
          ))}
        </Section>
      ) : null}

      {json?.no_go?.length ? (
        <Section title="No-go list · what NOT to run">
          <ul className="space-y-1 text-sm">
            {json.no_go.map((n: any, i: number) => (
              <li key={i} className="flex gap-2"><span className="text-neg">✕</span> <span className="text-ink"><strong>{n.platform_or_tactic}</strong> — {n.reason}</span></li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.open_questions?.length ? (
        <Section title="Open questions · refining the plan">
          <ul className="text-sm text-ink-muted space-y-0.5">{json.open_questions.map((q: string, i: number) => <li key={i}>· {q}</li>)}</ul>
          <Link href="/brand" className="btn-ghost mt-3"><ArrowRight size={11} /> answer these in your brand brain</Link>
        </Section>
      ) : null}
    </div>
  );
}
