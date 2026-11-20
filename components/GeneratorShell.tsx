"use client";

import { Fragment, Suspense, memo, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Save, AlertTriangle, StopCircle } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { CopyButton } from "@/components/CopyButton";
import { useThrottledStream } from "@/lib/stream-hook";
import { getApiKey, getModel, getActiveBrainId, addUsage, getLanguage, getToneOverride, getAutoSave } from "@/lib/settings";
import { streamClaude, estimateCostUsd, tryParseJson, llmStream, llmCall, type LLMMessage } from "@/lib/llm";
import { getProvider, type Provider } from "@/lib/providers";
import { getProviderKey } from "@/lib/settings";
import { getAd, getBrain, saveAd, type Platform } from "@/lib/storage";
import { withGenMeta } from "@/lib/ad-meta";
import { applyQueryOverrides, prefillFromSavedInput, persistableInput } from "@/lib/generator-prefill";
import { CampaignPicker } from "@/components/CampaignPicker";
import { buildBrandSystemPrompt, type BrandBrain } from "@/lib/brand-brain";
import { applySmartFill } from "@/lib/smart-fill";
import { rememberLastGenerated, suggestNextSteps, type NextStep } from "@/lib/next-steps";
import { assertWithinBudget } from "@/lib/budget";
import { getQuotaSnapshot, formatCountdown } from "@/lib/quota-tracker";
import { formatCost } from "@/lib/utils";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";
import { providerSupportsVision, fileToImagePart, pickVisionProvider, MAX_IMAGE_MB } from "@/lib/providers/vision";
import { getActiveProviderId } from "@/lib/settings";
import type { ContentPart, ImagePart } from "@/lib/providers/types";
import Link from "next/link";
import type { GeneratorConfig, InputField } from "@/lib/generator-config";

interface Props<I extends Record<string, unknown>> {
  config: GeneratorConfig<I>;
  scope: string;
}

export function GeneratorShell<I extends Record<string, unknown>>({ config, scope }: Props<I>) {
  return (
    <ApiKeyGate>
      <Suspense fallback={null}>
        <Inner config={config} scope={scope} />
      </Suspense>
    </ApiKeyGate>
  );
}

/** Everything needed to persist one finished run — kept so a run made with
 *  auto-save OFF can still be saved by hand. */
interface RunResult {
  json: any;
  text: string;
  modelId: string;
  providerId?: string;
  inTokens: number;
  outTokens: number;
  cost: number;
  prompt: string;
  input: Record<string, unknown>;
  brainId: string;
  platform: Platform;
  title: string;
  maxTokens: number;
  hasImage: boolean;
}

function Inner<I extends Record<string, unknown>>({ config, scope }: Props<I>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [input, setInput] = useState<I>(config.initial);
  const [brain, setBrain] = useState<BrandBrain | null>(null);
  const [running, setRunning] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking advisory — vision fallback, etc. Separate from error so it
  // renders in info-blue instead of error-red and doesn't make a successful
  // generation look like a failure. (Audit finding #10.)
  const [warning, setWarning] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [hasRun, setHasRun] = useState(false);
  // True when the model's first reply failed schema validation and we
  // auto-corrected via a retry round-trip. UI shows a small badge so the user
  // knows the result is valid but came from attempt #2. (No false results.)
  const [schemaRecovered, setSchemaRecovered] = useState(false);
  // Usage for THIS run. The StatusBar only ever showed a lifetime total, so
  // there was no way to see what a single generation actually cost you.
  const [lastRun, setLastRun] = useState<{
    inTokens: number;
    outTokens: number;
    cost: number;
    modelId: string;
    providerId: string;
    retried: boolean;
  } | null>(null);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [fillToast, setFillToast] = useState<string | null>(null);
  const stream = useThrottledStream();
  const abortRef = useRef<AbortController | null>(null);
  // Live "is a generation in flight" flag for the brain-switch listener.
  // Switching active brand mid-generation must not swap the brain under the
  // in-flight closure (output built against the OLD brain but displayed under
  // the NEW brand name — audit finding #25). Written synchronously in run().
  const runningRef = useRef(false);
  // A brand switch / edit that arrived DURING a run. It used to be dropped
  // (loadBrain returned early and never re-ran), so after the run the form
  // kept using the previous client. Replayed in run()'s finally.
  const pendingReloadRef = useRef<{ resetForm: boolean } | null>(null);
  const loadBrainRef = useRef<((opts?: { resetForm?: boolean }) => Promise<void>) | null>(null);
  const adPrefillDoneRef = useRef(false);

  useEffect(() => {
    const loadBrain = async (opts: { resetForm?: boolean } = {}) => {
      if (runningRef.current) {
        pendingReloadRef.current = {
          resetForm: Boolean(pendingReloadRef.current?.resetForm || opts.resetForm),
        };
        return;
      }
      const id = getActiveBrainId();
      const b = id ? (await getBrain(id)) ?? null : null;

      // ?ad_id=<id> — arriving from a next step such as "Apply rewrite as a
      // new variant". Hydrate the form from that saved ad's inputs, once.
      let saved: Record<string, unknown> | null = null;
      const adId = searchParams?.get("ad_id");
      if (adId && !adPrefillDoneRef.current && !opts.resetForm) {
        adPrefillDoneRef.current = true;
        const ad = await getAd(adId);
        if (ad) {
          saved = ad.input;
          setFillToast(`Pre-filled from "${ad.title.slice(0, 60)}". Edit anything before generating.`);
        }
      }

      setBrain(b);
      // Smart-fill behavior:
      //   - On initial load + on brain attribute edits: top-up empty fields only.
      //   - On active-client SWITCH: reset form to defaults, then auto-fill from
      //     the new brain, so the previous client's industry / audience don't
      //     linger in the form.
      // Precedence: brand smart-fill < saved ad inputs < explicit URL params.
      const hydrate = (base: I): I => {
        let next = applySmartFill(config.fields, base, b) as I;
        if (saved) next = prefillFromSavedInput(next, saved, config.fields).input;
        return applyQueryOverrides(next, searchParams, config.fields);
      };
      if (opts.resetForm) setInput(hydrate(config.initial));
      else setInput((cur) => hydrate(cur));
    };
    loadBrainRef.current = loadBrain;
    loadBrain();
    const handleBrainsChanged = () => loadBrain();
    const handleClientSwitched = () => loadBrain({ resetForm: true });
    window.addEventListener("ados:brains-changed", handleBrainsChanged);
    window.addEventListener("ados:active-brain-changed", handleClientSwitched);
    return () => {
      window.removeEventListener("ados:brains-changed", handleBrainsChanged);
      window.removeEventListener("ados:active-brain-changed", handleClientSwitched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fillToast) return;
    const t = setTimeout(() => setFillToast(null), 4000);
    return () => clearTimeout(t);
  }, [fillToast]);

  const setField = useCallback((name: string, value: unknown) => {
    setInput((cur) => ({ ...cur, [name]: value }));
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !running) {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, input, brain]);

  /** Persist a finished run to history. Runs automatically when auto-save is
   *  on; otherwise from the "Save to history" button. */
  async function saveResult(r: RunResult) {
    setSaving(true);
    try {
      const ad = withGenMeta(
        {
          id: crypto.randomUUID(),
          brand_id: r.brainId,
          platform: r.platform,
          campaign_type: config.campaign_type,
          title: r.title,
          input: r.input,
          output_json: r.json,
          output_text: r.text,
          model_id: r.modelId,
          usage_input_tokens: r.inTokens,
          usage_output_tokens: r.outTokens,
          cost_usd: r.cost,
          starred: false,
          status: "draft",
          notes: "",
          created_at: Date.now(),
          // Enables regenerate-and-compare from /history against a different
          // model without the history page needing every generator's builder.
          prompt: r.prompt,
          provider_id: r.providerId,
        },
        // Regenerate reuses this budget instead of a hard-coded 3000, and
        // warns that an image-based run can't resend its image.
        { max_tokens: r.maxTokens, has_image: r.hasImage }
      );
      await saveAd(ad);
      setSavedId(ad.id);
      rememberLastGenerated({
        id: ad.id,
        title: ad.title,
        platform: ad.platform,
        campaign_type: ad.campaign_type,
        brand_id: ad.brand_id,
        saved_at: ad.created_at,
      });
      setNextSteps(suggestNextSteps({ route: pathname ?? scope, ad_id: ad.id, input: r.input }));
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save to history.");
    } finally {
      setSaving(false);
    }
  }

  async function run() {
    setError(null);
    setWarning(null);
    setSavedId(null);
    setResult(null);
    setNextSteps([]);
    setParsed(null);
    setSchemaRecovered(false);
    setLastRun(null);
    stream.reset();

    // Validate required fields. Image fields are required if their value is null.
    const missing = config.fields.filter((f) => {
      if (!f.required) return false;
      const v = (input as any)[f.name];
      if (f.kind === "image") return !v;
      return !String(v ?? "").trim();
    });
    if (missing.length) {
      setError(`Required: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("No API key. Add one in Settings.");
      return;
    }

    // Monthly spend ceiling. Advisory by default; only blocks when the user
    // explicitly enabled the hard stop in Settings.
    try {
      const budget = await assertWithinBudget();
      if (budget.warning && !budget.exceeded) {
        setWarning(
          `Budget: $${budget.spentUsd.toFixed(2)} of $${budget.limitUsd.toFixed(2)} used this month ($${budget.remainingUsd.toFixed(2)} left).`
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Monthly budget reached.");
      return;
    }

    // Vision capability check: if any image fields have a value, the active
    // provider+model must support vision. When it doesn't, we either auto-pick
    // a vision-capable fallback (if the user has a key for one) or hard-fail
    // with a specific switch suggestion.
    const imageFields = config.fields.filter((f) => f.kind === "image");
    const attachedImages: ImagePart[] = imageFields
      .map((f) => (input as any)[f.name])
      .filter((v): v is ImagePart => Boolean(v && (v as ImagePart).type === "image"));
    // Vision fallback provider for THIS run only. Kept in a local variable rather
    // than stashed on the `input` state object — mutating state directly caused
    // stale routing and leaked the internal key into persisted ads. (Audit #.)
    let visionFallbackId: string | undefined;
    if (attachedImages.length) {
      const providerId = getActiveProviderId() as any;
      if (!providerId || !providerSupportsVision(providerId, getModel())) {
        const fallback = pickVisionProvider(providerId);
        if (fallback) {
          setWarning(
            `Active provider can't read images. Falling back to ${fallback} for this run only. Make it permanent in Settings.`
          );
          visionFallbackId = fallback;
        } else {
          setError(
            "Active provider can't read images, and no vision-capable provider has a saved key. Add a key for Claude / OpenAI / Gemini / OpenRouter in Settings, or remove the screenshot."
          );
          return;
        }
      }
    }

    // Snapshot what this run uses, so edits made while it streams can't leak
    // into what gets saved.
    const runBrain = brain;
    const runInput = input;
    const maxTokens = config.maxTokens ?? 3000;

    runningRef.current = true;
    setRunning(true);
    setHasRun(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let promptInput: I = runInput;
      if (config.prepareInput) {
        const prep = await config.prepareInput(runInput, controller.signal);
        promptInput = prep.input;
        if (prep.warning) setWarning((w) => (w ? `${w} ${prep.warning}` : prep.warning!));
      }
      const system = buildBrandSystemPrompt(runBrain, {
        language: getLanguage(),
        tone_override: getToneOverride(),
        skip_framework_stack: config.skip_framework_stack,
      });
      const prompt = config.buildPrompt(promptInput, runBrain);
      // Build content. With no images, send a plain string for cheapest path.
      // With images, send the array of parts (images first → text last is the
      // convention all three vision-capable providers expect).
      const content: string | ContentPart[] = attachedImages.length
        ? [...attachedImages, { type: "text", text: prompt }]
        : prompt;

      // If the vision fallback was triggered above, pass the override down so
      // llmStream resolves the call against that provider instead of the
      // active one. The user-facing toast already explained the swap.
      const fallbackProvider: Provider | null = visionFallbackId ? getProvider(visionFallbackId) ?? null : null;
      const fallbackKey = fallbackProvider ? getProviderKey(fallbackProvider.id) : undefined;

      const res = fallbackProvider
        ? await llmStream(
            {
              system,
              messages: [{ role: "user", content }],
              maxTokens,
              temperature: config.temperature ?? 0.7,
              signal: controller.signal,
              providerOverride: fallbackProvider,
              apiKeyOverride: fallbackKey,
            },
            { onDelta: stream.append }
          )
        : await streamClaude(
            {
              apiKey,
              // `|| undefined` matters: getModel() returns "" when no provider
              // is active, and an empty string passed as modelOverride BEATS
              // the provider's own default in resolve(), producing a 404 from
              // the API instead of a clear error.
              model: getModel() || undefined,
              system,
              messages: [{ role: "user", content }],
              maxTokens,
              temperature: config.temperature ?? 0.7,
              signal: controller.signal,
            },
            { onDelta: stream.append }
          );

      // Three-arg form so vision-fallback runs bill against the correct
      // pricing table. Mutable: a schema-correction retry below adds its own
      // cost and tokens, and the SAVED AD must reflect the true total.
      let cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      let inTokens = res.usage?.input_tokens ?? 0;
      let outTokens = res.usage?.output_tokens ?? 0;
      addUsage(cost, inTokens, outTokens);
      window.dispatchEvent(new Event("ados:usage"));

      // Some providers (Gemini in particular) occasionally return res.text empty
      // even when streaming deltas worked correctly. getText() reads the live
      // buffer — the closure's stream.text is the stale pre-generation "".
      const finalText = res.text || stream.getText();

      let json: any = null;
      let finalTextOut = finalText;
      if (config.expectJson !== false) {
        json = tryParseJson(finalText);
        // Schema-validated outputs: on failure, ONE non-streaming retry with
        // the validation errors so the model can self-correct. UI either sees
        // the expected shape or a clear error, never a partial/wrong shape.
        if (config.schema) {
          const candidate = json;
          const first = config.schema.safeParse(candidate);
          if (first.success) {
            json = first.data;
          } else {
            const issues = first.error.issues
              .slice(0, 8)
              .map((i: any) => `- ${i.path.join(".") || "<root>"}: ${i.message}`)
              .join("\n");
            try {
              // Re-send the ORIGINAL content (incl. images), not just the text.
              const retryMessages: LLMMessage[] = [
                { role: "user", content },
                { role: "assistant", content: (finalText || "").slice(0, 8000) },
                {
                  role: "user",
                  content: `Your previous reply did not match the required JSON shape. Fix these issues and return ONLY the corrected JSON — no prose, no markdown, no code fences:\n\n${issues}`,
                },
              ];
              const retry = await llmCall({
                system,
                messages: retryMessages,
                maxTokens,
                temperature: 0.2,
                signal: controller.signal,
                ...(fallbackProvider
                  ? { providerOverride: fallbackProvider, apiKeyOverride: fallbackKey }
                  : {}),
              });
              const retryCost = estimateCostUsd(retry.providerId, retry.modelId, retry.usage);
              const retryIn = retry.usage?.input_tokens ?? 0;
              const retryOut = retry.usage?.output_tokens ?? 0;
              addUsage(retryCost, retryIn, retryOut);
              cost += retryCost;
              inTokens += retryIn;
              outTokens += retryOut;
              window.dispatchEvent(new Event("ados:usage"));
              const retried = tryParseJson(retry.text ?? "");
              const second = retried !== null ? config.schema.safeParse(retried) : null;
              if (second?.success) {
                json = second.data;
                finalTextOut = retry.text ?? finalText;
                setSchemaRecovered(true);
              } else {
                setError(
                  "Model returned a shape we couldn't use, even after a correction pass. Try a different provider — Claude / GPT / Gemini are most reliable for structured output."
                );
                json = null;
              }
            } catch (retryErr: any) {
              if (retryErr?.name === "AbortError") throw retryErr;
              setError(
                "Schema validation failed and the correction pass also failed. Try again or switch providers."
              );
              json = null;
            }
          }
        }
        setParsed(json);
      }

      // Record what this single run consumed, including any correction retry.
      setLastRun({
        inTokens,
        outTokens,
        cost,
        modelId: res.modelId,
        providerId: res.providerId ?? getActiveProviderId() ?? "",
        retried: inTokens !== (res.usage?.input_tokens ?? 0),
      });

      const r: RunResult = {
        json,
        text: finalTextOut,
        modelId: res.modelId,
        providerId: res.providerId,
        inTokens,
        outTokens,
        cost,
        prompt,
        // Never persist internal, double-underscore-prefixed keys — they're
        // transient routing / prompt hints, not user input.
        input: persistableInput(runInput as Record<string, unknown>),
        brainId: runBrain?.id ?? "",
        platform: config.platformFor ? config.platformFor(runInput) : config.platform,
        title: config.buildTitle(runInput),
        maxTokens,
        hasImage: attachedImages.length > 0,
      };
      setResult(r);
      if (getAutoSave()) await saveResult(r);
    } catch (e: any) {
      if (e?.name === "AbortError") setError("Generation stopped.");
      else setError(e?.message ?? "Generation failed");
    } finally {
      runningRef.current = false;
      setRunning(false);
      abortRef.current = null;
      const pending = pendingReloadRef.current;
      pendingReloadRef.current = null;
      if (pending) void loadBrainRef.current?.(pending);
    }
  }

  return (
    <div>
      <PageHeader scope={scope} title={config.title} subtitle={config.subtitle} showLive={running} />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2 space-y-4">
          <div className="border border-base-600 bg-base-900/40 p-5 space-y-3 animate-fade-up">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink">
              <span className="h-2 w-2 bg-live" />
              <span>Input</span>
              <div className="flex-1" />
              <span className="text-[11px] font-normal normal-case tracking-normal text-ink-muted">
                {config.fields.filter(f => f.required).length} required
              </span>
            </div>

            {!brain ? (
              <div className="border border-live/40 bg-live/6 px-4 py-3">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-live" />
                  <div className="text-[13px] text-ink">
                    <div className="font-medium text-live">Output will be generic without a client.</div>
                    <p className="text-ink-muted text-[12px] mt-1 leading-relaxed">
                      Every OpenAdKit tool reads the active client's brand brain — voice, audience, USP, content pillars. Without one, the AI defaults to neutral DR copy. Takes ~10 seconds to set up by pasting a website URL.
                    </p>
                  </div>
                </div>
                <a href="/brand/new" className="btn-primary text-[12px]">
                  ✨ Add your first client
                </a>
                {fillToast ? (
                  <div className="mt-2 text-[11px] text-pos font-mono uppercase tracking-ui-wide animate-fade-up" role="status">
                    ✓ {fillToast}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="border border-live/30 bg-live/5 px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 bg-pos rounded-full" />
                  <span className="text-ink-muted">Active brand: <span className="text-pos font-medium">{brain.name || brain.business_name}</span></span>
                  <div className="flex-1" />
                  <span className="text-[11px] text-ink-faint hidden md:inline">Saved to history under this brand</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = applySmartFill(config.fields, input as any, brain) as I;
                    // Count fields that actually changed so the user sees what happened.
                    let filled = 0;
                    for (const f of config.fields) {
                      if ((input as any)[f.name] !== (next as any)[f.name]) filled++;
                    }
                    setInput(next);
                    setFillToast(
                      filled === 0
                        ? "All fields already match — nothing to fill."
                        : `Filled ${filled} field${filled === 1 ? "" : "s"} from ${brain.name || brain.business_name}. Edit anything that looks off.`
                    );
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-live text-base-950 font-semibold text-[13px] hover:bg-live/90 transition"
                  title="Auto-fill empty fields from this client's brand brain"
                >
                  <Sparkles size={13} />
                  <span>Auto-fill from {brain.name || brain.business_name}</span>
                </button>
                {fillToast ? (
                  <div className="text-[11px] text-pos font-mono uppercase tracking-ui-wide animate-fade-up" role="status">
                    ✓ {fillToast}
                  </div>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {config.fields.map((f, i) => {
                const prevSection = i > 0 ? config.fields[i - 1].section : undefined;
                const showHeading = f.section && f.section !== prevSection;
                return (
                  <Fragment key={f.name}>
                    {showHeading ? (
                      <div className="col-span-2 mt-2 first:mt-0">
                        <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live pb-1 border-b border-base-700">
                          {f.section}
                        </div>
                      </div>
                    ) : null}
                    <FieldRenderer
                      field={f}
                      value={(input as any)[f.name]}
                      onChange={(v) => setField(f.name, v)}
                    />
                  </Fragment>
                );
              })}
            </div>

            {error ? (
              <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
                {error}
              </div>
            ) : null}

            {warning ? (
              <div className="border border-info/40 bg-info/5 text-info text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
                {warning}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2 border-t border-base-700">
              <button onClick={run} disabled={running} className="btn-primary flex-1">
                {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {running ? "generating" : "generate"}
                <span className="ml-auto kbd hidden md:inline-flex">⌘↵</span>
              </button>
              {running ? (
                <button onClick={stop} className="btn-ghost" title="Stop" aria-label="Stop generation">
                  <StopCircle size={12} />
                </button>
              ) : null}
            </div>

            {/* Auto-save OFF used to leave a finished run with no way to keep
                it (and next steps never appeared). */}
            {result && !savedId && !running ? (
              <button
                onClick={() => saveResult(result)}
                disabled={saving}
                className="btn-ghost w-full"
                data-testid="save-to-history"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Save to history
              </button>
            ) : null}

            {savedId ? (
              <div className="space-y-2">
                <div className="text-[10px] text-pos flex items-center gap-1.5 font-mono uppercase tracking-ui-mega">
                  <Save size={10} /> saved to history
                </div>
                <CampaignPicker adId={savedId} brandId={result?.brainId ?? brain?.id ?? ""} compact />
              </div>
            ) : null}
          </div>
        </section>

        <section className="lg:col-span-3 space-y-4">
          <OutputArea running={running} stream={stream.text} rawText={result?.text ?? ""} renderInput={(result?.input ?? input) as Record<string, unknown>} parsed={parsed} config={config as unknown as GeneratorConfig<Record<string, unknown>>} hasRun={hasRun} lastError={error} schemaRecovered={schemaRecovered} lastRun={lastRun} />
          {savedId && nextSteps.length ? <NextStepsPanel steps={nextSteps} /> : null}
        </section>
      </div>
    </div>
  );
}

function NextStepsPanel({ steps }: { steps: NextStep[] }) {
  return (
    <div className="border border-live/30 bg-live/3 p-4 rounded-md">
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-3 pb-2 border-b border-base-700">
        What's next · this asset is saved, here are the natural follow-ups
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => {
          const qs = s.carry ? "?" + new URLSearchParams(s.carry).toString() : "";
          return (
            <li key={s.href + (s.carry?.platform ?? "")}>
              <Link
                href={s.href + qs}
                className="flex items-start gap-3 px-2 py-1.5 hover:bg-base-800/40 transition rounded-xs"
              >
                <span className="text-live text-xs mt-0.5">→</span>
                <div className="flex-1">
                  <div className="text-sm text-ink">{s.label}</div>
                  <div className="text-[11px] text-ink-muted">{s.reason}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const FieldRenderer = memo(function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: InputField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const span = field.span === 2 || field.kind === "textarea" ? "col-span-2" : "col-span-2 md:col-span-1";
  // Deterministic id so the <label htmlFor> binds to the input. Without this,
  // screen readers announce inputs as unlabeled. (A11y audit fix.)
  const inputId = `field-${field.name}`;
  return (
    <div className={span}>
      <label className="label" htmlFor={inputId}>
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          id={inputId}
          rows={field.rows ?? 3}
          className="input-base"
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-required={field.required || undefined}
        />
      ) : field.kind === "select" ? (
        <select
          id={inputId}
          className="input-base"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-required={field.required || undefined}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "number" ? (
        <input
          id={inputId}
          type="number"
          className="input-base tabular"
          placeholder={field.placeholder}
          value={(value as number | string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          aria-required={field.required || undefined}
        />
      ) : field.kind === "image" ? (
        <ImageInput value={value as ImagePart | null} onChange={onChange} placeholder={field.placeholder} inputId={inputId} />
      ) : (
        <input
          id={inputId}
          className="input-base"
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-required={field.required || undefined}
        />
      )}
      {field.hint ? <p className="text-[10px] text-ink-subtle mt-1 font-mono uppercase tracking-ui-wide">{field.hint}</p> : null}
    </div>
  );
});

function ImageInput({
  value,
  onChange,
  placeholder,
  inputId,
}: {
  value: ImagePart | null;
  onChange: (v: ImagePart | null) => void;
  placeholder?: string;
  inputId?: string;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handle(file: File | null | undefined) {
    setErr(null);
    if (!file) return;
    setBusy(true);
    try {
      const part = await fileToImagePart(file);
      onChange(part);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    const dataUrl = `data:${value.media_type};base64,${value.data}`;
    return (
      <div className="border border-base-700 bg-base-900/40 p-2 rounded-md">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="upload preview" className="h-20 w-20 object-cover border border-base-700" />
          <div className="flex-1 text-[11px] text-ink-muted">
            <div>Image ready · {value.media_type} · {Math.round((value.data.length * 3) / 4 / 1024)} KB</div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[10px] text-neg hover:underline font-mono uppercase tracking-ui-wide mt-1"
            >
              remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full border border-dashed border-base-600 bg-base-900/30 hover:border-base-500 hover:bg-base-800/40 transition px-3 py-4 text-xs text-ink-muted"
      >
        {busy ? "Reading image…" : placeholder ?? `Drop a screenshot here or click to upload (PNG / JPEG / WebP / GIF · ≤ ${MAX_IMAGE_MB} MB)`}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
        aria-label={placeholder ?? "Upload image"}
      />
      {err ? <p className="text-[10px] text-neg mt-1 font-mono uppercase tracking-ui-wide">{err}</p> : null}
    </div>
  );
}

/**
 * Surfaces framework_meta the AI returns alongside structured JSON output.
 * The framework stack in the system prompt asks for awareness_level /
 * framework_used / u_scores — this component renders them as a tight pill row
 * above the main output so users see why the AI made the calls it did.
 *
 * Looks for the metadata in two shapes: top-level `framework_meta` (added by
 * the wizard-era prompts) OR top-level `awareness_level` (older direct shape).
 */
function FrameworkMetaPill({ json }: { json: any }) {
  const meta = json?.framework_meta ?? json;
  const aw = meta?.awareness_level;
  const fw = meta?.framework_used;
  const us = meta?.u_scores;
  if (!aw && !fw && !us) return null;
  const total = us ? (us.useful ?? 0) + (us.urgent ?? 0) + (us.unique ?? 0) + (us.ultra_specific ?? 0) : null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-ui-wide border border-base-700 bg-base-900/30 px-2 py-1.5">
      <span className="text-ink-faint">framework:</span>
      {aw ? <span className="text-info">{String(aw).replace(/_/g, " ")}</span> : null}
      {aw && fw ? <span className="text-ink-faint">·</span> : null}
      {fw ? <span className="text-live">{fw}</span> : null}
      {total !== null ? (
        <>
          <span className="text-ink-faint">·</span>
          <span className={total >= 12 ? "text-pos" : total >= 8 ? "text-live" : "text-neg"}>
            U-score {total}/16
          </span>
        </>
      ) : null}
    </div>
  );
}

/** Live countdown while a provider has us rate-limited, driven by the
 *  retry-after the provider itself returned (recorded in quota-tracker). */
function RateLimitCountdown() {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const snap = getQuotaSnapshot(getActiveProviderId());
      setSecs(snap?.blocked_for_seconds ?? null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!secs || secs <= 0) return null;
  return (
    <p className="text-[12px] text-ink">
      Retry available in <span className="text-live font-medium tabular">{formatCountdown(secs)}</span>.
    </p>
  );
}

/** What this single generation consumed. */
function UsageStrip({
  run,
}: {
  run: { inTokens: number; outTokens: number; cost: number; modelId: string; retried: boolean };
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-ui-wide border border-base-700 bg-base-900/30 px-2 py-1.5 text-ink-faint">
      <span>this run</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink tabular">{run.inTokens.toLocaleString()} in</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink tabular">{run.outTokens.toLocaleString()} out</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink tabular">{(run.inTokens + run.outTokens).toLocaleString()} total</span>
      <span className="text-ink-faint">·</span>
      <span className="text-live tabular font-medium">{formatCost(run.cost)}</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink-subtle normal-case tracking-normal">{run.modelId}</span>
      {run.retried ? (
        <span className="text-live" title="Includes a schema-correction retry, which cost extra tokens.">
          · incl. retry
        </span>
      ) : null}
    </div>
  );
}

const OutputArea = memo(function OutputArea<I extends Record<string, unknown>>({
  running,
  stream,
  rawText,
  renderInput,
  parsed,
  config,
  hasRun,
  lastError,
  schemaRecovered,
  lastRun,
}: {
  running: boolean;
  stream: string;
  /** Final text of the finished run — after a schema retry this is the
   *  corrected reply, not the failed first attempt that `stream` holds. */
  rawText?: string;
  renderInput?: Record<string, unknown>;
  parsed: any;
  config: GeneratorConfig<I>;
  hasRun: boolean;
  lastError?: string | null;
  schemaRecovered?: boolean;
  lastRun?: { inTokens: number; outTokens: number; cost: number; modelId: string; providerId: string; retried: boolean } | null;
}) {
  // Detect a rate-limit error from common provider phrasings so we can give a
  // direct, actionable message instead of generic "your key may be invalid".
  const isRateLimit = lastError ? /rate limit|quota|too many requests|429|retry in/i.test(lastError) : false;
  // First-load empty state — only before any run has happened
  if (!running && !stream && !parsed && !hasRun) {
    return (
      <div className="border border-dashed border-base-600 bg-base-900/20 text-sm text-ink-muted min-h-[260px] grid place-items-center">
        Output will stream here
      </div>
    );
  }

  // Generation finished with nothing — surface a clear error instead of staying silent
  if (!running && !stream && !parsed && hasRun) {
    if (isRateLimit) {
      // Specific rate-limit UI: actionable next steps + a link to switch
      // provider. Generic "API key invalid" hint is removed for this case
      // because the key obviously works — they just exceeded the quota.
      return (
        <div className="border border-live/40 bg-live/5 p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live flex items-center gap-2">
            <span className="h-1 w-1 bg-live" /> rate-limit hit (free-tier quota)
          </div>
          {/* The provider's OWN words, verbatim — not a paraphrase. */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">
              message returned by the provider
            </div>
            <pre className="text-[11px] font-mono text-live bg-base-900/60 px-2 py-1.5 whitespace-pre-wrap leading-relaxed">
              {lastError}
            </pre>
          </div>
          <RateLimitCountdown />
          <p className="text-[12px] text-ink-muted leading-relaxed">
            Your API key works fine — you've hit the per-minute / daily quota. Wait for the countdown, or switch provider now:
          </p>
          <ProviderSwitcher reason="rate-limit" />
        </div>
      );
    }
    return (
      <div className="border border-neg/40 bg-neg/5 p-5 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg flex items-center gap-2">
          <span className="h-1 w-1 bg-neg" /> empty response
        </div>
        {lastError ? (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">
              message returned by the provider
            </div>
            <pre className="text-[11px] font-mono text-neg bg-base-900/60 px-2 py-1.5 whitespace-pre-wrap leading-relaxed">
              {lastError}
            </pre>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink leading-relaxed">
              Your provider returned no content. This usually means:
            </p>
            <ul className="text-[12px] text-ink-muted list-disc list-inside space-y-0.5">
              <li>API key in <a href="/settings" className="text-live underline">Settings</a> is invalid or rate-limited</li>
              <li>Selected model doesn&apos;t support the request size — try a different model</li>
              <li>Free-tier quota exhausted — switch provider in Settings</li>
            </ul>
            <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-subtle">
              open browser devtools → network tab → re-run to see the actual response from the provider
            </p>
          </>
        )}
      </div>
    );
  }

  if (parsed && config.renderJson) {
    return (
      <div className="space-y-4 animate-fade-up">
        <FrameworkMetaPill json={parsed} />
        {schemaRecovered ? (
          <div
            role="status"
            className="text-[11px] font-mono uppercase tracking-ui-mega text-live border border-live/30 bg-live/4 px-2 py-1 inline-block"
            title="The model's first reply didn't match the expected structure, so we automatically re-asked it to correct the JSON. Content below was returned by the second attempt."
          >
            ↻ ai output auto-corrected (schema retry)
          </div>
        ) : null}
        {/* Above the output, not below it — generator results run long, and a
            cost readout you have to scroll past the whole result to find is a
            cost readout nobody reads. */}
        {lastRun ? <UsageStrip run={lastRun} /> : null}
        {config.renderJson(parsed, (renderInput ?? {}) as I)}
        <div className="flex items-center justify-end gap-2">
          <CopyButton text={rawText || stream} label="copy raw output" />
          <CopyButton text={JSON.stringify(parsed, null, 2)} label="copy parsed json" />
        </div>
      </div>
    );
  }

  // Live renderer while streaming (and for plain-text tools after). For JSON
  // tools it must NOT run once finished, or it hides the parse-failure panel.
  if (stream && config.renderStreaming && (running || config.expectJson === false)) {
    return <>{config.renderStreaming(stream)}</>;
  }

  // Have stream text but no parsed JSON (parse failed) — show raw with a warning
  if (stream && !parsed && config.expectJson !== false && !running) {
    return (
      <div className="space-y-3">
        <div className="border border-live/40 bg-live/5 px-3 py-2 text-[11px] font-mono uppercase tracking-ui-wide text-live">
          ⚠ json parse failed — showing raw response. you can still copy + paste the text below.
        </div>
        <div className="border border-base-600 bg-base-900/40 p-5">
          <div className="flex items-center justify-between mb-3 text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 bg-pos" />
              <span>raw output</span>
            </div>
            <CopyButton text={stream} />
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink">{stream}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-base-600 bg-base-900/40 p-5">
      <div className="flex items-center justify-between mb-3 text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle">
        <div className="flex items-center gap-2">
          <span className={running ? "h-1 w-1 bg-live animate-pulse-soft" : "h-1 w-1 bg-pos"} />
          <span>{running ? "streaming" : "output"}</span>
        </div>
        {!running ? <CopyButton text={stream} /> : null}
      </div>
      <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink ${running ? "caret" : ""}`}>
        {stream || "…"}
      </pre>
      {!running && lastRun ? <div className="mt-3"><UsageStrip run={lastRun} /></div> : null}
    </div>
  );
});
