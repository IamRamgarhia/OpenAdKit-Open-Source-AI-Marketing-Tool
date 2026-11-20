"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Markdown } from "@/components/Markdown";
import { CopyButton } from "@/components/CopyButton";
import { useThrottledStream } from "@/lib/stream-hook";
import { getApiKey, getModel, addUsage, getLanguage, getToneOverride, getActiveBrainId } from "@/lib/settings";
import { streamClaude, estimateCostUsd } from "@/lib/claude";
import { buildBrandSystemPrompt } from "@/lib/brand-brain";
import { getBrain } from "@/lib/storage";
import { RequireKeyAction } from "@/components/RequireKeyAction";
import { buildConceptPrompt } from "@/lib/prompts/concept-explainer";
import { CONCEPTS, CATEGORY_LABEL } from "@/lib/learn-content";

export default function ConceptClient({ concept }: { concept: string }) {
  return <Inner concept={concept} />;
}

function Inner({ concept }: { concept: string }) {
  const slug = concept;
  const def = CONCEPTS.find((c) => c.slug === slug);
  const stream = useThrottledStream();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [industry, setIndustry] = useState("");
  const [platform, setPlatform] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // Abort the in-flight streaming call on unmount so React doesn't get
  // "update on unmounted component" warnings + we stop wasting API budget.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function explain() {
    if (!def) return;
    setError(null);
    setDone(false);
    stream.reset();
    setRunning(true);
    abortRef.current = new AbortController();
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        setError("No API key.");
        return;
      }
      const prompt = buildConceptPrompt({ concept: def.name, context_industry: industry, context_platform: platform });
      // Same system prompt as every other tool so the user's output language
      // and tone override apply here too (this call used to send none).
      const brainId = getActiveBrainId();
      const brain = brainId ? (await getBrain(brainId)) ?? null : null;
      const system = buildBrandSystemPrompt(brain, {
        language: getLanguage(),
        tone_override: getToneOverride(),
        skip_framework_stack: true,
      });
      const res = await streamClaude(
        {
          apiKey,
          // "" would beat the provider default and 404 — let resolve() pick.
          model: getModel() || undefined,
          system,
          messages: [{ role: "user", content: prompt }],
          maxTokens: 1500,
          temperature: 0.5,
          signal: abortRef.current.signal,
        },
        { onDelta: stream.append }
      );
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      setDone(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Failed");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  if (!def) {
    return (
      <div>
        <PageHeader scope="learn/not-found" title="Concept not found" />
        <Link href="/learn" className="btn-ghost">
          <ArrowLeft size={12} /> back to library
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader scope={`learn/${def.slug}`} title={def.name} subtitle={def.blurb} showLive={running} />

      <div className="mb-4 flex items-center gap-2">
        <Link href="/learn" className="btn-ghost">
          <ArrowLeft size={12} /> library
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
          {CATEGORY_LABEL[def.category]}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-base-600 bg-base-900/40 p-4 h-fit space-y-3">
          <h3 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">contextualize</h3>
          <div>
            <label className="label">your industry</label>
            <input
              className="input-base"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="b2b saas / ecommerce / local services…"
            />
          </div>
          <div>
            <label className="label">your platform</label>
            <input
              className="input-base"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="Google Search / Meta Feed / TikTok…"
            />
          </div>
          {error ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
              {error}
            </div>
          ) : null}
          <RequireKeyAction what="the AI explainer">
            <button onClick={explain} disabled={running} className="btn-primary w-full">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {running ? "explaining" : "explain it"}
            </button>
          </RequireKeyAction>
        </div>

        <div className="lg:col-span-2 border border-base-600 bg-base-900/40 p-5 min-h-[300px]">
          {!stream.text && !running ? (
            <p className="text-sm text-ink-muted font-mono uppercase tracking-ui-wide text-[11px]">
              add context (optional) then explain — Claude will write a 30-second + deep-dive primer.
            </p>
          ) : null}
          {stream.text ? (
            <div className={running ? "caret" : ""}>
              <Markdown text={stream.text} />
            </div>
          ) : null}
          {done ? (
            <div className="mt-4 pt-3 border-t border-base-700 flex justify-end">
              <CopyButton text={stream.text} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
