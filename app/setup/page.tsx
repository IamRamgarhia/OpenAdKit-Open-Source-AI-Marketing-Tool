"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  KeyRound, Loader2, Eye, EyeOff, CheckCircle2, ExternalLink, ArrowRight, ArrowLeft,
  Sparkles, Brain, Activity, Globe, Lock, Zap, Search,
} from "lucide-react";
import {
  setActiveProviderId, setProviderKey, setActiveModelId,
  setActiveBrainId, setOnboarded, markTourSeen, addUsage,
} from "@/lib/settings";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { verifyApiKey, llmCall, estimateCostUsd } from "@/lib/llm";
import { emptyBrandBrain, type BrandBrain } from "@/lib/brand-brain";
import { saveBrain } from "@/lib/storage";
import { ingestUrl } from "@/lib/url-ingest";
import { tryParseJson } from "@/lib/providers";
import { buildBrandExtractionPrompt } from "@/lib/prompts/brand-extraction";

type StepN = 1 | 2 | 3 | 4 | 5;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepN>(1);
  const [tourIdx, setTourIdx] = useState(0);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brandUrl, setBrandUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandIngesting, setBrandIngesting] = useState(false);
  const [brandStatus, setBrandStatus] = useState<string>("");

  const provider = PROVIDERS.find((p) => p.id === providerId);

  function next() { setError(null); setStep((s) => Math.min(5, s + 1) as StepN); }
  function back() { setError(null); setStep((s) => Math.max(1, s - 1) as StepN); }

  async function verifyAndContinue() {
    if (!provider) return;
    setError(null);
    if (!apiKey.trim()) { setError("Paste your API key first."); return; }
    setTesting(true);
    const res = await verifyApiKey(apiKey, provider.id);
    setTesting(false);
    // Only an actual auth failure blocks onboarding. A 429 (rate-limited) or a
    // provider outage still means the key is good — stopping there would tell a
    // new user their valid key was rejected on their very first screen.
    if (!res.authenticated) { setError(res.message); return; }
    if (!res.ok) setError(res.message); // advisory; we continue
    setActiveProviderId(provider.id);
    setProviderKey(provider.id, apiKey);
    setActiveModelId(provider.id, model || provider.default_model);
    window.dispatchEvent(new Event("ados:provider-changed"));
    next();
  }

  async function ingestAndCreateBrain() {
    setBrandStatus(""); setError(null);
    if (!brandUrl.trim() && !brandName.trim()) {
      setError("Enter a website URL or at least a business name.");
      return;
    }
    setBrandIngesting(true);
    try {
      let extracted: any = null;
      if (brandUrl.trim()) {
        setBrandStatus("Reading the page via Jina Reader…");
        const r = await ingestUrl(brandUrl);
        if (!r.ok) {
          setBrandStatus(`Reader couldn't fetch — saving placeholder brain you can fill later.`);
        } else {
          setBrandStatus("Extracting brand intelligence with AI…");
          const res = await llmCall({
            messages: [{ role: "user", content: buildBrandExtractionPrompt({ website_content: r.content, description: brandName || "(from website)", audience_notes: "", reviews: "" }) }],
            maxTokens: 3000,
            temperature: 0.4,
          });
          // Track cost so the StatusBar + Report dashboards reflect this very
          // first AI call. Audit HIGH-1 found this was previously missing.
          const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
          addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
          window.dispatchEvent(new Event("ados:usage"));
          extracted = tryParseJson(res.text);
        }
      }
      const brain: BrandBrain = {
        ...emptyBrandBrain(),
        ...(extracted ?? {}),
        name: brandName || extracted?.business_name || "My Brand",
        business_name: brandName || extracted?.business_name || "My Brand",
        website_url: brandUrl,
      };
      await saveBrain(brain);
      setActiveBrainId(brain.id);
      window.dispatchEvent(new Event("ados:brains-changed"));
      finish();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBrandIngesting(false);
    }
  }

  function skipBrand() { finish(); }

  function finish() {
    setOnboarded();
    markTourSeen();
    // ApiKeyGate bounces here with ?next=<the tool the user actually wanted>.
    // Honour it so onboarding returns them to that page instead of dropping
    // them on the dashboard and making them navigate again.
    const dest = safeReturnPath() ?? (brandUrl.trim() || brandName.trim() ? "/suggestions" : "/");
    router.push(dest);
  }

  /** Read ?next= and accept it only if it's a same-origin absolute path.
   *  Rejecting "//evil.com" and "https://…" keeps this from being an open
   *  redirect. */
  function safeReturnPath(): string | null {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("next");
    if (!raw) return null;
    if (!raw.startsWith("/") || raw.startsWith("//")) return null;
    if (raw.startsWith("/setup")) return null; // don't loop back into onboarding
    return raw;
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] grid place-items-center animate-fade-up p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-live grid place-items-center text-base-950 font-display italic text-xl">A</div>
            <div>
              <div className="scope-prefix">~/setup</div>
              <div className="font-display italic text-2xl text-ink leading-none mt-1">OpenAdKit</div>
            </div>
          </div>
          <Stepper current={step} total={5} />
        </div>

        <div className="border border-base-600 bg-base-900/50 p-6 space-y-5 min-h-[420px]">
          {step === 1 ? <StepWelcome /> : null}
          {step === 2 ? <StepTour idx={tourIdx} setIdx={setTourIdx} /> : null}
          {step === 3 ? <StepProvider providerId={providerId} setProviderId={setProviderId} model={model} setModel={setModel} /> : null}
          {step === 4 ? <StepKey provider={provider} apiKey={apiKey} setApiKey={setApiKey} showKey={showKey} setShowKey={setShowKey} /> : null}
          {step === 5 ? <StepBrand brandUrl={brandUrl} setBrandUrl={setBrandUrl} brandName={brandName} setBrandName={setBrandName} status={brandStatus} busy={brandIngesting} /> : null}

          {error ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t border-base-700">
            {step > 1 ? (
              <button onClick={back} className="btn-ghost">
                <ArrowLeft size={11} /> back
              </button>
            ) : <span />}
            {step === 1 ? (
              <button onClick={next} className="btn-primary">start tour <ArrowRight size={11} /></button>
            ) : step === 2 ? (
              <button onClick={() => { if (tourIdx < TOUR_SLIDES.length - 1) setTourIdx(tourIdx + 1); else next(); }} className="btn-primary">
                {tourIdx < TOUR_SLIDES.length - 1 ? "next" : "pick provider"} <ArrowRight size={11} />
              </button>
            ) : step === 3 ? (
              <button onClick={() => { if (!providerId) { setError("Pick a provider."); return; } next(); }} className="btn-primary">
                continue <ArrowRight size={11} />
              </button>
            ) : step === 4 ? (
              <button onClick={verifyAndContinue} disabled={testing || !apiKey} className="btn-primary">
                {testing ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                {testing ? "verifying" : "verify + continue"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={skipBrand} className="btn-ghost">skip for now</button>
                <button onClick={ingestAndCreateBrain} disabled={brandIngesting || (!brandUrl.trim() && !brandName.trim())} className="btn-primary">
                  {brandIngesting ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                  {brandIngesting ? "ingesting" : "create + finish"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1 w-7 ${i + 1 <= current ? "bg-live" : "bg-base-600"}`} />
      ))}
      <span className="ml-2 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint tabular">{current} / {total}</span>
    </div>
  );
}

function StepWelcome() {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">welcome</div>
      <h2 className="font-display italic text-4xl text-ink leading-tight">The open source AI marketing tool that runs in your browser.</h2>
      <p className="text-sm text-ink-muted mt-4 leading-relaxed max-w-lg">
        OpenAdKit replaces a stack of $49–$499/month AI marketing tools with one open-source app.
        No backend, no accounts, no telemetry. You bring your own AI key — free or paid, your choice — and everything runs locally.
      </p>
      <ul className="mt-5 space-y-2 text-sm text-ink">
        <li className="flex items-start gap-2"><span className="text-live mt-1">○</span><span>18 generators for Google, Meta, TikTok, YouTube, LinkedIn, X, Display + hashtags, lead forms, email subjects, AI image/video prompts</span></li>
        <li className="flex items-start gap-2"><span className="text-live mt-1">○</span><span>11 optimization tools — CTR, Quality Score, Budget Waste, Bid Strategy, Ad Fatigue, more</span></li>
        <li className="flex items-start gap-2"><span className="text-live mt-1">○</span><span>Competitor research from Meta Ads Library + Google Transparency Center</span></li>
        <li className="flex items-start gap-2"><span className="text-live mt-1">○</span><span>Manage multiple client brands by pasting their website URL</span></li>
      </ul>
      <p className="mt-5 text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle">
        90-second tour next · then we'll set up your AI provider
      </p>
    </div>
  );
}

const TOUR_SLIDES: { icon: any; label: string; title: string; body: string }[] = [
  { icon: Brain, label: "tour 1 / 4", title: "Brand Brain anchors everything.", body: "Every generation pulls from your active Brand Brain — tone, audience, VOC, USP, objections. Add a brand by pasting its URL — we extract automatically. Manage many brands; switch with one click." },
  { icon: Sparkles, label: "tour 2 / 4", title: "18 generators · 7 platforms · 1 brief.", body: "Google · Meta · TikTok · YouTube · LinkedIn · X · Display. Plus Campaign Kit (one brief → every platform), hashtags in any language, native lead forms, email subjects, and AI image/video prompts for Midjourney / Runway / Pika." },
  { icon: Search, label: "tour 3 / 4", title: "Steal & Beat competitors.", body: "Deep-links into Meta Ads Library, Google Transparency, TikTok Top Ads, LinkedIn Ad Library — all free, all public. Paste what you see; we tear it down + write 3 variants that beat the strongest one." },
  { icon: Activity, label: "tour 4 / 4", title: "11 optimizers + routines + learn hub.", body: "CTR, Quality Score, Budget Waste, Bid Strategy, Audience Targeting, A/B planner, ad fatigue. Daily/weekly/monthly checklists with streak counters. 28 mini-course lessons + Ad Copy School interactive trainer." },
];

function StepTour({ idx, setIdx }: { idx: number; setIdx: (n: number) => void }) {
  const s = TOUR_SLIDES[idx];
  const Icon = s.icon;
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2">{s.label}</div>
      <div className="h-12 w-12 grid place-items-center bg-live/10 border border-live/40 mb-4">
        <Icon size={20} className="text-live" />
      </div>
      <h2 className="font-display italic text-3xl text-ink leading-tight">{s.title}</h2>
      <p className="text-sm text-ink-muted mt-4 leading-relaxed">{s.body}</p>
      <div className="mt-6 flex gap-1" role="tablist" aria-label="Tour slides">
        {TOUR_SLIDES.map((_, i) => (
          // Wrapping the 4px-tall bar in a py-3 button gives a 28px+ tap area
          // without changing the visual design. Touch users can hit it.
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === idx}
            onClick={() => setIdx(i)}
            className="py-3 px-0 transition group"
            aria-label={`Slide ${i + 1} of ${TOUR_SLIDES.length}`}
          >
            <span
              className={`block h-1 w-12 transition ${i === idx ? "bg-live" : i < idx ? "bg-live/40" : "bg-base-600 group-hover:bg-base-500"}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function StepProvider({
  providerId, setProviderId, model, setModel,
}: { providerId: string | null; setProviderId: (id: string) => void; model: string; setModel: (m: string) => void }) {
  const grouped = {
    free: PROVIDERS.filter((p) => p.category === "free"),
    freemium: PROVIDERS.filter((p) => p.category === "freemium"),
    paid: PROVIDERS.filter((p) => p.category === "paid"),
  };
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">step 3 of 5</div>
      <h2 className="font-display italic text-3xl text-ink leading-tight">Pick your AI provider.</h2>
      <p className="text-sm text-ink-muted mt-3 leading-relaxed max-w-lg">
        Start with a free option (Groq, Cerebras, Gemini, OpenRouter) — they all give generous quotas that cover most personal use. Upgrade to paid models any time from Settings.
      </p>
      <div className="mt-5 space-y-4">
        <ProviderGroup label="Free tier · recommended to start" tone="pos" providers={grouped.free} providerId={providerId} setProviderId={setProviderId} model={model} setModel={setModel} />
        <ProviderGroup label="Freemium · free + paid mix" tone="live" providers={grouped.freemium} providerId={providerId} setProviderId={setProviderId} model={model} setModel={setModel} />
        <ProviderGroup label="Paid · premium quality" tone="default" providers={grouped.paid} providerId={providerId} setProviderId={setProviderId} model={model} setModel={setModel} />
      </div>
    </div>
  );
}

function ProviderGroup({
  label, tone, providers, providerId, setProviderId, model, setModel,
}: { label: string; tone: "pos" | "live" | "default"; providers: Provider[]; providerId: string | null; setProviderId: (id: string) => void; model: string; setModel: (m: string) => void }) {
  const toneMap = { pos: "text-pos", live: "text-live", default: "text-ink-muted" };
  return (
    <div>
      <div className={`text-[10px] font-mono uppercase tracking-ui-mega mb-1.5 ${toneMap[tone]}`}>{label}</div>
      <div className="grid md:grid-cols-2 gap-2">
        {providers.map((p) => {
          const active = providerId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setProviderId(p.id); setModel(p.default_model); }}
              className={`text-left border p-3 transition ${active ? "border-live bg-live/5" : "border-base-600 hover:bg-base-800/40"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {p.category === "free" ? <Zap size={11} className="text-pos" /> : p.category === "freemium" ? <Zap size={11} className="text-live" /> : <Lock size={11} className="text-ink-faint" />}
                <span className="font-medium text-ink text-sm">{p.name}</span>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">{p.description}</p>
              {p.free_note ? <p className="text-[10px] text-pos mt-1 font-mono uppercase tracking-ui-wide">{p.free_note}</p> : null}
              {active && p.models.length > 1 ? (
                <select
                  value={model || p.default_model}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); setModel(e.target.value); }}
                  className="input-base mt-2 text-xs"
                >
                  {p.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepKey({
  provider, apiKey, setApiKey, showKey, setShowKey,
}: { provider: Provider | undefined; apiKey: string; setApiKey: (s: string) => void; showKey: boolean; setShowKey: (b: boolean) => void }) {
  if (!provider) return <p className="text-sm text-neg">Pick a provider first.</p>;
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">step 4 of 5</div>
      <h2 className="font-display italic text-3xl text-ink leading-tight">Paste your {provider.name} key.</h2>
      <p className="text-sm text-ink-muted mt-3 leading-relaxed">
        Stored in this browser only. Never sent anywhere except {provider.name}'s API. Get a key:{" "}
        <a href={provider.get_key_url} target="_blank" rel="noreferrer" className="text-live hover:underline inline-flex items-center gap-0.5">
          {provider.get_key_url.replace(/^https?:\/\//, "")} <ExternalLink size={9} />
        </a>
      </p>
      <div className="mt-5">
        <label htmlFor="setup-apikey" className="label flex items-center gap-1.5"><KeyRound size={11} /> api key</label>
        <div className="relative">
          <input
            id="setup-apikey"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value.trim())}
            placeholder={provider.id === "anthropic" ? "sk-ant-…" : provider.id === "google" ? "AIza…" : "sk-…"}
            className="input-base pr-10 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink" aria-label={showKey ? "Hide API key" : "Show API key"}>
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
      {provider.free_note ? (
        <div className="mt-4 border border-pos/40 bg-pos/5 text-pos text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
          {provider.free_note}
        </div>
      ) : null}
    </div>
  );
}

function StepBrand({
  brandUrl, setBrandUrl, brandName, setBrandName, status, busy,
}: { brandUrl: string; setBrandUrl: (s: string) => void; brandName: string; setBrandName: (s: string) => void; status: string; busy: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-1">step 5 of 5</div>
      <h2 className="font-display italic text-3xl text-ink leading-tight">Add your first brand.</h2>
      <p className="text-sm text-ink-muted mt-3 leading-relaxed max-w-lg">
        Paste a website URL — we extract the brand profile automatically (tone, audience, USP, VOC).
        You can refine it after, and add more brands any time from <Link href="/brand" className="text-live hover:underline">/brand</Link>.
      </p>
      <div className="mt-5 space-y-3">
        <div>
          <label htmlFor="setup-brand-url" className="label flex items-center gap-1.5"><Globe size={11} /> website url</label>
          <input
            id="setup-brand-url"
            className="input-base"
            value={brandUrl}
            onChange={(e) => setBrandUrl(e.target.value)}
            placeholder="acme.com / yourbrand.com"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-1">
            uses jina reader · free + public · runs from your browser
          </p>
        </div>
        <div>
          <label htmlFor="setup-brand-name" className="label">brand name (or leave blank to auto-detect)</label>
          <input id="setup-brand-name" className="input-base" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme Co" />
        </div>
        {status && busy ? (
          <div className="border border-live/40 bg-live/5 text-live text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide flex items-center gap-2">
            <Loader2 size={11} className="animate-spin" /> {status}
          </div>
        ) : status ? (
          <div className="border border-base-700 bg-base-900/40 text-ink-muted text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">{status}</div>
        ) : null}
        <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle">
          you can also skip — every generator will work generic-mode until you add a brand
        </p>
      </div>
    </div>
  );
}
