"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Globe, Loader2, Search, Check, X, AlertTriangle, Edit3, ArrowLeft } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { BrandBrainForm } from "@/components/BrandBrainForm";
import { saveBrain } from "@/lib/storage";
import { emptyBrandBrain, type BrandBrain } from "@/lib/brand-brain";
import { setActiveBrainId, addUsage } from "@/lib/settings";
import { ingestUrl, ingestPasted } from "@/lib/url-ingest";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { llmCall, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { buildBrandExtractionPrompt } from "@/lib/prompts/brand-extraction";

export default function BrandOnboardingPage() {
  return (
    <ApiKeyGate>
      <Inner />
    </ApiKeyGate>
  );
}

function Inner() {
  const router = useRouter();
  const [editing, setEditing] = useState<BrandBrain | null>(null);
  const [quickUrl, setQuickUrl] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [pendingExtraction, setPendingExtraction] = useState<{
    brain: BrandBrain;
    source: "url" | "paste" | "google";
    sourceLabel: string;
  } | null>(null);

  function stageBrain(parsed: any, fallbackName: string, sourceUrl: string, source: "url" | "paste" | "google", sourceLabel: string) {
    const brain: BrandBrain = {
      ...emptyBrandBrain(),
      ...(parsed ?? {}),
      name: parsed?.business_name || fallbackName,
      business_name: parsed?.business_name || fallbackName,
      website_url: sourceUrl,
    };
    setPendingExtraction({ brain, source, sourceLabel });
    setQuickStatus(null);
  }

  async function commitPendingExtraction() {
    if (!pendingExtraction) return;
    await saveBrain(pendingExtraction.brain);
    setActiveBrainId(pendingExtraction.brain.id);
    window.dispatchEvent(new Event("ados:brains-changed"));
    // After save, route back to the clients list so the user sees the new
    // brand active in context with their other clients.
    router.push("/brand");
  }

  function editPendingExtraction() {
    if (!pendingExtraction) return;
    setEditing(pendingExtraction.brain);
    setPendingExtraction(null);
  }

  function discardPendingExtraction() {
    setPendingExtraction(null);
    setQuickStatus(null);
  }

  async function quickAddFromUrl() {
    if (!quickUrl.trim()) return;
    setQuickBusy(true);
    setQuickStatus("Reading the page…");
    setShowPaste(false);
    try {
      const r = await ingestUrl(quickUrl);
      if (!r.ok) {
        setQuickStatus(r.message);
        if (r.recoverable) setShowPaste(true);
        return;
      }
      setQuickStatus(r.source === "allorigins" ? "Got content via fallback reader. Extracting brand intelligence…" : "Extracting brand intelligence…");
      const res = await llmCall({
        messages: [{ role: "user", content: buildBrandExtractionPrompt({ website_content: r.content, description: `Brand at ${r.url}`, audience_notes: "", reviews: "" }) }],
        maxTokens: 3000,
        temperature: 0.4,
      });
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text);
      const fallback = new URL(r.url).hostname.replace(/^www\./, "");
      stageBrain(parsed, fallback, r.url, "url", `${r.url} (via ${r.source === "allorigins" ? "AllOrigins fallback" : "Jina Reader"})`);
    } catch (e: any) {
      setQuickStatus(e?.message ?? "Failed");
    } finally {
      setQuickBusy(false);
    }
  }

  async function quickAddFromPaste() {
    if (!pasted.trim()) return;
    setQuickBusy(true);
    setQuickStatus("Extracting brand intelligence from pasted content…");
    try {
      const r = ingestPasted(quickUrl, pasted);
      if (!r.ok) {
        setQuickStatus(r.message);
        return;
      }
      const res = await llmCall({
        messages: [{ role: "user", content: buildBrandExtractionPrompt({ website_content: r.content, description: `Brand pasted from ${quickUrl || "manual entry"}`, audience_notes: "", reviews: "" }) }],
        maxTokens: 3000,
        temperature: 0.4,
      });
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text);
      const fallbackName = quickUrl ? (() => { try { return new URL(/^https?:\/\//i.test(quickUrl) ? quickUrl : `https://${quickUrl}`).hostname.replace(/^www\./, ""); } catch { return "My Brand"; } })() : "My Brand";
      stageBrain(parsed, fallbackName, quickUrl, "paste", `Pasted content${quickUrl ? ` from ${quickUrl}` : ""}`);
    } catch (e: any) {
      setQuickStatus(e?.message ?? "Extraction failed");
    } finally {
      setQuickBusy(false);
    }
  }

  async function quickAddFromGoogle() {
    if (!googleQuery.trim()) return;
    setQuickBusy(true);
    setQuickStatus(`Searching Google for "${googleQuery}"…`);
    try {
      const searchUrl = `https://s.jina.ai/${encodeURIComponent(googleQuery.trim())}`;
      const r = await ingestUrl(searchUrl);
      if (!r.ok) {
        setQuickStatus(r.message);
        return;
      }
      setQuickStatus("Extracting brand intelligence from search results…");
      const res = await llmCall({
        messages: [{ role: "user", content: buildBrandExtractionPrompt({ website_content: r.content, description: `Brand found via Google search: ${googleQuery}`, audience_notes: "", reviews: "" }) }],
        maxTokens: 3000,
        temperature: 0.4,
      });
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text);
      stageBrain(parsed, googleQuery, "", "google", `Google search · "${googleQuery}"`);
    } catch (e: any) {
      setQuickStatus(e?.message ?? "Google search ingest failed");
    } finally {
      setQuickBusy(false);
    }
  }

  // Editing flow: when the user clicks "Edit before saving" on the review
  // panel, swap in the full BrandBrainForm pre-filled with the staged data.
  if (editing) {
    return (
      <div>
        <PageHeader
          scope="brand/new/edit"
          title="Refine before saving"
          subtitle="Edit anything the AI got wrong. Save when you're ready."
          actions={
            <Link href="/brand" className="btn-ghost">
              <ArrowLeft size={12} /> Back to clients
            </Link>
          }
        />
        <BrandBrainForm initial={editing} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        scope="brand/new"
        title="Add a new client"
        subtitle="Three ways to onboard: paste a website URL, search Google by business name, or pick an industry template. The AI extracts 90% of the brand intelligence — you cross-check before it's saved."
        actions={
          <Link href="/brand" className="btn-ghost">
            <ArrowLeft size={12} /> Back to clients
          </Link>
        }
      />

      {/* Review panel sits at the top once an extraction has staged — that's
          the cross-check moment users were doing manually before. */}
      {pendingExtraction ? (
        <ExtractionReview
          extraction={pendingExtraction}
          onSave={commitPendingExtraction}
          onEdit={editPendingExtraction}
          onDiscard={discardPendingExtraction}
        />
      ) : null}

      {!pendingExtraction ? (
        <>
          {/* Method 1: URL */}
          <div className="border border-live/30 bg-live/5 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-live" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-live">Method 1 · paste the client's website URL</span>
            </div>
            <p className="text-[12px] text-ink-muted mb-2 leading-relaxed">
              Best when the brand has a public site. AdForge reads the page via Jina Reader and extracts the brand brain.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="input-base flex-1 min-w-[240px]"
                placeholder="acme.com / clientwebsite.com"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") quickAddFromUrl(); }}
                disabled={quickBusy}
              />
              <button onClick={quickAddFromUrl} disabled={quickBusy || !quickUrl.trim()} className="btn-primary">
                {quickBusy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {quickBusy ? "ingesting" : "extract"}
              </button>
            </div>
            {quickStatus ? (
              <p className="text-[11px] font-mono uppercase tracking-ui-wide text-neg mt-2">{quickStatus}</p>
            ) : (
              <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-2">
                tries jina reader → allorigins fallback · facebook/instagram block scrapers (use method 2 or 3 instead)
              </p>
            )}

            {showPaste ? (
              <div className="mt-4 border-t border-live/30 pt-3 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-ui-mega text-live">
                  ✱ paste content manually
                </div>
                <p className="text-[12px] text-ink-muted leading-relaxed">
                  Open <span className="text-ink font-mono">{quickUrl || "the website"}</span> in a new tab → select all
                  (Ctrl+A / ⌘A) → copy (Ctrl+C / ⌘C) → paste below.
                </p>
                <textarea
                  rows={6}
                  className="input-base font-mono text-xs"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="Paste hero copy, about section, features, customer reviews — anything from the site…"
                  disabled={quickBusy}
                />
                <div className="flex gap-2">
                  <button onClick={quickAddFromPaste} disabled={quickBusy || !pasted.trim()} className="btn-primary">
                    {quickBusy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    extract from paste
                  </button>
                  <button onClick={() => { setShowPaste(false); setPasted(""); }} disabled={quickBusy} className="btn-ghost">
                    cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <button
                  onClick={() => setShowPaste(true)}
                  className="text-[11px] font-mono uppercase tracking-ui-wide text-info hover:underline"
                >
                  ✱ or paste content manually instead
                </button>
              </div>
            )}
          </div>

          {/* Method 2: Google search */}
          <div className="border border-info/30 bg-info/[0.04] p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Search size={14} className="text-info" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-info">Method 2 · search Google by business name</span>
            </div>
            <p className="text-[12px] text-ink-muted mb-2 leading-relaxed">
              Use this when the client has no website, or when the site blocks scrapers (most Instagram and Facebook profiles). AdForge runs a Google search via Jina, then extracts from the top results.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="input-base flex-1 min-w-[240px]"
                placeholder='e.g. "Acme Tax bookkeeping software for freelancers"'
                value={googleQuery}
                onChange={(e) => setGoogleQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") quickAddFromGoogle(); }}
                disabled={quickBusy}
              />
              <button onClick={quickAddFromGoogle} disabled={quickBusy || !googleQuery.trim()} className="btn-primary">
                {quickBusy ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                {quickBusy ? "searching" : "search & extract"}
              </button>
            </div>
          </div>

          {/* Method 3: Industry templates */}
          <div className="border border-base-600 bg-base-900/40 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Method 3 · start from an industry template</span>
            </div>
            <p className="text-[12px] text-ink-muted mb-3 leading-relaxed">
              No website, no Google footprint, or just want a starting skeleton? Pick the closest industry — AdForge pre-fills typical audience, tone, and positioning that you can refine.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {INDUSTRY_TEMPLATES.map((t) => (
                <button
                  key={t.slug}
                  onClick={async () => {
                    const b = t.apply({ business_name: "" });
                    await saveBrain(b);
                    setActiveBrainId(b.id);
                    window.dispatchEvent(new Event("ados:brains-changed"));
                    setEditing(b);
                  }}
                  className="text-left border border-base-700 bg-base-900/30 hover:bg-base-800/60 hover:border-base-500 p-3 transition"
                  title={t.description}
                >
                  <div className="text-xl">{t.emoji}</div>
                  <div className="text-[13px] text-ink font-medium leading-tight mt-1">{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Method 4: pure manual */}
          <div className="border border-base-700 bg-base-900/30 p-4 mb-4">
            <div className="text-[12px] text-ink-muted">
              <span className="font-semibold text-ink">Method 4 · build by hand.</span>{" "}
              Skip the AI entirely and fill every field yourself.{" "}
              <button
                onClick={() => setEditing(emptyBrandBrain())}
                className="text-live hover:underline font-medium"
              >
                Open the manual form →
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Cross-check panel — see app/brand/page.tsx for the original. Kept inline here
 * so the onboarding flow is self-contained.
 */
function ExtractionReview({
  extraction,
  onSave,
  onEdit,
  onDiscard,
}: {
  extraction: { brain: BrandBrain; source: "url" | "paste" | "google"; sourceLabel: string };
  onSave: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}) {
  const { brain, sourceLabel } = extraction;
  const fields: { label: string; value: string | string[] | undefined; weight: "core" | "important" | "extra" }[] = [
    { label: "Business name", value: brain.business_name, weight: "core" },
    { label: "Industry", value: brain.industry, weight: "core" },
    { label: "Niche (one-sentence positioning)", value: brain.niche, weight: "core" },
    { label: "USP", value: brain.usp, weight: "core" },
    { label: "Tone", value: brain.tone, weight: "core" },
    { label: "Audience — who", value: brain.audience_who, weight: "core" },
    { label: "Products / offers", value: brain.products, weight: "important" },
    { label: "Audience pain points", value: brain.audience_pain_points, weight: "important" },
    { label: "Audience desires", value: brain.audience_desires, weight: "important" },
    { label: "Key benefits", value: brain.key_benefits, weight: "important" },
    { label: "Active platforms", value: brain.platforms, weight: "important" },
    { label: "Content pillars", value: brain.content_pillars, weight: "important" },
    { label: "Competitors", value: brain.competitors, weight: "extra" },
    { label: "Differentiators", value: brain.differentiators, weight: "extra" },
    { label: "Personality traits", value: brain.personality_traits, weight: "extra" },
    { label: "Words to use", value: brain.words_to_use, weight: "extra" },
  ];

  const socials = Object.entries(brain.social_links ?? {}).filter(([, v]) => v && String(v).trim());
  const isFilled = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!(v && v.trim()));
  const coreFilled = fields.filter((f) => f.weight === "core").every((f) => isFilled(f.value));
  const totalFilled = fields.filter((f) => isFilled(f.value)).length;
  const totalCount = fields.length;

  return (
    <div className="border-2 border-live bg-live/[0.04] p-5 mb-6 animate-fade-up">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 h-8 w-8 grid place-items-center bg-live text-base-950 font-bold rounded-sm">2</div>
        <div className="flex-1">
          <h2 className="font-display italic text-2xl text-ink leading-tight">Cross-check the AI extraction</h2>
          <p className="text-sm text-ink-muted mt-1 leading-relaxed">
            Source: <span className="text-ink font-mono text-[12px]">{sourceLabel}</span>. Review every field below — fix anything wrong before it becomes the brand voice for every future generation.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display italic text-3xl text-live tabular leading-none">{totalFilled}/{totalCount}</div>
          <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint">fields filled</div>
        </div>
      </div>

      {!coreFilled ? (
        <div className="flex items-start gap-2 border border-neg/40 bg-neg/[0.05] px-3 py-2 mb-3">
          <AlertTriangle size={12} className="text-neg shrink-0 mt-0.5" />
          <span className="text-[11px] text-ink">
            Some <strong className="text-neg">core fields are empty</strong>. The AI didn't find them — click <em>Edit before saving</em> to fill them by hand, or save now and edit later.
          </span>
        </div>
      ) : null}

      <div className="space-y-1">
        {fields.map((f) => {
          const filled = isFilled(f.value);
          const display = Array.isArray(f.value) ? f.value.join(" · ") : (f.value ?? "");
          return (
            <div
              key={f.label}
              className={`flex items-start gap-2 px-2 py-1.5 border-l-2 ${
                filled ? "border-pos/60" : f.weight === "core" ? "border-neg/60" : "border-base-700"
              } bg-base-900/30`}
            >
              <span className="shrink-0 mt-0.5">
                {filled ? <Check size={11} className="text-pos" /> : f.weight === "core" ? <X size={11} className="text-neg" /> : <span className="block h-[11px] w-[11px] border border-base-600 rounded-full" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint">
                  {f.label}
                  {f.weight === "core" ? <span className="text-neg ml-1">*</span> : null}
                </div>
                <div className={`text-[13px] mt-0.5 ${filled ? "text-ink" : "text-ink-subtle italic"}`}>
                  {filled ? display : "(blank — AI couldn't find this)"}
                </div>
              </div>
            </div>
          );
        })}
        {socials.length > 0 ? (
          <div className="flex items-start gap-2 px-2 py-1.5 border-l-2 border-pos/60 bg-base-900/30">
            <Check size={11} className="text-pos shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint">Social handles found</div>
              <div className="text-[12px] text-ink mt-0.5">
                {socials.map(([platform, handle]) => `${platform}: ${handle}`).join(" · ")}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-base-700">
        <button onClick={onSave} className="btn-primary">
          <Check size={12} />
          {coreFilled ? "Looks good — save & activate" : "Save anyway & activate"}
        </button>
        <button onClick={onEdit} className="btn-ghost">
          <Edit3 size={12} />
          Edit before saving
        </button>
        <div className="flex-1" />
        <button
          onClick={() => { if (confirm("Discard this AI extraction? Nothing is saved.")) onDiscard(); }}
          className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-muted hover:text-neg transition flex items-center gap-1.5 px-2"
        >
          <X size={11} />
          Discard
        </button>
      </div>
    </div>
  );
}
