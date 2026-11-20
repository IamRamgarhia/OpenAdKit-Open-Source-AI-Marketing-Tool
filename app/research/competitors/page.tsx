"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Sparkles, ExternalLink, StopCircle, Save, AlertTriangle } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";
import { useThrottledStream } from "@/lib/stream-hook";
import { getApiKey, getActiveBrainId, addUsage, getLanguage, getToneOverride } from "@/lib/settings";
import { llmStream, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { validateOrRetry, StructuredLlmError } from "@/lib/llm-structured";
import { CompetitorStealSchema } from "@/lib/schemas/generators";
import { getBrain, saveAd, type GeneratedAd } from "@/lib/storage";
import { withGenMeta } from "@/lib/ad-meta";
import { storagePlatformForLabel } from "@/lib/next-steps";

const MAX_TOKENS = 4000;

function buildStealAd(
  brain: BrandBrain | null,
  input: CompetitorStealInput,
  r: { json: unknown; text: string; modelId: string; providerId?: string; inTok: number; outTok: number; cost: number; prompt: string }
): GeneratedAd {
  return withGenMeta(
    {
      id: crypto.randomUUID(),
      brand_id: brain?.id ?? "",
      // Was hard-coded "meta" whatever platform the teardown targeted.
      platform: storagePlatformForLabel(input.platform),
      campaign_type: "Competitor Steal",
      title: `Steal · ${input.competitor_name || "competitor"} · ${input.our_product}`,
      input: input as unknown as Record<string, unknown>,
      output_json: r.json,
      output_text: r.text,
      model_id: r.modelId,
      provider_id: r.providerId,
      usage_input_tokens: r.inTok,
      usage_output_tokens: r.outTok,
      cost_usd: r.cost,
      starred: false,
      status: "draft",
      notes: "",
      created_at: Date.now(),
      prompt: r.prompt,
    },
    { max_tokens: MAX_TOKENS }
  );
}
import { buildBrandSystemPrompt, type BrandBrain } from "@/lib/brand-brain";
import { buildCompetitorStealPrompt, type CompetitorStealInput } from "@/lib/prompts/competitor-steal";

interface SourceLink {
  name: string;
  url: (query: string) => string;
  note: string;
}

const SOURCES: SourceLink[] = [
  {
    name: "Meta Ads Library",
    url: (q) => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(q)}&search_type=keyword_unordered`,
    note: "Every active Facebook + Instagram ad. Public. No login needed.",
  },
  {
    name: "Google Ads Transparency",
    url: (q) => `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(q)}`,
    note: "Search ads + display ads + YouTube ads currently or recently running.",
  },
  {
    name: "TikTok Top Ads",
    url: () => `https://ads.tiktok.com/business/creativecenter/topads/`,
    note: "TikTok's official top-performing ads gallery (by region/category).",
  },
  {
    name: "LinkedIn Ad Library",
    url: (q) => `https://www.linkedin.com/ad-library/search?keyword=${encodeURIComponent(q)}`,
    note: "Public LinkedIn ad library — search by keyword or company.",
  },
];

export default function Page() {
  return (
    <ApiKeyGate>
      <Inner />
    </ApiKeyGate>
  );
}

function Inner() {
  const [searchQ, setSearchQ] = useState("");
  const [input, setInput] = useState<CompetitorStealInput>({
    our_product: "",
    our_usp: "",
    competitor_name: "",
    competitor_ads_pasted: "",
    platform: "Meta Feed",
  });
  const [brain, setBrain] = useState<BrandBrain | null>(null);
  const [running, setRunning] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [schemaRecovered, setSchemaRecovered] = useState(false);
  const stream = useThrottledStream();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    // `switched`: the active client changed, so the previous client's product
    // and USP must be replaced, not kept as "already filled".
    const load = (switched = false) => {
      const id = getActiveBrainId();
      (id ? getBrain(id) : Promise.resolve(undefined)).then((found) => {
        if (cancelled) return;
        const b = found ?? null;
        setBrain(b);
        setInput((cur) => ({
          ...cur,
          our_product: switched ? b?.business_name ?? "" : cur.our_product || b?.business_name || "",
          our_usp: switched ? b?.usp ?? "" : cur.our_usp || b?.usp || "",
        }));
      });
    };
    load();
    const onEdit = () => load(false);
    const onSwitch = () => load(true);
    window.addEventListener("ados:brains-changed", onEdit);
    window.addEventListener("ados:active-brain-changed", onSwitch);
    return () => {
      cancelled = true;
      window.removeEventListener("ados:brains-changed", onEdit);
      window.removeEventListener("ados:active-brain-changed", onSwitch);
    };
  }, []);

  function openLibrary(s: SourceLink) {
    const q = searchQ || input.competitor_name;
    if (!q) {
      setError("Enter a brand or keyword to search first.");
      return;
    }
    window.open(s.url(q), "_blank", "noopener,noreferrer");
  }

  function setField(k: keyof CompetitorStealInput, v: string) {
    setInput((c) => ({ ...c, [k]: v }));
  }

  async function run() {
    setError(null);
    setSavedId(null);
    setParsed(null);
    setSchemaRecovered(false);
    stream.reset();
    // Hard guardrail against hallucinated teardowns: the LLM does NOT have live
    // ad data. If the user submits just a brand name + empty paste, the model
    // would invent plausible-looking ads. Require enough pasted content that
    // the analysis is actually grounded in real copy. 120 chars ≈ one short ad.
    const pasted = input.competitor_ads_pasted.trim();
    if (pasted.length < 120) {
      setError(
        pasted.length === 0
          ? "Paste real competitor ad copy from the libraries above before running. We do not fetch ads for you — the AI only analyzes what you paste."
          : "Paste more competitor ad copy (at least ~120 chars / one full ad). Without real ad text, the teardown would be guesswork."
      );
      return;
    }
    if (!input.our_product.trim() || !input.our_usp.trim()) {
      setError("Tell us what we're selling + our USP — that's what the beat-their-ad variants will anchor to.");
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
      // Migrated from streamClaude shim to llmStream directly — same routing
      // through the active provider, but the explicit dependency makes future
      // provider-aware features (vision fallback, model override) trivial.
      // (Audit finding #26.)
      const system = buildBrandSystemPrompt(brain, { language: getLanguage(), tone_override: getToneOverride() });
      const prompt = buildCompetitorStealPrompt(input);
      const res = await llmStream(
        {
          system,
          messages: [{ role: "user", content: prompt }],
          maxTokens: MAX_TOKENS,
          temperature: 0.7,
          signal: controller.signal,
        },
        { onDelta: stream.append }
      );
      let cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      let inTok = res.usage?.input_tokens ?? 0;
      let outTok = res.usage?.output_tokens ?? 0;
      addUsage(cost, inTok, outTok);
      window.dispatchEvent(new Event("ados:usage"));
      // getText(): the closure's stream.text is the stale pre-run "".
      let finalText = res.text || stream.getText();
      // Schema validate + retry on shape failure. Accepts both the normal
      // teardown shape and the honesty-path error shape (where the model
      // refused to invent ads because no real ad copy was pasted).
      let json: any;
      try {
        const v = await validateOrRetry({
          schema: CompetitorStealSchema,
          raw: finalText,
          system,
          originalPrompt: prompt,
          signal: controller.signal,
          maxTokens: MAX_TOKENS,
        });
        json = v.data;
        if (v.recovered) {
          setSchemaRecovered(true);
          cost += v.costUsd;
          // Saved usage includes the correction pass, like cost already did.
          inTok += v.usage?.input_tokens ?? 0;
          outTok += v.usage?.output_tokens ?? 0;
          addUsage(v.costUsd, v.usage?.input_tokens ?? 0, v.usage?.output_tokens ?? 0);
          window.dispatchEvent(new Event("ados:usage"));
          finalText = v.raw;
        }
      } catch (vErr) {
        if (vErr instanceof StructuredLlmError) {
          setError(
            "Teardown couldn't be parsed even after a correction pass. Try a different provider — Claude / GPT / Gemini are most reliable for structured output."
          );
          return;
        }
        throw vErr;
      }
      setParsed(json);
      const ad = buildStealAd(brain, input, {
        json,
        text: finalText,
        modelId: res.modelId,
        providerId: res.providerId,
        inTok,
        outTok,
        cost,
        prompt,
      });
      await saveAd(ad);
      setSavedId(ad.id);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Teardown failed");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div>
      <PageHeader
        scope="research/competitors"
        title="Steal & Beat"
        subtitle="Pull competitor ads from public libraries. Claude tears them down, finds the angle they missed, writes 3 variants that beat the strongest one."
        showLive={running}
      />

      <Section title="1 · Find competitor ads">
        <p className="text-xs text-ink-muted mb-3 leading-relaxed">
          These libraries are public (no login, no key). Enter a brand or keyword, open each in a new tab,
          screenshot or copy the ads you want analyzed, then paste below.
        </p>
        <div className="flex gap-2 mb-3">
          <label htmlFor="competitor-search" className="sr-only">Competitor brand or keyword to search</label>
          <input
            id="competitor-search"
            className="input-base flex-1"
            placeholder="competitor brand or keyword …"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.name}
              onClick={() => openLibrary(s)}
              className="text-left border border-base-600 bg-base-900/40 hover:bg-base-800/60 hover:border-base-500 p-3 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live">{s.name}</span>
                <ExternalLink size={11} className="text-ink-faint group-hover:text-live transition" />
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">{s.note}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-3 leading-relaxed">
          OpenAdKit never calls these libraries directly · they open in a new tab in your own browser · zero data goes through us
        </p>
      </Section>

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 border border-base-600 bg-base-900/40 p-5 space-y-3">
          <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">2 · paste + context</h2>
          {!brain ? (
            <div className="border border-live/30 bg-live/5 text-live text-[11px] px-3 py-2 flex gap-2 font-mono uppercase tracking-ui-wide">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <div>brand brain pre-fills usp/product · <a href="/brand" className="underline">create one</a></div>
            </div>
          ) : null}
          <div>
            <label htmlFor="our-product" className="label">our product *</label>
            <input id="our-product" className="input-base" value={input.our_product} onChange={(e) => setField("our_product", e.target.value)} />
          </div>
          <div>
            <label htmlFor="our-usp" className="label">our usp *</label>
            <textarea id="our-usp" rows={2} className="input-base" value={input.our_usp} onChange={(e) => setField("our_usp", e.target.value)} />
          </div>
          <div>
            <label htmlFor="competitor-name" className="label">competitor name</label>
            <input id="competitor-name" className="input-base" value={input.competitor_name} onChange={(e) => setField("competitor_name", e.target.value)} placeholder="e.g. Headspace" />
          </div>
          <div>
            <label htmlFor="target-platform" className="label">target platform</label>
            <select id="target-platform" className="input-base" value={input.platform} onChange={(e) => setField("platform", e.target.value)}>
              <option>Meta Feed</option>
              <option>Meta Reels</option>
              <option>TikTok In-Feed</option>
              <option>Google Search</option>
              <option>LinkedIn Sponsored</option>
              <option>Twitter / X</option>
              <option>YouTube In-Stream</option>
            </select>
          </div>
          <div>
            <label htmlFor="competitor-ads" className="label">competitor ads · pasted *</label>
            <p className="text-[11px] text-ink-muted leading-relaxed mb-1.5">
              <span className="text-live font-medium">Honesty note:</span> the AI has <em>no live access</em> to ad libraries.
              Open the libraries above, copy the ads you want analyzed, paste them here. If you paste a brand name only,
              the AI will refuse rather than invent ads.
            </p>
            <textarea
              id="competitor-ads"
              rows={8}
              className="input-base font-mono text-xs"
              placeholder={`Paste 1–5 ads exactly as they appear. Include headline, primary text, CTA. Separate multiple ads with --- on its own line.\n\nAd 1:\nHook here…\nBody here…\nCTA: Sign up\n\n---\n\nAd 2:\n…`}
              value={input.competitor_ads_pasted}
              onChange={(e) => setField("competitor_ads_pasted", e.target.value)}
              aria-required="true"
            />
          </div>
          {error ? (
            <div className={`border ${/rate limit|quota|too many requests|429|retry in/i.test(error) ? "border-live/40 bg-live/5" : "border-neg/40 bg-neg/5"} px-3 py-3 space-y-3`}>
              <div className={`text-[11px] font-mono uppercase tracking-ui-wide ${/rate limit|quota|too many requests|429|retry in/i.test(error) ? "text-live" : "text-neg"}`}>
                {error}
              </div>
              {/rate limit|quota|too many requests|429|retry in/i.test(error) ? (
                <ProviderSwitcher reason="rate-limit" />
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <button onClick={run} disabled={running} className="btn-primary flex-1">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {running ? "analyzing" : "teardown + beat"}
            </button>
            {running ? <button onClick={() => abortRef.current?.abort()} className="btn-ghost" aria-label="Stop teardown"><StopCircle size={12} /></button> : null}
          </div>
          {savedId ? (
            <div className="text-[10px] text-pos flex items-center gap-1.5 font-mono uppercase tracking-ui-mega">
              <Save size={10} /> saved to history
            </div>
          ) : null}
        </section>

        <section className="lg:col-span-3 space-y-4">
          {!running && !stream.text && !parsed ? (
            <div className="border border-dashed border-base-600 bg-base-900/20 text-[11px] font-mono uppercase tracking-ui-mega text-ink-faint min-h-[260px] grid place-items-center">
              teardown + 3 variants will appear here
            </div>
          ) : null}
          {schemaRecovered && parsed ? (
            <div
              role="status"
              className="text-[11px] font-mono uppercase tracking-ui-mega text-live border border-live/30 bg-live/4 px-2 py-1 inline-block"
              title="The model's first reply didn't match the expected structure, so we automatically re-asked it to correct the JSON. Content below was returned by the second attempt."
            >
              ↻ ai output auto-corrected (schema retry)
            </div>
          ) : null}
          {parsed ? <StealOutput json={parsed} /> : stream.text ? (
            <div className="border border-base-600 bg-base-900/40 p-5">
              <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle mb-3 flex items-center gap-2">
                <span className="h-1 w-1 bg-live animate-pulse-soft" /> streaming
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink caret">{stream.text}</pre>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StealOutput({ json }: { json: any }) {
  // Honesty path: when the prompt's CRITICAL rule fires (empty/insufficient
  // paste), the model returns an explanatory error string instead of inventing
  // teardowns. Surface that clearly so the user knows they need to paste real
  // ad copy — they didn't pay tokens for hallucinated competitor data.
  if (json?.error && !json?.teardown?.length) {
    return (
      <div className="border border-live/40 bg-live/4 p-5 space-y-3 animate-fade-up">
        <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live flex items-center gap-2">
          <span className="h-1 w-1 bg-live" /> nothing to analyze
        </div>
        <p className="text-sm text-ink leading-relaxed">{json.error}</p>
        <p className="text-[11px] text-ink-muted">
          Use the library buttons above (Meta Ads Library, Google Ads Transparency, TikTok Top Ads, LinkedIn Ad Library),
          copy real ads, paste them in the textarea, and re-run.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4 stagger">
      {json?.teardown?.length ? (
        <Section title={`Teardown · ${json.teardown.length} ads`}>
          <ul className="space-y-2">
            {json.teardown.map((t: any, i: number) => (
              <li key={i} className="border border-base-700 bg-base-900/30 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Pill text={`#${i + 1}`} />
                  <Pill text={t.angle} tone="live" label="angle" />
                  <Pill text={t.hook_formula} label="hook" />
                  <Pill text={t.cta_mechanic} tone={t.cta_mechanic === "hard" ? "neg" : t.cta_mechanic === "medium" ? "live" : "info"} label="cta" />
                </div>
                <p className="text-ink-muted">{t.competitor_ad_summary}</p>
                <div className="grid md:grid-cols-2 gap-1 text-[11px]">
                  <div><span className="text-ink-faint">promise:</span> <span className="text-ink">{t.promise}</span></div>
                  <div><span className="text-ink-faint">proof:</span> <span className="text-ink">{t.proof}</span></div>
                  <div><span className="text-ink-faint">emotion:</span> <span className="text-ink">{t.emotional_trigger}</span></div>
                </div>
                <div className="text-[11px] pt-1 border-t border-base-700"><span className="text-neg">weakness:</span> <span className="text-ink">{t.weakness}</span></div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {json?.pattern_recognition ? (
        <Section title="Pattern recognition">
          <ul className="space-y-1 text-xs">
            <li className="flex gap-2"><span className="text-ink-faint w-32 font-mono uppercase tracking-ui-wide text-[10px]">repeated angle</span><span className="text-ink flex-1">{json.pattern_recognition.repeated_angle}</span></li>
            <li className="flex gap-2"><span className="text-ink-faint w-32 font-mono uppercase tracking-ui-wide text-[10px]">missing angles</span><span className="text-pos flex-1">{json.pattern_recognition.missing_angles?.join(" · ")}</span></li>
            <li className="flex gap-2"><span className="text-ink-faint w-32 font-mono uppercase tracking-ui-wide text-[10px]">overused proof</span><span className="text-ink flex-1">{json.pattern_recognition.overused_proof_type}</span></li>
            <li className="flex gap-2"><span className="text-ink-faint w-32 font-mono uppercase tracking-ui-wide text-[10px]">emotional register</span><span className="text-ink flex-1">{json.pattern_recognition.dominant_emotional_register}</span></li>
            {json.pattern_recognition.policy_or_substantiation_concerns?.length ? (
              <li className="flex gap-2"><span className="text-neg w-32 font-mono uppercase tracking-ui-wide text-[10px]">policy flags</span><span className="text-neg flex-1">{json.pattern_recognition.policy_or_substantiation_concerns.join(" · ")}</span></li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      {json?.positioning_attack_plan ? (
        <Section title="Positioning attack plan">
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <Field k="claim we own" v={json.positioning_attack_plan.claim_we_should_own} />
            <Field k="proof differentiation" v={json.positioning_attack_plan.proof_differentiation} />
            <Field k="angle to own" v={json.positioning_attack_plan.angle_to_own} />
            <Field k="hook to use" v={json.positioning_attack_plan.hook_formula_to_use} />
          </div>
        </Section>
      ) : null}

      {json?.beat_their_ad?.length ? (
        <Section title="Beat their ad · 3 variants">
          {json.beat_their_ad.map((v: any, i: number) => (
            <div key={i} className="border border-base-700 bg-base-900/30 p-3 mb-2 last:mb-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Pill text={v.label} tone="live" />
                <Pill text={v.strategy?.replace(/_/g, " ")} />
                <span className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint ml-auto">{v.char_count_primary} chars</span>
                <CopyButton text={`${v.hook}\n\n${v.body}\n\n${v.cta}`} />
              </div>
              <p className="font-display italic text-lg text-live leading-tight mb-1">{v.hook}</p>
              <p className="text-sm text-ink whitespace-pre-line">{v.body}</p>
              <p className="text-sm text-pos mt-2 font-medium">{v.cta}</p>
              <p className="text-[11px] text-ink-muted mt-2 border-t border-base-700 pt-2">{v.why_this_beats_them}</p>
            </div>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-base-700 p-2">
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">{k}</div>
      <div className="text-ink mt-1 leading-relaxed">{v}</div>
    </div>
  );
}
