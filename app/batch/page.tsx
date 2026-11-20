"use client";

import { useEffect, useRef, useState } from "react";
import type { ZodTypeAny } from "zod";
import Link from "next/link";
import { Loader2, Sparkles, Check, X, AlertTriangle, ChevronDown, ChevronRight, StopCircle } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { listBrains, saveAd, type GeneratedAd } from "@/lib/storage";
import { type BrandBrain, buildBrandSystemPrompt } from "@/lib/brand-brain";
import { llmStream, estimateCostUsd } from "@/lib/llm";
import { validateOrRetry, StructuredLlmError } from "@/lib/llm-structured";
import { addUsage, getLanguage, getToneOverride } from "@/lib/settings";
import { assertWithinBudget } from "@/lib/budget";
import { buildContentCalendarPrompt } from "@/lib/prompts/content-calendar";
import { buildHashtagPrompt } from "@/lib/prompts/hashtags";
import { buildCampaignKitPrompt } from "@/lib/prompts/campaign-kit";
import { buildReelIdeasPrompt } from "@/lib/prompts/reel-ideas";
import { ContentCalendarSchema } from "@/lib/schemas/content-calendar";
import { CampaignKitSchema } from "@/lib/schemas/campaign-kit";
import { HashtagsSchema, ReelIdeasSchema } from "@/lib/schemas/generators";

type AssetKind = "content_calendar" | "hashtags" | "campaign_kit" | "reel_ideas";

interface RunResult {
  brain_id: string;
  brain_name: string;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  ad_id?: string;
  error?: string;
  text?: string;
  json?: any;
  /** True when the first reply failed schema validation and a correction pass
   *  recovered it — surfaced in the UI so the result is never silently "fixed". */
  recovered?: boolean;
}

export default function Page() {
  return (
    <ApiKeyGate>
      <Inner />
    </ApiKeyGate>
  );
}

function Inner() {
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assetKind, setAssetKind] = useState<AssetKind>("content_calendar");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Master AbortController so the user can cancel an in-progress batch.
  const abortRef = useRef<AbortController | null>(null);
  function stopBatch() {
    abortRef.current?.abort();
  }

  // Shared asset config (one form for the whole batch — each client's brain
  // colors the output, but the asset spec is uniform across clients).
  const [contentCalendarCfg, setContentCalendarCfg] = useState({
    duration: "1_week" as "1_week" | "2_weeks" | "1_month",
    cadence_per_week: 3,
    primary_goal: "engagement",
  });
  const [hashtagsCfg, setHashtagsCfg] = useState({
    platform: "instagram",
    topic_or_post: "",
    count: 25,
  });
  const [reelIdeasCfg, setReelIdeasCfg] = useState({
    platform: "instagram_reels" as "instagram_reels" | "tiktok" | "youtube_shorts" | "facebook_reels",
    reel_count: 8,
    duration_seconds: 30,
    goal: "awareness",
  });
  const [campaignKitCfg, setCampaignKitCfg] = useState({
    campaign_name: "Weekly batch · {client}",
    goal: "1000 trial signups",
    budget_monthly: "$5,000",
  });

  useEffect(() => {
    (async () => {
      const list = await listBrains();
      setBrains(list);
    })();
  }, []);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(brains.map((b) => b.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  function buildPromptFor(
    kind: AssetKind,
    brain: BrandBrain
  ): { prompt: string; platform: GeneratedAd["platform"]; campaign_type: string; max: number; schema: ZodTypeAny } {
    switch (kind) {
      case "content_calendar":
        return {
          schema: ContentCalendarSchema,
          prompt: buildContentCalendarPrompt({
            duration: contentCalendarCfg.duration,
            cadence_per_week: contentCalendarCfg.cadence_per_week,
            platforms: (brain.platforms?.length ? brain.platforms : ["Instagram", "TikTok", "LinkedIn"]).join(", "),
            pillars: (brain.content_pillars?.length ? brain.content_pillars : brain.key_messages ?? []).join(" · ") || "Founder stories · Product education · Customer wins",
            primary_goal: contentCalendarCfg.primary_goal,
            voice_notes: brain.tone || "(brand brain default)",
            posting_window: "anytime",
            region_or_timezone: brain.audience_demographics || "(unspecified)",
          } as any),
          platform: "meta",
          campaign_type: "Content Calendar (batch)",
          max: 5500,
        };
      case "hashtags":
        return {
          schema: HashtagsSchema,
          prompt: buildHashtagPrompt({
            title: hashtagsCfg.topic_or_post || brain.usp || brain.business_name,
            platform: hashtagsCfg.platform as any,
            language: getLanguage() || "English",
            context: brain.niche || brain.industry || "",
          }),
          platform: "meta",
          campaign_type: "Hashtags (batch)",
          max: 2500,
        };
      case "reel_ideas":
        return {
          schema: ReelIdeasSchema,
          prompt: buildReelIdeasPrompt({
            platform: reelIdeasCfg.platform,
            reel_count: reelIdeasCfg.reel_count,
            duration_seconds: reelIdeasCfg.duration_seconds,
            goal: reelIdeasCfg.goal,
            pillars: (brain.content_pillars ?? []).join(" · "),
          } as any),
          platform: "tiktok",
          campaign_type: "Reel Ideas (batch)",
          max: 6000,
        };
      case "campaign_kit":
        return {
          schema: CampaignKitSchema,
          prompt: buildCampaignKitPrompt({
            campaign_name: campaignKitCfg.campaign_name.replace("{client}", brain.business_name),
            product: brain.business_name,
            primary_offer: brain.usp || brain.key_benefits?.[0] || "",
            audience: brain.audience_who || "",
            goal: campaignKitCfg.goal,
            budget_monthly: campaignKitCfg.budget_monthly,
          } as any),
          platform: "google",
          campaign_type: "Campaign Kit (batch)",
          max: 5500,
        };
    }
  }

  async function runBatch() {
    setError(null);
    if (!selected.size) return setError("Pick at least one client.");
    // Batch is the single easiest way to blow a month's API budget — N clients
    // x one call each, fired in parallel. Check the ceiling before firing any.
    try {
      const budget = await assertWithinBudget();
      if (budget.warning && !budget.exceeded) {
        setError(
          `Heads up: $${budget.spentUsd.toFixed(2)} of $${budget.limitUsd.toFixed(2)} monthly budget used. Running ${selected.size} more generation${selected.size === 1 ? "" : "s"}.`
        );
      }
    } catch (e: any) {
      return setError(e?.message ?? "Monthly budget reached.");
    }
    setRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const chosen = brains.filter((b) => selected.has(b.id));
    const initial: RunResult[] = chosen.map((b) => ({
      brain_id: b.id,
      brain_name: b.name || b.business_name,
      status: "pending",
    }));
    setResults(initial);

    // Run all clients in parallel — each is one LLM call. Promise.allSettled so
    // one failure doesn't drop the rest. All share the master abort signal so
    // a Stop click cancels every in-flight call.
    await Promise.allSettled(
      chosen.map(async (brain, i) => {
        setResults((cur) => cur.map((r, idx) => (idx === i ? { ...r, status: "running", text: "" } : r)));
        try {
          const built = buildPromptFor(assetKind, brain);
          const system = buildBrandSystemPrompt(brain, { language: getLanguage(), tone_override: getToneOverride() });
          let accumulated = "";
          const res = await llmStream(
            {
              system,
              messages: [{ role: "user", content: built.prompt }],
              maxTokens: built.max,
              temperature: 0.75,
              signal,
            },
            {
              onDelta: (delta) => {
                accumulated += delta;
                setResults((cur) => cur.map((r, idx) => (idx === i ? { ...r, text: accumulated } : r)));
              },
            }
          );
          let cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
          let inTokens = res.usage?.input_tokens ?? 0;
          let outTokens = res.usage?.output_tokens ?? 0;
          // Empty-text fallback — Gemini in particular occasionally returns
          // res.text="" even when streaming worked correctly. Use accumulated
          // buffer so saved ads always have content.
          let finalText = res.text || accumulated;

          // Schema validation with one corrective round-trip, matching
          // GeneratorShell. Batch used to blind-trust tryParseJson, so the
          // "no false results" guarantee didn't apply to the one surface that
          // fans a single prompt across every client at once.
          let json: any = null;
          let recovered = false;
          const v = await validateOrRetry({
            schema: built.schema,
            raw: finalText,
            system,
            originalPrompt: built.prompt,
            signal,
            maxTokens: built.max,
          });
          json = v.data;
          recovered = v.recovered;
          if (v.recovered) {
            finalText = v.raw || finalText;
            cost += v.costUsd;
            inTokens += v.usage?.input_tokens ?? 0;
            outTokens += v.usage?.output_tokens ?? 0;
          }
          addUsage(cost, inTokens, outTokens);

          const ad: GeneratedAd = {
            id: crypto.randomUUID(),
            brand_id: brain.id,
            platform: built.platform,
            campaign_type: built.campaign_type,
            title: `${built.campaign_type} · ${brain.business_name}`,
            input: { batch: true, kind: assetKind } as any,
            output_json: json,
            output_text: finalText,
            model_id: res.modelId,
            usage_input_tokens: inTokens,
            usage_output_tokens: outTokens,
            cost_usd: cost,
            starred: false,
            status: "draft",
            notes: "Generated via /batch · multi-client mode",
            created_at: Date.now(),
            prompt: built.prompt,
            provider_id: res.providerId,
          };
          await saveAd(ad);

          setResults((cur) =>
            cur.map((r, idx) =>
              // `finalText`, NOT `res.text`: on providers that return an empty
              // res.text after a successful stream, using res.text here blanked
              // the panel the instant the row flipped to "done" — the user
              // watched their output vanish even though the ad saved fine.
              idx === i ? { ...r, status: "done", ad_id: ad.id, text: finalText, json, recovered } : r
            )
          );
        } catch (e: any) {
          // A user-initiated Stop is not an error — surfacing the raw
          // "signal is aborted without reason" DOM exception on every row made
          // a deliberate cancel look like a batch-wide failure.
          const aborted = e?.name === "AbortError" || signal.aborted;
          const message = aborted
            ? "Cancelled."
            : e instanceof StructuredLlmError
              ? `${e.message} Try a different provider — Claude / GPT / Gemini are most reliable for structured output.`
              : e?.message ?? "Failed";
          setResults((cur) =>
            cur.map((r, idx) =>
              idx === i ? { ...r, status: aborted ? "cancelled" : "error", error: message } : r
            )
          );
        }
      })
    );
    window.dispatchEvent(new Event("ados:usage"));
    setRunning(false);
  }

  const doneCount = results.filter((r) => r.status === "done").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const cancelledCount = results.filter((r) => r.status === "cancelled").length;

  return (
    <div>
      <PageHeader
        scope="batch"
        title="Multi-Client Batch Mode"
        subtitle="Pick any number of clients → generate the same asset for every one in a single parallel run. Each output uses that client's own brand brain — same template, different voices."
        showLive={running}
      />

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="border border-base-600 bg-base-900/40 p-5 space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">1 · Clients</h2>
            {brains.length === 0 ? (
              <div className="border border-live/30 bg-live/5 text-live text-[12px] px-3 py-2 flex gap-2 items-start">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>No clients yet. <Link href="/brand" className="underline">Create one</Link> to use batch mode.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-ui-wide">
                  <button onClick={selectAll} className="text-live hover:underline">select all</button>
                  <button onClick={clearAll} className="text-ink-muted hover:text-ink">clear</button>
                  <div className="flex-1" />
                  <span className="text-ink-faint">{selected.size}/{brains.length}</span>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {brains.map((b) => {
                    const on = selected.has(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-start gap-2 px-2 py-1.5 border cursor-pointer transition ${
                          on ? "border-live bg-live/5" : "border-base-700 hover:border-base-500"
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(b.id)} className="accent-live mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink truncate">{b.business_name || b.name}</div>
                          <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint truncate">
                            {b.industry || "no industry"} · {(b.platforms ?? []).join(", ") || "no platforms set"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="border border-base-600 bg-base-900/40 p-5 space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">2 · Asset to generate</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ["content_calendar", "Content Calendar"],
                ["hashtags", "Hashtag Stack"],
                ["reel_ideas", "Reel Ideas"],
                ["campaign_kit", "Campaign Kit"],
              ] as [AssetKind, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setAssetKind(k)}
                  className={`text-[12px] px-3 py-2 border transition text-left ${
                    assetKind === k ? "border-live bg-live text-base-950 font-semibold" : "border-base-600 text-ink-muted hover:border-base-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Asset-specific config */}
            <div className="border-t border-base-700 pt-3 space-y-2">
              {assetKind === "content_calendar" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Duration</label>
                      <select className="input-base" value={contentCalendarCfg.duration} onChange={(e) => setContentCalendarCfg({ ...contentCalendarCfg, duration: e.target.value as any })}>
                        <option value="1_week">1 week</option>
                        <option value="2_weeks">2 weeks</option>
                        <option value="1_month">1 month</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Posts / week / platform</label>
                      <input type="number" className="input-base tabular" value={contentCalendarCfg.cadence_per_week} onChange={(e) => setContentCalendarCfg({ ...contentCalendarCfg, cadence_per_week: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Goal</label>
                    <select className="input-base" value={contentCalendarCfg.primary_goal} onChange={(e) => setContentCalendarCfg({ ...contentCalendarCfg, primary_goal: e.target.value })}>
                      <option value="awareness">Awareness</option>
                      <option value="engagement">Engagement</option>
                      <option value="lead gen">Lead generation</option>
                      <option value="nurture">Nurture</option>
                      <option value="sales">Sales</option>
                    </select>
                  </div>
                </>
              ) : assetKind === "hashtags" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Platform</label>
                      <select className="input-base" value={hashtagsCfg.platform} onChange={(e) => setHashtagsCfg({ ...hashtagsCfg, platform: e.target.value })}>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="twitter">X / Twitter</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="youtube">YouTube</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Count</label>
                      <input type="number" className="input-base tabular" value={hashtagsCfg.count} onChange={(e) => setHashtagsCfg({ ...hashtagsCfg, count: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Topic / post hook (blank = use brain.usp)</label>
                    <input className="input-base" value={hashtagsCfg.topic_or_post} onChange={(e) => setHashtagsCfg({ ...hashtagsCfg, topic_or_post: e.target.value })} placeholder="Leave empty to default per-client to their USP" />
                  </div>
                </>
              ) : assetKind === "reel_ideas" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Platform</label>
                      <select className="input-base" value={reelIdeasCfg.platform} onChange={(e) => setReelIdeasCfg({ ...reelIdeasCfg, platform: e.target.value as any })}>
                        <option value="instagram_reels">Instagram Reels</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube_shorts">YouTube Shorts</option>
                        <option value="facebook_reels">Facebook Reels</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Goal</label>
                      <select className="input-base" value={reelIdeasCfg.goal} onChange={(e) => setReelIdeasCfg({ ...reelIdeasCfg, goal: e.target.value })}>
                        <option value="awareness">Awareness</option>
                        <option value="education">Education</option>
                        <option value="sales">Sales</option>
                        <option value="community">Community</option>
                        <option value="launch">Launch</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Ideas per client</label>
                      <input type="number" className="input-base tabular" value={reelIdeasCfg.reel_count} onChange={(e) => setReelIdeasCfg({ ...reelIdeasCfg, reel_count: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label">Duration (sec)</label>
                      <input type="number" className="input-base tabular" value={reelIdeasCfg.duration_seconds} onChange={(e) => setReelIdeasCfg({ ...reelIdeasCfg, duration_seconds: Number(e.target.value) })} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Campaign name (use {"{client}"} placeholder)</label>
                    <input className="input-base" value={campaignKitCfg.campaign_name} onChange={(e) => setCampaignKitCfg({ ...campaignKitCfg, campaign_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Goal</label>
                      <input className="input-base" value={campaignKitCfg.goal} onChange={(e) => setCampaignKitCfg({ ...campaignKitCfg, goal: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Budget / mo</label>
                      <input className="input-base" value={campaignKitCfg.budget_monthly} onChange={(e) => setCampaignKitCfg({ ...campaignKitCfg, budget_monthly: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {error ? (
              <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">{error}</div>
            ) : null}

            <div className="flex gap-2">
              <button onClick={runBatch} disabled={running || selected.size === 0} className="btn-primary flex-1">
                {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {running ? `Running ${selected.size} in parallel…` : `Generate for ${selected.size} client${selected.size === 1 ? "" : "s"}`}
              </button>
              {running ? (
                <button onClick={stopBatch} className="btn-ghost" title="Cancel all in-flight calls">
                  <StopCircle size={12} /> stop
                </button>
              ) : null}
            </div>
            <p className="text-[10px] text-ink-subtle font-mono uppercase tracking-ui-wide">
              All runs fire in parallel. Each client's brand brain is used to color its own output.
            </p>
          </div>
        </section>

        <section className="lg:col-span-3 space-y-3">
          {results.length === 0 ? (
            <div className="border border-dashed border-base-600 bg-base-900/20 text-[11px] font-mono uppercase tracking-ui-mega text-ink-faint min-h-[260px] grid place-items-center">
              Pick clients + an asset · then run · results appear here
            </div>
          ) : (
            <>
              <Section
                title={`Batch · ${doneCount}/${results.length} done${errCount ? ` · ${errCount} failed` : ""}${
                  cancelledCount ? ` · ${cancelledCount} cancelled` : ""
                }`}
              >
                <ul className="space-y-2">
                  {results.map((r) => (
                    <BatchRow key={r.brain_id} r={r} />
                  ))}
                </ul>
              </Section>
              {doneCount > 0 && !running ? (
                <div className="border border-live/30 bg-live/3 p-3 text-[12px] text-ink-muted">
                  All saved to /history under each client's brand. Open one to edit or rerun individually.
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function BatchRow({ r }: { r: RunResult }) {
  // Auto-expand while running so the user sees text streaming. Stay expanded
  // once done; user can collapse manually.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? (r.status === "running" || r.status === "done");
  const interactive = r.status === "done" || r.status === "running";
  return (
    <li className="border border-base-700 bg-base-900/30">
      <button
        onClick={() => setManualOpen(!open)}
        disabled={!interactive}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-base-800/40 transition disabled:cursor-default"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            r.status === "done" ? "bg-pos" : r.status === "running" ? "bg-live animate-pulse" : r.status === "error" ? "bg-neg" : "bg-base-600"
          }`}
        />
        <span className="font-medium text-ink flex-1">{r.brain_name}</span>
        {r.recovered ? (
          <span
            className="text-[9px] font-mono uppercase tracking-ui-mega text-live border border-live/40 px-1.5 py-0.5"
            title="The model's first reply didn't match the expected structure, so it was automatically re-asked to correct the JSON. This content came from the second attempt."
          >
            ↻ auto-corrected
          </span>
        ) : null}
        {r.status === "done" ? (
          <>
            {open ? <ChevronDown size={12} className="text-ink-faint" /> : <ChevronRight size={12} className="text-ink-faint" />}
            <Pill text="done" tone="pos" />
          </>
        ) : r.status === "running" ? (
          <>
            {open ? <ChevronDown size={12} className="text-ink-faint" /> : <ChevronRight size={12} className="text-ink-faint" />}
            <Pill text="streaming" tone="live" />
          </>
        ) : r.status === "error" ? (
          <Pill text="failed" tone="neg" />
        ) : r.status === "cancelled" ? (
          <Pill text="cancelled" />
        ) : (
          <Pill text="queued" />
        )}
      </button>
      {open && (r.status === "done" || r.status === "running") && r.text ? (
        <div className="border-t border-base-700 px-3 py-2 space-y-2">
          <div className="flex justify-end">
            <CopyButton text={r.text} />
          </div>
          <pre className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed text-ink max-h-[300px] overflow-auto border border-base-700 bg-base-900/50 p-3 rounded-xs">
            {r.text}
            {r.status === "running" ? <span className="text-live">▌</span> : null}
          </pre>
          {r.status === "done" && r.ad_id ? (
            <Link href={`/history?focus=${r.ad_id}`} className="text-[11px] text-live hover:underline">
              Open in History →
            </Link>
          ) : null}
        </div>
      ) : null}
      {r.status === "error" && r.error ? (
        <div className="border-t border-base-700 px-3 py-2 text-[11px] text-neg">{r.error}</div>
      ) : null}
      {r.status === "cancelled" ? (
        <div className="border-t border-base-700 px-3 py-2 text-[11px] text-ink-muted">
          Cancelled before this client finished. Nothing was saved for it.
        </div>
      ) : null}
    </li>
  );
}
