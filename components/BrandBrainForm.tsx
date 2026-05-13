"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, Loader2, Globe, RefreshCw } from "lucide-react";
import { emptyBrandBrain, type BrandBrain } from "@/lib/brand-brain";
import { saveBrain } from "@/lib/storage";
import { setActiveBrainId, addUsage } from "@/lib/settings";
import { llmCall, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { buildBrandExtractionPrompt } from "@/lib/prompts/brand-extraction";
import { ingestUrl, detectSocial } from "@/lib/url-ingest";

type ListField =
  | "personality_traits"
  | "words_to_use"
  | "words_to_avoid"
  | "audience_pain_points"
  | "audience_desires"
  | "key_benefits"
  | "key_messages"
  | "objections"
  | "objection_handling"
  | "competitors"
  | "differentiators"
  | "voc_phrases"
  | "voc_pain_quotes"
  | "voc_success_quotes"
  | "best_performing_angles"
  | "failed_angles";

const joinList = (arr: string[]) => arr.join("\n");
const splitList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

interface Props {
  initial?: BrandBrain;
}

export function BrandBrainForm({ initial }: Props) {
  const router = useRouter();
  const [brain, setBrain] = useState<BrandBrain>(initial ?? emptyBrandBrain());
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractInput, setExtractInput] = useState({
    description: "",
    audience_notes: "",
    website_content: "",
    reviews: "",
  });
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof BrandBrain>(key: K, value: BrandBrain[K]) {
    setBrain((b) => ({ ...b, [key]: value }));
  }
  function setList(key: ListField, raw: string) {
    setBrain((b) => ({ ...b, [key]: splitList(raw) }));
  }
  function setSocial(platform: keyof BrandBrain["social_links"], value: string) {
    setBrain((b) => ({ ...b, social_links: { ...b.social_links, [platform]: value } }));
  }
  function setCsv(key: "platforms", raw: string) {
    setBrain((b) => ({ ...b, [key]: raw.split(",").map((s) => s.trim()).filter(Boolean) }));
  }
  function togglePending(key: string, on: boolean) {
    setBrain((b) => {
      const set = new Set(b.pending_user_input ?? []);
      if (on) set.add(key); else set.delete(key);
      return { ...b, pending_user_input: [...set] };
    });
  }

  // Which essentials are still blank — used to surface a "fill later or fill now" prompt.
  const missingEssentials: { key: string; label: string }[] = [];
  if (!brain.platforms?.length) missingEssentials.push({ key: "platforms", label: "Active platforms" });
  if (!brain.content_pillars?.length) missingEssentials.push({ key: "content_pillars", label: "Content pillars" });
  if (!Object.values(brain.social_links ?? {}).some((v) => v && String(v).trim())) {
    missingEssentials.push({ key: "social_links", label: "Social media links" });
  }
  const pending = new Set(brain.pending_user_input ?? []);
  const blocking = missingEssentials.filter((m) => !pending.has(m.key));

  async function extract() {
    setError(null);
    if (!extractInput.description.trim() && !extractInput.website_content?.trim()) {
      setError("Add at least a description or paste website content before extracting.");
      return;
    }
    setExtracting(true);
    try {
      const prompt = buildBrandExtractionPrompt(extractInput);
      const res = await llmCall({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 3000,
        temperature: 0.4,
      });
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<Partial<BrandBrain>>(res.text);
      if (!parsed) {
        setError("Model returned non-JSON. You can edit fields manually.");
        return;
      }
      setBrain((b) => ({
        ...b,
        ...parsed,
        name: b.name || parsed.business_name || "",
      } as BrandBrain));
    } catch (e: any) {
      setError(e?.message ?? "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function ingestFromUrl() {
    setError(null);
    const url = (brain.website_url || "").trim();
    if (!url) {
      setError("Enter a website URL in the form first.");
      return;
    }
    setExtracting(true);
    try {
      const social = detectSocial(url);
      if (social) {
        window.open(social.openUrl, "_blank", "noopener,noreferrer");
        setError(`${social.platform} pages can't be read by the browser-side reader. Opened in a new tab — copy bio + recent posts back into the "Customer reviews" / "Website content" boxes, then click Extract.`);
        return;
      }
      const r = await ingestUrl(url);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setExtractInput((cur) => ({ ...cur, website_content: r.content }));
      // Auto-extract using the freshly-fetched content
      const prompt = buildBrandExtractionPrompt({
        website_content: r.content,
        description: extractInput.description || `Content extracted from ${url}`,
        audience_notes: extractInput.audience_notes,
        reviews: extractInput.reviews,
      });
      const res = await llmCall({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 3000,
        temperature: 0.4,
      });
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      const parsed = tryParseJson<Partial<BrandBrain>>(res.text);
      if (parsed) {
        setBrain((b) => ({
          ...b,
          ...parsed,
          name: b.name || parsed.business_name || "",
          website_url: url,
        } as BrandBrain));
      }
    } catch (e: any) {
      setError(e?.message ?? "URL ingest failed");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    setError(null);
    if (!brain.business_name.trim()) {
      setError("Business name is required.");
      return;
    }
    if (blocking.length) {
      setError(
        `Still missing: ${blocking.map((m) => m.label).join(", ")}. Either fill them in or tick "Fill later" on each row.`
      );
      return;
    }
    setSaving(true);
    try {
      const toSave: BrandBrain = {
        ...brain,
        name: brain.name || brain.business_name,
      };
      await saveBrain(toSave);
      setActiveBrainId(toSave.id);
      window.dispatchEvent(new Event("ados:brains-changed"));
      router.push("/");
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-900 bg-red-950/40 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      ) : null}

      <section className="card">
        <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted mb-1">AI extract from a description</h2>
        <p className="text-xs text-ink-muted mb-4">
          Paste anything you have — landing page copy, a paragraph about your business, recent reviews.
          Claude will fill the form below. You can still edit everything by hand.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Business description</label>
            <textarea
              rows={4}
              className="input-base"
              placeholder="What do you sell, to whom, what makes it different?"
              value={extractInput.description}
              onChange={(e) => setExtractInput({ ...extractInput, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Audience notes (optional)</label>
            <textarea
              rows={4}
              className="input-base"
              placeholder="Who exactly is your customer? Pain points? Desires?"
              value={extractInput.audience_notes}
              onChange={(e) => setExtractInput({ ...extractInput, audience_notes: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Website / landing content (optional)</label>
            <textarea
              rows={4}
              className="input-base"
              placeholder="Paste your homepage hero, features, FAQ…"
              value={extractInput.website_content}
              onChange={(e) =>
                setExtractInput({ ...extractInput, website_content: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Customer reviews (optional)</label>
            <textarea
              rows={4}
              className="input-base"
              placeholder="Paste 3–10 real customer reviews. They become your VOC."
              value={extractInput.reviews}
              onChange={(e) => setExtractInput({ ...extractInput, reviews: e.target.value })}
            />
          </div>
        </div>
        <button onClick={extract} disabled={extracting} className="btn-primary mt-4">
          {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {extracting ? "Extracting…" : "Extract Brand Brain"}
        </button>
      </section>

      <section className="card space-y-4">
        <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">Brand Brain fields</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Brain name (label)" value={brain.name} onChange={(v) => setField("name", v)} />
          <Field
            label="Business name *"
            value={brain.business_name}
            onChange={(v) => setField("business_name", v)}
          />
          <Field label="Industry" value={brain.industry} onChange={(v) => setField("industry", v)} />
          <div>
            <label className="label flex items-center gap-1.5"><Globe size={11} /> Website URL</label>
            <div className="flex gap-1">
              <input
                className="input-base flex-1"
                value={brain.website_url ?? ""}
                onChange={(e) => setField("website_url", e.target.value)}
                placeholder="https://example.com"
              />
              <button
                onClick={ingestFromUrl}
                disabled={extracting}
                className="btn-ghost shrink-0"
                title="Re-fetch from this URL"
                type="button"
              >
                <RefreshCw size={11} className={extracting ? "animate-spin" : ""} /> sync
              </button>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-1">paste any URL · auto-extract with one click</p>
          </div>
          <Field label="Tone" value={brain.tone} onChange={(v) => setField("tone", v)} />
          <Field
            label="Writing style"
            value={brain.writing_style}
            onChange={(v) => setField("writing_style", v)}
          />
          <Field
            label="USP (one sentence)"
            value={brain.usp}
            onChange={(v) => setField("usp", v)}
          />
          <Field
            label="Price positioning"
            value={brain.price_positioning}
            onChange={(v) => setField("price_positioning", v)}
            placeholder="premium / mid / affordable / freemium"
          />
        </div>

        <section className="border border-live/30 bg-live/[0.03] p-4 rounded-md space-y-4">
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-ui-mega text-live">Onboarding essentials · auto-filled from website</h3>
            <p className="text-xs text-ink-muted mt-1">
              These drive every generator downstream — Content Calendar, Hashtags, Reels, Strategy. Edit
              anything AI got wrong. If you don't have something on hand, tick <em>Fill later</em> and
              move on.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Niche (one-sentence positioning)"
              value={brain.niche}
              onChange={(v) => setField("niche", v)}
              placeholder="DTC sleep brand selling weighted blankets to women 35-55"
            />
            <ListInput
              label="Products / offers"
              value={brain.products}
              onChange={(v) => setBrain((b) => ({ ...b, products: splitList(v) }))}
            />
          </div>

          <PendingRow
            label="Active social platforms"
            hint="Comma-separated · e.g. Instagram, TikTok, LinkedIn"
            empty={!brain.platforms?.length}
            pending={pending.has("platforms")}
            onTogglePending={(on) => togglePending("platforms", on)}
          >
            <input
              className="input-base"
              value={(brain.platforms ?? []).join(", ")}
              onChange={(e) => setCsv("platforms", e.target.value)}
              placeholder="Instagram, TikTok, LinkedIn"
            />
          </PendingRow>

          <PendingRow
            label="Content pillars (recurring themes)"
            hint="One per line · 4-6 themes the brand consistently posts about"
            empty={!brain.content_pillars?.length}
            pending={pending.has("content_pillars")}
            onTogglePending={(on) => togglePending("content_pillars", on)}
          >
            <textarea
              rows={3}
              className="input-base font-mono text-xs"
              value={joinList(brain.content_pillars ?? [])}
              onChange={(e) => setBrain((b) => ({ ...b, content_pillars: splitList(e.target.value) }))}
              placeholder={"Founder stories\nBehind the scenes\nCustomer wins\nProduct education"}
            />
          </PendingRow>

          <PendingRow
            label="Social media links"
            hint="Paste full URL or @handle for each platform the brand uses"
            empty={!Object.values(brain.social_links ?? {}).some((v) => v && String(v).trim())}
            pending={pending.has("social_links")}
            onTogglePending={(on) => togglePending("social_links", on)}
          >
            <div className="grid gap-2 md:grid-cols-2">
              {(["instagram", "tiktok", "youtube", "linkedin", "twitter", "facebook"] as const).map((p) => (
                <div key={p}>
                  <label className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint">{p}</label>
                  <input
                    className="input-base"
                    value={(brain.social_links as any)?.[p] ?? ""}
                    onChange={(e) => setSocial(p, e.target.value)}
                    placeholder={p === "tiktok" ? "@brand or full URL" : "@brand or full URL"}
                  />
                </div>
              ))}
            </div>
          </PendingRow>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <ListInput
            label="Personality traits"
            value={brain.personality_traits}
            onChange={(v) => setList("personality_traits", v)}
          />
          <ListInput
            label="Words to use"
            value={brain.words_to_use}
            onChange={(v) => setList("words_to_use", v)}
          />
          <ListInput
            label="Words to avoid"
            value={brain.words_to_avoid}
            onChange={(v) => setList("words_to_avoid", v)}
          />
          <ListInput
            label="Key benefits"
            value={brain.key_benefits}
            onChange={(v) => setList("key_benefits", v)}
          />
          <ListInput
            label="Key messages"
            value={brain.key_messages}
            onChange={(v) => setList("key_messages", v)}
          />
          <Field
            label="Audience — who"
            value={brain.audience_who}
            onChange={(v) => setField("audience_who", v)}
          />
          <Field
            label="Audience — demographics"
            value={brain.audience_demographics}
            onChange={(v) => setField("audience_demographics", v)}
          />
          <ListInput
            label="Audience pain points"
            value={brain.audience_pain_points}
            onChange={(v) => setList("audience_pain_points", v)}
          />
          <ListInput
            label="Audience desires"
            value={brain.audience_desires}
            onChange={(v) => setList("audience_desires", v)}
          />
          <ListInput
            label="Objections"
            value={brain.objections}
            onChange={(v) => setList("objections", v)}
          />
          <ListInput
            label="Objection handling (same order)"
            value={brain.objection_handling}
            onChange={(v) => setList("objection_handling", v)}
          />
          <ListInput
            label="Competitors"
            value={brain.competitors}
            onChange={(v) => setList("competitors", v)}
          />
          <ListInput
            label="Differentiators"
            value={brain.differentiators}
            onChange={(v) => setList("differentiators", v)}
          />
          <ListInput
            label="VOC phrases (real customer wording)"
            value={brain.voc_phrases}
            onChange={(v) => setList("voc_phrases", v)}
          />
          <ListInput
            label="Best-performing angles"
            value={brain.best_performing_angles}
            onChange={(v) => setList("best_performing_angles", v)}
          />
          <ListInput
            label="Failed angles"
            value={brain.failed_angles}
            onChange={(v) => setList("failed_angles", v)}
          />
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save Brand Brain"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input-base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ListInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label} <span className="text-zinc-600 normal-case">· one per line</span></label>
      <textarea
        rows={3}
        className="input-base font-mono text-xs"
        value={joinList(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * Onboarding row that surfaces a "Fill later" checkbox when the value is empty.
 * Lets the user move past the field without filling it, while recording that
 * intent in `brain.pending_user_input` so we can nudge them later.
 */
function PendingRow({
  label,
  hint,
  empty,
  pending,
  onTogglePending,
  children,
}: {
  label: string;
  hint?: string;
  empty: boolean;
  pending: boolean;
  onTogglePending: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="label">{label}</label>
        {empty ? (
          <label className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-muted flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pending}
              onChange={(e) => onTogglePending(e.target.checked)}
              className="accent-live h-3 w-3"
            />
            <span>Fill later</span>
          </label>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-ui-wide text-pos">✓ filled</span>
        )}
      </div>
      <div className={pending ? "opacity-50" : ""}>{children}</div>
      {hint ? <p className="text-[10px] text-ink-subtle mt-1">{hint}</p> : null}
    </div>
  );
}
