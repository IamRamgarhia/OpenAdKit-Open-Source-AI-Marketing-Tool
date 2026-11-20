"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, X, StopCircle, Save } from "lucide-react";
import { PROVIDERS, getProvider } from "@/lib/providers";
import { llmStream, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { getProviderKey, getProvidersWithKeys, addUsage, getLanguage, getToneOverride } from "@/lib/settings";
import { getBrain, saveAd, type GeneratedAd } from "@/lib/storage";
import { buildBrandSystemPrompt } from "@/lib/brand-brain";
import { assertWithinBudget } from "@/lib/budget";
import { formatCost } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";
import { readAdGenMeta, withGenMeta, type AdGenMeta } from "@/lib/ad-meta";
import { resolveMaxTokens, schemaForCampaignType } from "@/lib/generator-registry";

/**
 * Re-run a saved generation against a different model/provider and compare the
 * two outputs side by side.
 *
 * The value here is model shopping with a real workload: "is Opus actually
 * better than Groq's free Llama for MY brand's ad copy?" was previously
 * unanswerable without manually re-typing the whole form. Everything needed is
 * already on the ad — the stored prompt, the brand it belongs to — so this is
 * a read of existing data plus one call.
 *
 * The system prompt is rebuilt from the brand at run time rather than replayed
 * from the ad, so a comparison always reflects the CURRENT brand brain.
 */
/** Module-level so the id/timestamp generation stays out of render scope. */
function buildRegeneratedCopy(
  ad: GeneratedAd,
  r: {
    output: string;
    parsed: unknown;
    modelId: string;
    providerId: string;
    result: { cost: number; inTok: number; outTok: number };
    maxTokens: number;
    hasImage?: boolean;
  }
) {
  return withGenMeta(
    {
      ...ad,
      id: crypto.randomUUID(),
      title: `${ad.title} · ${r.modelId}`,
      output_text: r.output,
      output_json: r.parsed,
      model_id: r.modelId,
      provider_id: r.providerId,
      usage_input_tokens: r.result.inTok,
      usage_output_tokens: r.result.outTok,
      cost_usd: r.result.cost,
      created_at: Date.now(),
      starred: false,
      status: "draft",
      notes: `Regenerated from ${ad.model_id} for comparison`,
      performance: undefined,
      deleted_at: undefined,
    },
    { max_tokens: r.maxTokens, has_image: r.hasImage }
  );
}

export function RegenerateDialog({ ad, onClose }: { ad: GeneratedAd; onClose: (saved: boolean) => void }) {
  const configured = useMemo(() => new Set(getProvidersWithKeys()), []);
  const usable = useMemo(() => PROVIDERS.filter((p) => configured.has(p.id)), [configured]);

  const [providerId, setProviderId] = useState<string>(() => usable[0]?.id ?? "");
  const [modelId, setModelId] = useState<string>(() => usable[0]?.default_model ?? "");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cost: number; inTok: number; outTok: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [meta, setMeta] = useState<AdGenMeta>({});
  const [parsedNew, setParsedNew] = useState<unknown>(null);
  const [shapeWarning, setShapeWarning] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const provider = getProvider(providerId);
  // Keep the model valid for the chosen provider (derived, not synced in an effect).
  const effectiveModel =
    provider && !provider.models.some((m) => m.id === modelId) ? provider.default_model : modelId;
  // Token budget: what the original run used (saved on the ad), else that
  // tool's default. A hard-coded 3000 truncated long-output tools.
  const maxTokens = resolveMaxTokens(meta.max_tokens, ad.campaign_type);

  useEffect(() => {
    let cancelled = false;
    readAdGenMeta(ad.id).then((m) => {
      if (!cancelled) setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [ad.id]);

  // Escape closes, matching the rest of the app's dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) onClose(saved);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, saved, onClose]);

  async function run() {
    if (!ad.prompt) return;
    setError(null);
    setOutput("");
    setResult(null);
    setSaved(false);
    setParsedNew(null);
    setShapeWarning(null);

    try {
      await assertWithinBudget();
    } catch (e: any) {
      setError(e?.message ?? "Monthly budget reached.");
      return;
    }

    const key = getProviderKey(providerId);
    if (!key) {
      setError(`No saved key for ${provider?.name ?? providerId}.`);
      return;
    }

    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Rebuild the system prompt from the CURRENT brand so the comparison
      // reflects any brand-brain edits since the original run.
      const brain = ad.brand_id ? (await getBrain(ad.brand_id)) ?? null : null;
      const system = buildBrandSystemPrompt(brain, {
        language: getLanguage(),
        tone_override: getToneOverride(),
      });
      let acc = "";
      const res = await llmStream(
        {
          system,
          messages: [{ role: "user", content: ad.prompt }],
          maxTokens,
          temperature: 0.7,
          signal: controller.signal,
          providerOverride: provider ?? undefined,
          modelOverride: effectiveModel,
          apiKeyOverride: key,
        },
        {
          onDelta: (d) => {
            acc += d;
            setOutput(acc);
          },
        }
      );
      const text = res.text || acc;
      setOutput(text);
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      const inTok = res.usage?.input_tokens ?? 0;
      const outTok = res.usage?.output_tokens ?? 0;
      addUsage(cost, inTok, outTok);
      window.dispatchEvent(new Event("ados:usage"));
      setResult({ cost, inTok, outTok });
      // Validate against the tool's schema when one exists, so a reply that
      // can't render in the tool isn't silently kept as structured output.
      const json = tryParseJson(text);
      const schema = schemaForCampaignType(ad.campaign_type);
      if (schema) {
        const check = json !== null ? schema.safeParse(json) : null;
        if (check?.success) setParsedNew(check.data);
        else
          setShapeWarning(
            "This reply doesn't match the tool's expected JSON shape, so it would only be kept as raw text. Try another model."
          );
      } else {
        setParsedNew(json);
      }
    } catch (e: any) {
      setError(e?.name === "AbortError" ? "Stopped." : e?.message ?? "Regeneration failed.");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  async function saveAsNew() {
    if (!output || !result) return;
    const copy = buildRegeneratedCopy(ad, {
      output,
      parsed: parsedNew,
      modelId: effectiveModel,
      providerId,
      result,
      maxTokens,
      hasImage: meta.has_image,
    });
    await saveAd(copy);
    setSaved(true);
  }

  if (!usable.length) {
    return (
      <Shell onClose={() => onClose(false)} title="Regenerate & compare">
        <p className="text-sm text-ink-muted">
          No providers with saved keys. Add one in <a href="/settings" className="text-live underline">Settings</a>.
        </p>
      </Shell>
    );
  }

  if (!ad.prompt) {
    return (
      <Shell onClose={() => onClose(false)} title="Regenerate & compare">
        <p className="text-sm text-ink-muted leading-relaxed">
          This generation predates prompt capture, so it can&apos;t be re-run automatically. Anything
          you generate from now on can be. Open the original tool and re-run it there to compare models.
        </p>
      </Shell>
    );
  }

  return (
    <Shell onClose={() => onClose(saved)} title="Regenerate & compare">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="label" htmlFor="regen-provider">provider</label>
          <select
            id="regen-provider"
            className="input-base"
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
              const p = getProvider(e.target.value);
              if (p) setModelId(p.default_model);
            }}
            disabled={running}
          >
            {usable.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="label" htmlFor="regen-model">model</label>
          <select
            id="regen-model"
            className="input-base"
            value={effectiveModel}
            onChange={(e) => setModelId(e.target.value)}
            disabled={running}
          >
            {provider?.models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <button onClick={run} disabled={running} className="btn-primary">
          {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {running ? "running" : "run"}
        </button>
        {running ? (
          <button onClick={() => abortRef.current?.abort()} className="btn-ghost" title="Stop">
            <StopCircle size={12} />
          </button>
        ) : null}
      </div>

      {meta.has_image ? (
        <div role="note" className="border border-info/40 bg-info/5 text-info text-[11px] px-3 py-2" data-testid="regen-image-warning">
          The original run included an image. Images aren't stored, so this re-run sends the text prompt only — the
          new model won't see the screenshot, and results aren't a like-for-like comparison.
        </div>
      ) : null}

      {shapeWarning ? (
        <div className="border border-live/40 bg-live/5 text-live text-[11px] px-3 py-2">{shapeWarning}</div>
      ) : null}

      {error ? (
        <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
          {error}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        <Pane
          label={`original · ${ad.model_id}`}
          sub={`${formatCost(ad.cost_usd)} · ${new Date(ad.created_at).toLocaleDateString()}`}
          text={ad.output_text}
        />
        <Pane
          label={`new · ${effectiveModel || "—"}`}
          sub={result ? `${formatCost(result.cost)} · in ${result.inTok} · out ${result.outTok}` : running ? "streaming…" : "not run yet"}
          text={output}
          highlight
        />
      </div>

      {output && !running ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          {saved ? (
            <span className="text-[10px] font-mono uppercase tracking-ui-mega text-pos flex items-center gap-1.5">
              <Save size={10} /> saved as a new entry
            </span>
          ) : (
            <button onClick={saveAsNew} className="btn-primary">
              <Save size={12} /> keep as new entry
            </button>
          )}
        </div>
      ) : null}
    </Shell>
  );
}

function Pane({ label, sub, text, highlight }: { label: string; sub: string; text: string; highlight?: boolean }) {
  return (
    <div className={`border ${highlight ? "border-live/40" : "border-base-700"} bg-base-950/50`}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-base-700">
        <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint truncate">{label}</span>
        <div className="flex-1" />
        <span className="text-[10px] font-mono text-ink-subtle tabular shrink-0">{sub}</span>
        {text ? <CopyButton text={text} /> : null}
      </div>
      <pre className="max-h-[45vh] overflow-auto p-3 text-[11px] font-mono whitespace-pre-wrap text-ink">
        {text || "—"}
      </pre>
    </div>
  );
}

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-base-950/80 backdrop-blur-xs grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl border border-base-600 bg-base-900 p-5 space-y-3 max-h-[90vh] overflow-auto">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted flex-1">{title}</h2>
          <button onClick={onClose} className="btn-ghost" aria-label="Close">
            <X size={12} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
