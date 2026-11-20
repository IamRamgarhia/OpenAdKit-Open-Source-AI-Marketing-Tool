"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Globe, Loader2, Search, Check, X, AlertTriangle, Edit3, ArrowLeft, StopCircle, Image as ImageIcon, RefreshCw } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { BrandBrainForm } from "@/components/BrandBrainForm";
import { saveBrain } from "@/lib/storage";
import { emptyBrandBrain, type BrandBrain } from "@/lib/brand-brain";
import { setActiveBrainId, addUsage, getActiveProviderId, getModel } from "@/lib/settings";
import { ingestUrl, ingestPasted, ingestSubpages, looksLikeUrl, detectSocial } from "@/lib/url-ingest";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { llmCall, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { buildBrandExtractionPrompt } from "@/lib/prompts/brand-extraction";
import { buildBrandGapFillPrompt } from "@/lib/prompts/brand-gap-fill";
import { buildSearchAugmentedPrompt } from "@/lib/prompts/brand-search-augmented";
import { deterministicFillFromMetadata } from "@/lib/deterministic-brand-fill";
import { applyIndustryFallback } from "@/lib/industry-fallback";
import { saveDraft, loadDraft, clearDraft } from "@/lib/brand-draft";
import { getProvider } from "@/lib/providers";
import { formatMoney } from "@/lib/currency";
import { providerSupportsVision, fileToImagePart } from "@/lib/providers/vision";
import type { ContentPart, ImagePart } from "@/lib/providers/types";

// Fields the gap-fill second pass is allowed to attempt. Excludes deterministic
// fields (business_name, industry, etc.) and the no-fabrication fields
// (voc_*, *_angles).
const GAP_FILL_FIELDS = [
  "tone", "personality_traits", "writing_style",
  "audience_who", "audience_pain_points", "audience_desires", "audience_demographics",
  "products", "platforms", "content_pillars",
  "key_benefits", "key_messages",
  "words_to_use", "words_to_avoid",
  "competitors", "differentiators", "price_positioning",
  "objections", "objection_handling",
] as const;

// Gated console.log — kept in development for the ingest debug story, but
// stripped in production so raw AI responses don't end up in user DevTools.
// (Audit finding #52.)
function dlog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

function isEmptyField(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/** Expected JSON shape for each BrandBrain field the AI may return. Used to
 *  coerce gap-fill results when the model returns the wrong type (e.g. a
 *  comma-separated string for an array field). (Audit finding #5.) */
const ARRAY_FIELDS = new Set([
  "products", "platforms", "content_pillars", "personality_traits",
  "audience_pain_points", "audience_desires",
  "key_benefits", "key_messages", "words_to_use", "words_to_avoid",
  "competitors", "differentiators", "objections", "objection_handling",
]);

/** Coerce an AI value to match the BrandBrain schema's expected type for `key`.
 *  Wraps stray strings into arrays, splits "a, b, c" into ["a","b","c"], and
 *  returns null when the value is unsalvageable. */
function coerceFieldValue(key: string, v: unknown): unknown {
  if (v == null) return null;
  if (ARRAY_FIELDS.has(key)) {
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()).map((s) => String(s).trim());
    if (typeof v === "string") {
      const parts = v.split(/[,;\n|·]/).map((s) => s.trim()).filter(Boolean);
      return parts.length ? parts : null;
    }
    return null;
  }
  // string-typed field
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) return v.filter(Boolean).join(", ") || null;
  return null;
}

export default function BrandOnboardingPage() {
  return (
    <ApiKeyGate>
      <Inner />
    </ApiKeyGate>
  );
}

/** Rough cost estimate per extraction (USD) for the active provider+model.
 *  Used to show "≈ $0.02" under the Extract buttons. Based on:
 *    Pass 1: ~6k in + ~2k out
 *    Pass 2 (gap-fill): ~3k in + ~1k out
 *    Pass 3 (auto-search): ~8k in + ~2k out
 *  Conservative envelope — actual cost varies with content length. */
function estimateExtractionCostUsd(lightMode: boolean): number {
  try {
    const pid = getActiveProviderId();
    if (!pid) return 0;
    const provider = getProvider(pid);
    if (!provider) return 0;
    const modelId = getModel();
    const model = provider.models?.find((m) => m.id === modelId) ?? provider.models?.[0];
    if (!model?.pricing) return 0;
    const inP = model.pricing.input_per_million_usd ?? 0;
    const outP = model.pricing.output_per_million_usd ?? 0;
    if (lightMode) {
      // Single pass only — pass 1 budget.
      return (6000 * inP + 2000 * outP) / 1_000_000;
    }
    return (17000 * inP + 5000 * outP) / 1_000_000;
  } catch {
    return 0;
  }
}

function Inner() {
  const router = useRouter();
  const [editing, setEditing] = useState<BrandBrain | null>(null);
  const [quickUrl, setQuickUrl] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  // Synchronous race guard. React state updates are async, so two Enter-presses
  // (URL + Google) before the first re-render can both pass `disabled={quickBusy}`.
  // The ref is checked + set synchronously at the top of each async entry point.
  // (Audit finding #6.)
  const busyRef = useRef(false);
  // AbortController for the in-flight extraction. Cancel button calls .abort()
  // and the URL/Paste/Google handlers pass .signal down to every llmCall + ingestUrl.
  const abortRef = useRef<AbortController | null>(null);
  const [lightMode, setLightMode] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<ReturnType<typeof loadDraft>>(null);
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const costPreview = estimateExtractionCostUsd(lightMode);

  // Hydrate draft on mount — if the user crashed/refreshed mid-extraction, offer
  // to resume from the staged result.
  useEffect(() => {
    const d = loadDraft();
    if (d) setResumeDraft(d);
  }, []);

  const [pasted, setPasted] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [pendingExtraction, setPendingExtraction] = useState<{
    brain: BrandBrain;
    source: "url" | "paste" | "google";
    sourceLabel: string;
  } | null>(null);

  function stopExtraction() {
    abortRef.current?.abort();
  }

  function dismissResumeDraft() {
    clearDraft();
    setResumeDraft(null);
  }

  function resumeFromDraft() {
    if (!resumeDraft) return;
    setPendingExtraction({
      brain: resumeDraft.brain,
      source: resumeDraft.source === "vision" ? "url" : resumeDraft.source,
      sourceLabel: resumeDraft.sourceLabel,
    });
    setResumeDraft(null);
  }

  function stageBrain(
    parsed: any,
    fallbackName: string,
    sourceUrl: string,
    source: "url" | "paste" | "google",
    sourceLabel: string,
    deterministic?: Partial<BrandBrain>
  ) {
    // Merge order matters. Metadata-derived fields (the `deterministic` partial)
    // come from regex on the actual HTML — they're authoritative. The AI's
    // parsed JSON is inference. So: empty → AI parsed → deterministic wins.
    // Social links merge by key (deterministic wins per platform).
    const aiSocials = (parsed?.social_links && typeof parsed.social_links === "object") ? parsed.social_links : {};
    const detSocials = deterministic?.social_links ?? {};
    const mergedSocials = { ...aiSocials, ...detSocials };

    // For string fields, keep the AI's version only if deterministic is empty.
    // For arrays (platforms, products, etc.), prefer deterministic only if it
    // produced something; otherwise keep AI's.
    const merged: any = { ...emptyBrandBrain(), ...(parsed ?? {}) };
    for (const [k, v] of Object.entries(deterministic ?? {})) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        if (v.length) merged[k] = v;
      } else if (typeof v === "string") {
        if (v.trim()) merged[k] = v;
      } else if (typeof v === "object") {
        // social_links handled separately above; skip here.
        continue;
      } else {
        merged[k] = v;
      }
    }
    merged.social_links = mergedSocials;
    merged.name = merged.business_name || parsed?.business_name || fallbackName;
    merged.business_name = merged.business_name || parsed?.business_name || fallbackName;
    merged.website_url = sourceUrl;
    merged.favicon_url = deterministic?.favicon_url || "";

    // Final fallback: if the AI left inference fields empty (common with
    // Gemini Flash + other light models), backfill from the closest industry
    // template so the user never sees a half-empty cross-check screen. The
    // user can edit anything before saving.
    const { brain: fallbackBrain, filled, templateSlug } = applyIndustryFallback(merged as BrandBrain);
    dlog("[openadkit:brand-extract] industry-fallback:", { templateSlug, filledCount: filled.length, filled });

    setPendingExtraction({ brain: fallbackBrain, source, sourceLabel });
    setQuickStatus(null);
    // Persist as draft so a refresh / crash before user clicks "Save & activate"
    // doesn't waste the AI cost.
    saveDraft({ brain: fallbackBrain, source, sourceLabel, saved_at: Date.now() });
  }

  async function commitPendingExtraction() {
    if (!pendingExtraction) return;
    // Busy guard: a double-click on the Save button used to fire two saves of
    // the same brain. (Audit finding #31.)
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await saveBrain(pendingExtraction.brain, {
        reason: `before AI extraction from ${pendingExtraction.source}`,
      });
      setActiveBrainId(pendingExtraction.brain.id);
      clearDraft();
      window.dispatchEvent(new Event("ados:brains-changed"));
      // After save, route back to the clients list so the user sees the new
      // brand active in context with their other clients.
      router.push("/brand");
    } catch (e: any) {
      setQuickStatus(`Save failed: ${e?.message ?? "IndexedDB error"}. Try again, or pick "Edit before saving" to recover.`);
    } finally {
      busyRef.current = false;
    }
  }

  function editPendingExtraction() {
    if (!pendingExtraction) return;
    setEditing(pendingExtraction.brain);
    setPendingExtraction(null);
  }

  function discardPendingExtraction() {
    setPendingExtraction(null);
    clearDraft();
    setQuickStatus(null);
  }

  async function quickAddFromUrl() {
    if (!quickUrl.trim()) return;
    if (busyRef.current) return;

    // SMART ROUTING (Tier 1.1): if the input doesn't look like a URL (no TLD,
    // has spaces, etc.), treat it as a business name and reroute to Google
    // search. Same with social-only URLs that block scrapers.
    const trimmed = quickUrl.trim();
    if (!looksLikeUrl(trimmed)) {
      setGoogleQuery(trimmed);
      setQuickStatus(`That doesn't look like a domain — searching Google for "${trimmed}" instead…`);
      // Run the Google flow with the input as the query.
      return quickAddFromGoogleInternal(trimmed);
    }
    const social = detectSocial(trimmed);
    if (social) {
      setGoogleQuery(trimmed);
      setQuickStatus(`${social.platform} blocks scrapers — searching Google for the brand instead…`);
      return quickAddFromGoogleInternal(trimmed);
    }

    busyRef.current = true;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    // 90s timeout per call — releases the abort if a single call hangs.
    const timeout = setTimeout(() => abortRef.current?.abort(), 90_000);
    setQuickBusy(true);
    setQuickStatus("① Fetching page content…");
    setShowPaste(false);
    try {
      const r = await ingestUrl(quickUrl, signal);
      if (!r.ok) {
        setQuickStatus(r.message);
        if (r.recoverable) setShowPaste(true);
        return;
      }

      // Multi-page ingest (Tier 1.3): pull /about, /pricing, /services, /contact
      // in parallel. Most brand inference signal lives on subpages, not home.
      setQuickStatus("② Reading homepage + subpages…");
      let aggregatedContent = r.content;
      try {
        const subpages = await ingestSubpages(r, signal, 3);
        if (subpages.pages.length) {
          aggregatedContent = r.content + subpages.extraContent;
          dlog("[openadkit:brand-extract] subpages-ingested:", subpages.pages);
        }
      } catch (subErr) {
        dlog("[openadkit:brand-extract] subpage-ingest failed:", subErr);
      }

      setQuickStatus("③ Reading page metadata (title, OG tags, social links, schema)…");
      const deterministic = deterministicFillFromMetadata(r.metadata, r.url);
      dlog("[openadkit:brand-extract] deterministic fill:", deterministic);
      dlog("[openadkit:brand-extract] raw metadata:", r.metadata);
      const sourceLabel = `${r.url} (via ${
        r.source === "sidecar" ? "local sidecar" :
        r.source === "allorigins" ? "AllOrigins fallback" :
        r.source === "manual" ? "manual paste" :
        "Jina Reader"
      })`;
      setQuickStatus("④ Asking AI to fill the inference-heavy fields (tone, audience, pain points, products)…");
      const res = await llmCall({
        messages: [{ role: "user", content: buildBrandExtractionPrompt({
          website_content: aggregatedContent,
          description: `Brand at ${r.url}`,
          audience_notes: "",
          reviews: "",
          metadata: r.metadata,
          prefilled: {
            business_name: deterministic.business_name,
            industry: deterministic.industry,
            niche: deterministic.niche,
            usp: deterministic.usp,
          },
        }) }],
        maxTokens: 3000,
        temperature: 0.7,
        signal,
      });
      dlog("[openadkit:brand-extract] raw AI response text:", res.text);
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text) ?? {};
      dlog("[openadkit:brand-extract] parsed AI JSON (pass 1):", parsed);
      const fallback = new URL(r.url).hostname.replace(/^www\./, "");

      // Pass 2 — gap-fill. Any inference field still empty gets a focused
      // second AI call. This is the "ask AI to guess from the content" pass.
      const merged1: any = { ...parsed };
      for (const [k, v] of Object.entries(deterministic)) {
        if (v == null) continue;
        if (Array.isArray(v) && !v.length) continue;
        if (typeof v === "string" && !v.trim()) continue;
        merged1[k] = v;
      }
      // GUARANTEED passes (full mode): we ALWAYS run gap-fill + auto-Google so
      // every onboarding pulls maximum signal. Light mode skips both.
      // The "missing" set is computed for prompt-targeting only, not as a gate.
      const missing: string[] = GAP_FILL_FIELDS.filter((f) => isEmptyField(merged1[f]));
      if (missing.includes("objections") && !missing.includes("objection_handling")) missing.push("objection_handling");
      if (missing.includes("objection_handling") && !missing.includes("objections")) missing.push("objections");
      // Force-include core inference fields if pass 1 was completely empty —
      // gives the gap-fill prompt a meaningful field list to anchor on.
      if (missing.length === 0 && Object.keys(parsed).length < 8) {
        missing.push("tone", "audience_who", "audience_pain_points", "audience_desires", "key_benefits");
      }
      if (!lightMode && missing.length) {
        setQuickStatus(`⑤ AI pass 2 — gap-fill (re-asking for ${missing.length} inference field${missing.length === 1 ? "" : "s"})…`);
        try {
          const gapRes = await llmCall({
            messages: [{ role: "user", content: buildBrandGapFillPrompt({
              business_name: deterministic.business_name || parsed.business_name || fallback,
              industry: deterministic.industry || parsed.industry,
              niche: deterministic.niche || parsed.niche,
              usp: deterministic.usp || parsed.usp,
              website_content: aggregatedContent,
              missing_fields: missing as unknown as string[],
            }) }],
            maxTokens: 2000,
            temperature: 0.8,
            signal,
          });
          dlog("[openadkit:brand-extract] raw AI response text (gap-fill):", gapRes.text);
          const gapCost = estimateCostUsd(gapRes.providerId, gapRes.modelId, gapRes.usage);
          addUsage(gapCost, gapRes.usage?.input_tokens ?? 0, gapRes.usage?.output_tokens ?? 0);
          window.dispatchEvent(new Event("ados:usage"));
          const gapParsed = tryParseJson<any>(gapRes.text) ?? {};
          dlog("[openadkit:brand-extract] parsed AI JSON (gap-fill):", gapParsed);
          // Coerce each gap-fill value to the BrandBrain schema's expected type.
          // The model often returns "Instagram, LinkedIn" (string) for an array
          // field; without coercion, brain.platforms.join(...) downstream throws.
          for (const f of missing) {
            const coerced = coerceFieldValue(f, gapParsed[f]);
            if (!isEmptyField(coerced)) parsed[f] = coerced;
          }
          // Trim the longer of objections / objection_handling so indices match.
          const objs: unknown = parsed.objections;
          const handles: unknown = parsed.objection_handling;
          if (Array.isArray(objs) && Array.isArray(handles)) {
            const len = Math.min(objs.length, handles.length);
            parsed.objections = objs.slice(0, len);
            parsed.objection_handling = handles.slice(0, len);
          }
        } catch (gapErr) {
          console.warn("[openadkit:brand-extract] gap-fill pass failed:", gapErr);
        }
      }

      // PASS 3 — ALWAYS runs in full mode (not gated on missing fields). The
      // homepage rarely contains customer reviews, competitor mentions, or
      // audience language; Google search pulls review sites, forums, press —
      // the richest signal for inference fields. Skipped only in light mode.
      const stillMissing = GAP_FILL_FIELDS.filter((f) => isEmptyField(parsed[f]));
      // For the prompt, target both still-empty fields AND core inference
      // fields (so search can refine even fields that are already filled).
      const searchTargets = stillMissing.length
        ? stillMissing
        : ["tone", "audience_who", "audience_pain_points", "audience_desires", "key_benefits", "competitors", "objections", "objection_handling", "words_to_use"];
      const searchableName = deterministic.business_name || parsed.business_name;
      if (searchableName && searchableName.length > 2 && !lightMode) {
        const industryHint = (deterministic.industry || parsed.industry || "").split(/[|·,]/)[0].trim();
        const baseQuery = industryHint
          ? `${searchableName} ${industryHint} reviews competitors customers`
          : `${searchableName} reviews competitors`;
        setQuickStatus(`⑥ AI pass 3 — Google search for "${searchableName}" to pull reviews / competitors / customer language…`);
        try {
          const searchUrl = `https://s.jina.ai/${encodeURIComponent(baseQuery)}`;
          const searchRes = await ingestUrl(searchUrl, signal);
          if (searchRes.ok && searchRes.content && searchRes.content.length > 500) {
            dlog("[openadkit:brand-extract] auto-search content (length):", searchRes.content.length);
            const augRes = await llmCall({
              messages: [{ role: "user", content: buildSearchAugmentedPrompt({
                business_name: searchableName,
                industry: deterministic.industry || parsed.industry,
                niche: deterministic.niche || parsed.niche,
                usp: deterministic.usp || parsed.usp,
                search_content: searchRes.content,
                missing_fields: searchTargets as unknown as string[],
              }) }],
              maxTokens: 2500,
              temperature: 0.7,
              signal,
            });
            dlog("[openadkit:brand-extract] raw AI response text (search-augmented):", augRes.text);
            const augCost = estimateCostUsd(augRes.providerId, augRes.modelId, augRes.usage);
            addUsage(augCost, augRes.usage?.input_tokens ?? 0, augRes.usage?.output_tokens ?? 0);
            window.dispatchEvent(new Event("ados:usage"));
            const augParsed = tryParseJson<any>(augRes.text) ?? {};
            dlog("[openadkit:brand-extract] parsed AI JSON (search-augmented):", augParsed);
            // For fields already filled by pass 1+2, search-augmented values
            // do NOT overwrite — only fills empty fields. Pass 1 result wins.
            for (const f of searchTargets) {
              if (!isEmptyField(parsed[f])) continue;
              const coerced = coerceFieldValue(f, augParsed[f]);
              if (!isEmptyField(coerced)) parsed[f] = coerced;
            }
            // Re-pair objections / objection_handling after the search pass.
            const objs2: unknown = parsed.objections;
            const handles2: unknown = parsed.objection_handling;
            if (Array.isArray(objs2) && Array.isArray(handles2)) {
              const len = Math.min(objs2.length, handles2.length);
              parsed.objections = objs2.slice(0, len);
              parsed.objection_handling = handles2.slice(0, len);
            }
          } else {
            dlog("[openadkit:brand-extract] auto-search returned too little content; skipping");
          }
        } catch (searchErr) {
          console.warn("[openadkit:brand-extract] auto-search pass failed:", searchErr);
        }
      }

      setQuickStatus("⑦ Merging metadata + AI results…");
      stageBrain(parsed, fallback, r.url, "url", sourceLabel, deterministic);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setQuickStatus("Extraction cancelled. Nothing was saved.");
      } else {
        setQuickStatus(e?.message ?? "Failed");
      }
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setQuickBusy(false);
      busyRef.current = false;
    }
  }

  async function quickAddFromPaste() {
    if (!pasted.trim()) return;
    if (busyRef.current) return;
    busyRef.current = true;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const timeout = setTimeout(() => abortRef.current?.abort(), 90_000);
    setQuickBusy(true);
    setQuickStatus("① Asking AI to extract brand intelligence from pasted content…");
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
        signal,
      });
      dlog("[openadkit:brand-extract] raw AI response text (paste):", res.text);
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text) ?? {};
      dlog("[openadkit:brand-extract] parsed AI JSON (paste):", parsed);
      if (!parsed.business_name && !Object.keys(parsed).length) {
        setQuickStatus("AI returned no usable JSON. Check DevTools [openadkit:brand-extract] logs and try again, or fall back to Method 3 / 4.");
        return;
      }
      const fallbackName = quickUrl ? (() => { try { return new URL(/^https?:\/\//i.test(quickUrl) ? quickUrl : `https://${quickUrl}`).hostname.replace(/^www\./, ""); } catch { return "My Brand"; } })() : "My Brand";
      stageBrain(parsed, fallbackName, quickUrl, "paste", `Pasted content${quickUrl ? ` from ${quickUrl}` : ""}`);
    } catch (e: any) {
      if (e?.name === "AbortError") setQuickStatus("Extraction cancelled. Nothing was saved.");
      else setQuickStatus(e?.message ?? "Extraction failed");
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setQuickBusy(false);
      busyRef.current = false;
    }
  }

  // Vision-based extraction (Tier 3.12): user drops a homepage screenshot,
  // and a vision-capable AI reads it directly. Bypasses ingest pipeline.
  async function quickAddFromVision() {
    if (!visionFile) return;
    if (busyRef.current) return;
    const pid = getActiveProviderId();
    const model = getModel();
    if (!pid || !providerSupportsVision(pid as any, model)) {
      setQuickStatus("Active provider doesn't support vision. Switch to Claude / GPT / Gemini in Settings, or use Method 1.");
      return;
    }
    busyRef.current = true;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const timeout = setTimeout(() => abortRef.current?.abort(), 90_000);
    setQuickBusy(true);
    setQuickStatus("① Reading screenshot…");
    try {
      const imagePart: ImagePart = await fileToImagePart(visionFile);
      const content: ContentPart[] = [
        imagePart,
        {
          type: "text",
          text: buildBrandExtractionPrompt({
            website_content: "(see attached homepage screenshot — read it as the page content)",
            description: "Brand homepage screenshot",
            audience_notes: "",
            reviews: "",
          }),
        },
      ];
      setQuickStatus("② Asking vision model to extract brand from screenshot…");
      const res = await llmCall({
        messages: [{ role: "user", content }],
        maxTokens: 3000,
        temperature: 0.7,
        signal,
      });
      dlog("[openadkit:brand-extract] raw AI response text (vision):", res.text);
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text) ?? {};
      if (!parsed.business_name && !Object.keys(parsed).length) {
        setQuickStatus("Vision model returned no usable JSON. Try Method 1 / 4 instead.");
        return;
      }
      stageBrain(parsed, "My Brand", "", "google", `Vision · ${visionFile.name}`);
    } catch (e: any) {
      if (e?.name === "AbortError") setQuickStatus("Cancelled. Nothing was saved.");
      else setQuickStatus(e?.message ?? "Vision extraction failed");
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setQuickBusy(false);
      busyRef.current = false;
    }
  }

  // Google ingest with abort/timeout. Used both by the explicit Method 2 button
  // and by the auto-route fallback from Method 1.
  async function quickAddFromGoogleInternal(query: string) {
    if (!query.trim()) return;
    if (busyRef.current) return;
    busyRef.current = true;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const timeout = setTimeout(() => abortRef.current?.abort(), 90_000);
    setQuickBusy(true);
    setQuickStatus(`① Searching Google for "${query}"…`);
    try {
      const searchUrl = `https://s.jina.ai/${encodeURIComponent(query.trim())}`;
      const r = await ingestUrl(searchUrl, signal);
      if (!r.ok) {
        setQuickStatus(r.message);
        return;
      }
      setQuickStatus("② Asking AI to extract brand intelligence from search results…");
      const res = await llmCall({
        messages: [{ role: "user", content: buildBrandExtractionPrompt({ website_content: r.content, description: `Brand found via Google search: ${query}`, audience_notes: "", reviews: "" }) }],
        maxTokens: 3000,
        temperature: 0.4,
        signal,
      });
      dlog("[openadkit:brand-extract] raw AI response text (google):", res.text);
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<any>(res.text) ?? {};
      dlog("[openadkit:brand-extract] parsed AI JSON (google):", parsed);
      if (!parsed.business_name && !Object.keys(parsed).length) {
        setQuickStatus("AI returned no usable JSON from search results. Try a more specific query or fall back to Method 3 / 4.");
        return;
      }
      stageBrain(parsed, query, "", "google", `Google search · "${query}"`);
    } catch (e: any) {
      if (e?.name === "AbortError") setQuickStatus("Search cancelled. Nothing was saved.");
      else setQuickStatus(e?.message ?? "Google search ingest failed");
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setQuickBusy(false);
      busyRef.current = false;
    }
  }

  function quickAddFromGoogle() {
    return quickAddFromGoogleInternal(googleQuery);
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

      {/* Draft-resume banner — shown when the user crashed/refreshed mid-extraction.
          Lets them recover the staged result without paying for another AI run. */}
      {resumeDraft && !pendingExtraction ? (
        <div className="border-2 border-info bg-info/6 p-4 mb-4 flex items-start gap-3">
          <RefreshCw size={14} className="text-info shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-info mb-1">Unfinished extraction</div>
            <p className="text-[12px] text-ink leading-relaxed">
              You started an extraction for <span className="font-mono text-ink">{resumeDraft.brain.business_name}</span> ({new Date(resumeDraft.saved_at).toLocaleString()}). Resume the cross-check, or discard.
            </p>
            <div className="flex gap-2 mt-2">
              <button onClick={resumeFromDraft} className="btn-primary"><RefreshCw size={11} /> Resume</button>
              <button onClick={dismissResumeDraft} className="btn-ghost"><X size={11} /> Discard</button>
            </div>
          </div>
        </div>
      ) : null}

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
              Best when the brand has a public site. OpenAdKit reads the page via Jina Reader and extracts the brand brain.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="input-base flex-1 min-w-[240px]"
                placeholder="acme.com / clientwebsite.com OR business name"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") quickAddFromUrl(); }}
                disabled={quickBusy}
                aria-label="Client website URL or business name"
              />
              <button onClick={quickAddFromUrl} disabled={quickBusy || !quickUrl.trim()} className="btn-primary">
                {quickBusy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {quickBusy ? "extracting" : "extract"}
              </button>
              {quickBusy ? (
                <button onClick={stopExtraction} className="btn-ghost" title="Cancel the extraction (no charge for partial work)" aria-label="Cancel extraction">
                  <StopCircle size={11} /> stop
                </button>
              ) : null}
            </div>
            {/* Cost preview + light-mode toggle */}
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint cursor-pointer">
                <input type="checkbox" checked={lightMode} onChange={(e) => setLightMode(e.target.checked)} disabled={quickBusy} />
                light mode — single AI call, ~70% cheaper
              </label>
              {costPreview > 0 ? (
                <span className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint tabular">
                  ≈ {formatMoney(costPreview, { fromUsd: true, decimals: 4 })} {lightMode ? "(light)" : "(full)"}
                </span>
              ) : null}
            </div>
            {quickStatus ? (
              <div className={`mt-2 border px-3 py-2 ${quickBusy ? "border-info/40 bg-info/6" : "border-neg/40 bg-neg/5"}`}>
                <div className="flex items-start gap-2">
                  {quickBusy ? <Loader2 size={11} className="animate-spin text-info shrink-0 mt-0.5" /> : <AlertTriangle size={11} className="text-neg shrink-0 mt-0.5" />}
                  <pre className={`text-[11px] font-mono uppercase tracking-ui-wide whitespace-pre-wrap leading-relaxed ${quickBusy ? "text-info" : "text-neg"}`}>{quickStatus}</pre>
                </div>
              </div>
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
                  {quickBusy ? (
                    <button onClick={stopExtraction} className="btn-ghost"><StopCircle size={11} /> stop</button>
                  ) : null}
                  <button onClick={() => { setShowPaste(false); setPasted(""); }} disabled={quickBusy} className="btn-ghost">
                    close
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
          <div className="border border-info/30 bg-info/4 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Search size={14} className="text-info" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-info">Method 2 · search Google by business name</span>
            </div>
            <p className="text-[12px] text-ink-muted mb-2 leading-relaxed">
              Use this when the client has no website, or when the site blocks scrapers (most Instagram and Facebook profiles). OpenAdKit runs a Google search via Jina, then extracts from the top results.
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
              {quickBusy ? (
                <button onClick={stopExtraction} className="btn-ghost" title="Cancel">
                  <StopCircle size={11} /> stop
                </button>
              ) : null}
            </div>
          </div>

          {/* Method 2.5 — vision: drop a homepage screenshot */}
          <div className="border border-info/20 bg-info/3 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon size={14} className="text-info" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-info">Method 2.5 · drop a homepage screenshot</span>
            </div>
            <p className="text-[12px] text-ink-muted mb-2 leading-relaxed">
              Vision-capable providers (Claude / GPT / Gemini) read the screenshot directly — sometimes catches more than stripped HTML. Open the homepage, screenshot it, drop the PNG here.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setVisionFile(e.target.files?.[0] ?? null)}
                disabled={quickBusy}
                className="text-[11px] font-mono text-ink-muted"
                aria-label="Upload homepage screenshot for vision extraction"
              />
              <button onClick={quickAddFromVision} disabled={quickBusy || !visionFile} className="btn-primary">
                {quickBusy ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                {quickBusy ? "reading…" : "extract from image"}
              </button>
              {quickBusy ? (
                <button onClick={stopExtraction} className="btn-ghost" title="Cancel" aria-label="Cancel image extraction">
                  <StopCircle size={11} /> stop
                </button>
              ) : null}
            </div>
          </div>

          {/* Method 3: Industry templates */}
          <div className="border border-base-600 bg-base-900/40 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Method 3 · start from an industry template</span>
            </div>
            <p className="text-[12px] text-ink-muted mb-3 leading-relaxed">
              No website, no Google footprint, or just want a starting skeleton? Pick the closest industry — OpenAdKit pre-fills typical audience, tone, and positioning that you can refine.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {INDUSTRY_TEMPLATES.map((t) => (
                <button
                  key={t.slug}
                  onClick={async () => {
                    const b = t.apply({ business_name: "" });
                    // Save the skeleton but DON'T activate it yet — if the user
                    // abandons the form their other tools would all run against
                    // an empty brain. Activation happens when BrandBrainForm's
                    // own save action fires. (Audit finding #62.)
                    // Brand-new skeleton — nothing to snapshot.
                    await saveBrain(b, { skipVersion: true });
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
    <div className="border-2 border-live bg-live/4 p-5 mb-6 animate-fade-up">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 h-8 w-8 grid place-items-center bg-live text-base-950 font-bold rounded-xs">2</div>
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
        <div className="flex items-start gap-2 border border-neg/40 bg-neg/5 px-3 py-2 mb-3">
          <AlertTriangle size={12} className="text-neg shrink-0 mt-0.5" />
          <span className="text-[11px] text-ink">
            Some <strong className="text-neg">core fields are empty</strong>. The AI didn't find them — click <em>Edit before saving</em> to fill them by hand, or save now and edit later.
          </span>
        </div>
      ) : null}

      {/* Two-section UI: core 6 fields always shown; everything else collapsed
          under an accordion. Accordion auto-expands when something inside is
          still empty so the user sees the gap. (Tier 2.6 onboarding polish.) */}
      <CrossCheckFields fields={fields} socials={socials} />

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

function CrossCheckFields({ fields, socials }: { fields: Array<{ label: string; value: string | string[] | undefined; weight: "core" | "important" | "extra" }>; socials: Array<[string, string]> }) {
  const isFilled = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!(v && v.trim()));
  const coreFields = fields.filter((f) => f.weight === "core");
  const extraFields = fields.filter((f) => f.weight !== "core");
  const extraHasGap = extraFields.some((f) => !isFilled(f.value));
  const [expanded, setExpanded] = useState(extraHasGap);

  const renderRow = (f: { label: string; value: string | string[] | undefined; weight: "core" | "important" | "extra" }) => {
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
  };

  return (
    <>
      <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-2">Essentials (required)</div>
      <div className="space-y-1 mb-3">
        {coreFields.map(renderRow)}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-ui-wide text-info hover:text-ink transition mb-2"
      >
        {expanded ? "▾" : "▸"} {expanded ? "Hide" : "Show"} {extraFields.length} more fields
        {!expanded && extraHasGap ? <span className="text-neg">· some empty</span> : null}
      </button>

      {expanded ? (
        <div className="space-y-1">
          {extraFields.map(renderRow)}
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
      ) : null}
    </>
  );
}
