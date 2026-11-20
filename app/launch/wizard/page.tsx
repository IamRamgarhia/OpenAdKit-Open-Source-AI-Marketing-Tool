"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, AlertTriangle, Check, X, ArrowRight, StopCircle } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { getActiveBrainId, addUsage, getLanguage, getToneOverride, getActiveProviderId, getProvidersWithKeys, getProviderKey } from "@/lib/settings";
import { llmStream, estimateCostUsd, tryParseJson } from "@/lib/llm";
import { getProvider } from "@/lib/providers";
import { getQuotaSnapshot } from "@/lib/quota-tracker";
import { getBrain, saveAd, saveCampaign, type Campaign, type GeneratedAd } from "@/lib/storage";
import { buildBrandSystemPrompt, type BrandBrain } from "@/lib/brand-brain";
import { buildCampaignKitPrompt } from "@/lib/prompts/campaign-kit";
import { buildContentCalendarPrompt } from "@/lib/prompts/content-calendar";
import {
  buildStrategyBriefPrompt,
  buildEmailSequencePrompt,
  buildLaunchDayPostsPrompt,
  type LaunchWizardCommon,
} from "@/lib/prompts/launch-wizard";
import { rememberLastGenerated } from "@/lib/next-steps";
import { createIdleTimeout, anySignal } from "@/lib/idle-timeout";
import { withGenMeta } from "@/lib/ad-meta";
import { getCurrency } from "@/lib/currency";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";

type PhaseStatus = "pending" | "running" | "done" | "error";
interface Phase {
  key: string;
  label: string;
  status: PhaseStatus;
  result?: any;
  text?: string;
  error?: string;
  ad_id?: string;
}

const ALL_PLATFORMS = [
  { id: "meta", label: "Meta · Facebook + Instagram" },
  { id: "google", label: "Google · Search/PMax" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "X / Twitter" },
];


/** No streamed output for this long → treat the provider as stalled. A
 *  healthy stream that keeps delivering is never cut off (the old fixed 90s
 *  wall-clock timer killed long phases mid-stream). */
const PHASE_IDLE_TIMEOUT_MS = 90_000;

/** JSON from a phase is unvalidated — only trust it as an object. */
function asObject(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}
const asText = (v: unknown): string => (typeof v === "string" ? v : "");
const asStringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" && v ? [v] : [];

function buildWizardAd(
  brandId: string,
  args: {
    campaign_id: string;
    platform: GeneratedAd["platform"];
    campaign_type: string;
    title: string;
    input: Record<string, unknown>;
    output_json: any;
    output_text: string;
    modelId: string;
    providerId?: string;
    usage: any;
    cost: number;
    prompt?: string;
    maxTokens?: number;
  }
): GeneratedAd {
  return withGenMeta(
    {
      id: crypto.randomUUID(),
      brand_id: brandId,
      platform: args.platform,
      campaign_type: args.campaign_type,
      title: args.title,
      input: args.input,
      output_json: args.output_json,
      output_text: args.output_text,
      model_id: args.modelId,
      provider_id: args.providerId,
      usage_input_tokens: args.usage?.input_tokens ?? 0,
      usage_output_tokens: args.usage?.output_tokens ?? 0,
      cost_usd: args.cost,
      starred: false,
      status: "draft",
      notes: "",
      created_at: Date.now(),
      campaign_id: args.campaign_id,
      // Persisted so History can regenerate / compare each phase.
      prompt: args.prompt,
    },
    { max_tokens: args.maxTokens }
  );
}

function newLaunchCampaign(brandId: string, name: string, goal: string, notes: string): Campaign {
  return { id: crypto.randomUUID(), brand_id: brandId, name, goal, status: "planning", created_at: Date.now(), notes };
}

function rememberLaunchKit(campaignId: string, name: string, brandId: string) {
  rememberLastGenerated({
    id: campaignId,
    title: `Launch kit · ${name}`,
    platform: "google",
    campaign_type: "Launch Wizard",
    brand_id: brandId,
    saved_at: Date.now(),
  });
}

export default function Page() {
  return (
    <ApiKeyGate>
      <Inner />
    </ApiKeyGate>
  );
}

function Inner() {
  const [brain, setBrain] = useState<BrandBrain | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [goal, setGoal] = useState<LaunchWizardCommon["goal"]>("launch");
  const [duration, setDuration] = useState<LaunchWizardCommon["duration"]>("1_week");
  const [budget, setBudget] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["meta", "google"]);
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stopWizard() {
    if (abortRef.current) {
      abortRef.current.abort();
      setTopError("Wizard stopped. Completed phases are saved; the rest are dropped.");
    }
  }

  useEffect(() => {
    (async () => {
      const id = getActiveBrainId();
      const b = id ? (await getBrain(id)) ?? null : null;
      setBrain(b);
      // Auto-seed platforms from brain.platforms if available
      if (b?.platforms?.length) {
        const normalized = b.platforms
          .map((p) => p.toLowerCase())
          .map((p) => p.replace(/\s+/g, "").replace("facebook", "meta").replace("instagram", "meta").replace("x", "twitter"));
        const seed = Array.from(new Set(normalized.filter((p) => ALL_PLATFORMS.some((ap) => ap.id === p))));
        if (seed.length) setPlatforms(seed);
      }
      // Default campaign name + launch date. Use Date arithmetic so month-end
      // dates roll over correctly — `getDate() + 7` produces 29-38 on the last
      // week of any month and padStart can't fix it (was emitting 2026-05-35).
      // (Audit finding #9.)
      const launch = new Date();
      launch.setDate(launch.getDate() + 7);
      setLaunchDate(launch.toISOString().slice(0, 10));
      if (b?.business_name) setCampaignName(`${b.business_name} · launch`);
    })();
  }, []);

  function togglePlatform(id: string) {
    setPlatforms((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));
  }

  function pushPhase(p: Phase) {
    setPhases((cur) => [...cur, p]);
  }
  function updatePhase(key: string, patch: Partial<Phase>) {
    setPhases((cur) => cur.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }


  async function runOnePhase(args: {
    key: string;
    label: string;
    prompt: string;
    maxTokens: number;
    expectJson?: boolean;
    signal?: AbortSignal;
  }): Promise<any> {
    updatePhase(args.key, { status: "running", text: "", error: undefined });
    const system = buildBrandSystemPrompt(brain, { language: getLanguage(), tone_override: getToneOverride() });
    let accumulated = "";

    // Compose the wizard's master AbortSignal with a per-phase IDLE timeout
    // (reset on every delta). First of the two to abort wins.
    const idle = createIdleTimeout(PHASE_IDLE_TIMEOUT_MS, "No output for 90s");
    const signals = [args.signal, idle.signal].filter(Boolean) as AbortSignal[];
    const combined = anySignal(signals);

    try {
      const res = await llmStream(
        {
          system,
          messages: [{ role: "user", content: args.prompt }],
          maxTokens: args.maxTokens,
          temperature: 0.7,
          signal: combined,
        },
        {
          onDelta: (delta) => {
            idle.bump();
            accumulated += delta;
            updatePhase(args.key, { text: accumulated });
          },
        }
      );
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      window.dispatchEvent(new Event("ados:usage"));
      // res.text might be empty if the provider returned content only via deltas
      // (some Gemini responses do this). Fall back to our accumulated buffer so
      // the UI doesn't show "queued" on a successfully completed phase.
      const finalText = res.text || accumulated;
      const json = args.expectJson === false ? null : tryParseJson<any>(finalText);
      updatePhase(args.key, { status: "done", result: json, text: finalText });
      return { json, text: finalText, modelId: res.modelId, providerId: res.providerId, usage: res.usage, cost, prompt: args.prompt, maxTokens: args.maxTokens };
    } catch (e: any) {
      // The user pressed Stop — surface no failover, no error spam.
      if (args.signal?.aborted) {
        updatePhase(args.key, { status: "error", error: "Cancelled." });
        throw e;
      }

      const wasTimeout = idle.timedOut;

      // Auto-failover: if the active provider timed out and another provider
      // has a saved key, retry the phase with that provider once. Don't loop
      // through all 9 — that would mask real failures behind huge delays.
      if (wasTimeout) {
        const active = getActiveProviderId();
        // Skip providers we already know are throttled: quota-tracker records
        // blocked_until whenever a 429 comes back with a Retry-After. Picking
        // the first key blindly meant failing over straight into another
        // rate-limited provider and burning a second 90s timeout.
        const candidates = getProvidersWithKeys().filter((id) => id !== active);
        const fallbackId =
          candidates.find((id) => !(getQuotaSnapshot(id)?.blocked_for_seconds)) ?? candidates[0];
        const fallbackProvider = fallbackId ? getProvider(fallbackId) : null;
        if (fallbackProvider) {
          const fallbackKey = getProviderKey(fallbackId!);
          updatePhase(args.key, {
            status: "running",
            text: `[Active provider stalled — retrying with fallback: ${fallbackProvider.name}]\n\n`,
          });
          accumulated = `[Active provider stalled — retrying with fallback: ${fallbackProvider.name}]\n\n`;
          const fallbackIdle = createIdleTimeout(PHASE_IDLE_TIMEOUT_MS, "Fallback also produced no output for 90s");
          try {
            // Compose master wizard abort + fallback timeout so Stop button
            // still cancels the fallback retry. Without args.signal here, the
            // user clicking Stop while in fallback would leave it running.
            const fallbackCombined = anySignal([args.signal, fallbackIdle.signal].filter(Boolean) as AbortSignal[]);
            const res = await llmStream(
              {
                system,
                messages: [{ role: "user", content: args.prompt }],
                maxTokens: args.maxTokens,
                temperature: 0.7,
                signal: fallbackCombined,
                providerOverride: fallbackProvider,
                apiKeyOverride: fallbackKey,
              },
              {
                onDelta: (delta) => {
                  fallbackIdle.bump();
                  accumulated += delta;
                  updatePhase(args.key, { text: accumulated });
                },
              }
            );
            const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
            addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
            window.dispatchEvent(new Event("ados:usage"));
            const finalText = res.text || accumulated;
            const json = args.expectJson === false ? null : tryParseJson<any>(finalText);
            updatePhase(args.key, { status: "done", result: json, text: finalText });
            return { json, text: finalText, modelId: res.modelId, providerId: res.providerId, usage: res.usage, cost, prompt: args.prompt, maxTokens: args.maxTokens };
          } catch {
            // fall through to error state below
          } finally {
            fallbackIdle.clear();
          }
        }
      }

      const msg = wasTimeout
        ? "The primary provider stopped sending output for 90s. Failover provider also failed or none configured. Use ↻ retry, or switch provider in Settings."
        : e?.message ?? "Phase failed";
      updatePhase(args.key, { status: "error", error: msg });
      throw e;
    } finally {
      idle.clear();
    }
  }



  /** Retry a single failed phase without re-running the whole wizard. */
  async function retryPhase(phaseKey: string) {
    if (!brain || !campaignId) return;
    const common: LaunchWizardCommon = {
      campaign_name: campaignName.trim(),
      goal,
      platforms,
      budget_total: budget.trim() ? `${getCurrency().code} ${budget.trim()}` : "",
      launch_date: launchDate,
      duration,
      notes: notes.trim() || undefined,
    };
    // Pull the strategy brief from completed phases (or re-run nothing if it's missing).
    const strat = asObject(phases.find((p) => p.key === "strategy")?.result);
    const ctl = new AbortController();
    setRunning(true);
    try {
      let built: { prompt: string; max: number } | null = null;
      switch (phaseKey) {
        case "strategy":
          built = { prompt: buildStrategyBriefPrompt(common), max: 1200 };
          break;
        case "kit":
          built = {
            prompt: buildCampaignKitPrompt({
              campaign_name: common.campaign_name,
              product: brain.business_name,
              primary_offer: brain.usp || asText(strat.big_idea),
              audience: brain.audience_who || "",
              goal: common.goal,
              budget_monthly: common.budget_total,
            } as any),
            max: 5500,
          };
          break;
        case "calendar":
          built = {
            prompt: buildContentCalendarPrompt({
              duration: common.duration,
              cadence_per_week: 4,
              platforms: platforms.join(", "),
              pillars: (brain.content_pillars ?? []).join(" · ") || "Founder stories · Product education · Customer wins · Behind the scenes",
              primary_goal: common.goal,
              voice_notes: brain.tone || "(use brand brain)",
              posting_window: "anytime",
              region_or_timezone: brain.audience_demographics || "(unspecified)",
            } as any),
            max: 6500,
          };
          break;
        case "email":
          built = {
            prompt: buildEmailSequencePrompt({
              ...common,
              big_idea: asText(strat.big_idea),
              positioning_one_liner: asText(strat.positioning_one_liner),
              primary_cta: asText(strat.primary_cta),
            }),
            max: 2500,
          };
          break;
        case "social":
          built = {
            prompt: buildLaunchDayPostsPrompt({
              ...common,
              big_idea: asText(strat.big_idea),
              positioning_one_liner: asText(strat.positioning_one_liner),
              proof_points: asStringList(strat.proof_points),
            }),
            max: 3500,
          };
          break;
      }
      if (!built) return;
      const result = await runOnePhase({
        key: phaseKey,
        label: phaseKey,
        prompt: built.prompt,
        maxTokens: built.max,
        signal: ctl.signal,
      });
      // Persist the retried phase against the existing campaign.
      const labels: Record<string, [GeneratedAd["platform"], string]> = {
        strategy: ["google", "Launch Strategy"],
        kit: ["google", "Campaign Kit"],
        calendar: ["meta", "Content Calendar"],
        email: ["google", "Email Sequence"],
        social: ["meta", "Launch-Day Social"],
      };
      const [plat, ctype] = labels[phaseKey];
      await persistAsAd({
        campaign_id: campaignId,
        platform: plat,
        campaign_type: ctype,
        title: `${ctype} · ${campaignName.trim()}`,
        input: common as any,
        output_json: result.json,
        output_text: result.text,
        modelId: result.modelId,
        providerId: result.providerId,
        usage: result.usage,
        cost: result.cost,
        prompt: result.prompt,
        maxTokens: result.maxTokens,
      });
    } catch {
      /* updatePhase already set status="error" */
    } finally {
      setRunning(false);
    }
  }

  async function persistAsAd(args: Parameters<typeof buildWizardAd>[1]): Promise<string> {
    const ad = buildWizardAd(brain?.id ?? "", args);
    await saveAd(ad);
    return ad.id;
  }

  async function runWizard() {
    setTopError(null);
    if (!brain) {
      setTopError("Pick an active client first (or create one in Clients · Brand Brain).");
      return;
    }
    if (!campaignName.trim()) return setTopError("Give the campaign a name.");
    if (!platforms.length) return setTopError("Pick at least one platform.");
    if (!budget.trim()) return setTopError("Set a budget.");
    if (!launchDate.trim()) return setTopError("Pick a launch date.");

    // Reset
    setRunning(true);
    setCampaignId(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const phaseList: Phase[] = [
      { key: "strategy", label: "Strategy brief", status: "pending" },
      { key: "kit", label: "Cross-platform ad copy", status: "pending" },
      { key: "calendar", label: "Content calendar", status: "pending" },
      { key: "email", label: "Email nurture sequence", status: "pending" },
      { key: "social", label: "Launch-day social posts", status: "pending" },
    ];
    setPhases(phaseList);

    // Create the Campaign up-front so every asset gets linked.
    const camp = newLaunchCampaign(
      brain.id,
      campaignName.trim(),
      goal,
      `Launch date ${launchDate} · duration ${duration} · budget ${getCurrency().symbol}${budget} · platforms ${platforms.join(", ")}`
    );
    await saveCampaign(camp);
    setCampaignId(camp.id);

    const common: LaunchWizardCommon = {
      campaign_name: campaignName.trim(),
      goal,
      platforms,
      budget_total: budget.trim() ? `${getCurrency().code} ${budget.trim()}` : "",
      launch_date: launchDate,
      duration,
      notes: notes.trim() || undefined,
    };

    try {
      // ── Phase 1 · Strategy brief (sequential — its output anchors the rest)
      const strategy = await runOnePhase({
        key: "strategy",
        label: "Strategy brief",
        prompt: buildStrategyBriefPrompt(common),
        maxTokens: 1200,
        signal: controller.signal,
      });
      const strat = asObject(strategy.json);
      await persistAsAd({
        campaign_id: camp.id,
        platform: "google" as any,
        campaign_type: "Launch Strategy",
        title: `Strategy · ${common.campaign_name}`,
        input: common as any,
        output_json: strategy.json,
        output_text: strategy.text,
        modelId: strategy.modelId,
        providerId: strategy.providerId,
        usage: strategy.usage,
        cost: strategy.cost,
        prompt: strategy.prompt,
        maxTokens: strategy.maxTokens,
      });

      // ── Phases 2-5 · run in parallel; they don't depend on each other now that
      //              strategy has populated the system context.
      const big_idea = asText(strat.big_idea);
      const positioning_one_liner = asText(strat.positioning_one_liner);
      const primary_cta = asText(strat.primary_cta);
      const proof_points = asStringList(strat.proof_points);

      const tasks = await Promise.allSettled([
        runOnePhase({
          key: "kit",
          label: "Cross-platform ad copy",
          prompt: buildCampaignKitPrompt({
            campaign_name: common.campaign_name,
            product: brain.business_name,
            primary_offer: brain.usp || big_idea,
            audience: brain.audience_who || "",
            goal: common.goal,
            budget_monthly: common.budget_total,
          } as any),
          maxTokens: 5500,
          signal: controller.signal,
        }),
        runOnePhase({
          key: "calendar",
          label: "Content calendar",
          prompt: buildContentCalendarPrompt({
            duration: common.duration,
            cadence_per_week: 4,
            platforms: platforms.join(", "),
            pillars: (brain.content_pillars ?? []).join(" · ") || "Founder stories · Product education · Customer wins · Behind the scenes",
            primary_goal: common.goal,
            voice_notes: brain.tone || "(use brand brain)",
            posting_window: "anytime",
            region_or_timezone: brain.audience_demographics || "(unspecified)",
          } as any),
          maxTokens: 6500,
          signal: controller.signal,
        }),
        runOnePhase({
          key: "email",
          label: "Email nurture sequence",
          prompt: buildEmailSequencePrompt({
            ...common,
            big_idea,
            positioning_one_liner,
            primary_cta,
          }),
          maxTokens: 2500,
          signal: controller.signal,
        }),
        runOnePhase({
          key: "social",
          label: "Launch-day social posts",
          prompt: buildLaunchDayPostsPrompt({
            ...common,
            big_idea,
            positioning_one_liner,
            proof_points,
          }),
          maxTokens: 3500,
          signal: controller.signal,
        }),
      ]);

      // Persist whichever phases succeeded.
      const labels: Record<string, [GeneratedAd["platform"], string]> = {
        kit: ["google", "Campaign Kit"],
        calendar: ["meta", "Content Calendar"],
        email: ["google", "Email Sequence"],
        social: ["meta", "Launch-Day Social"],
      };
      const keys: (keyof typeof labels)[] = ["kit", "calendar", "email", "social"];
      await Promise.all(
        tasks.map(async (t, i) => {
          const key = keys[i];
          if (t.status !== "fulfilled") return;
          const [plat, ctype] = labels[key];
          await persistAsAd({
            campaign_id: camp.id,
            platform: plat,
            campaign_type: ctype,
            title: `${ctype} · ${common.campaign_name}`,
            input: common as any,
            output_json: t.value.json,
            output_text: t.value.text,
            modelId: t.value.modelId,
            providerId: t.value.providerId,
            usage: t.value.usage,
            cost: t.value.cost,
            prompt: t.value.prompt,
            maxTokens: t.value.maxTokens,
          });
        })
      );

      // Update the dashboard "last generated" pill to the wizard's last completed asset.
      rememberLaunchKit(camp.id, common.campaign_name, brain.id);
      window.dispatchEvent(new Event("ados:usage"));
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // Already messaged by stopWizard().
      } else {
        setTopError(e?.message ?? "The wizard hit an error. Each completed phase is still saved.");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div>
      <PageHeader
        scope="launch/wizard"
        title="10-Minute Launch Wizard"
        subtitle="One click → strategy brief + cross-platform ad copy + content calendar + email sequence + launch-day social posts. All saved as a single Campaign linked to the active client."
        showLive={running}
      />

      {!brain ? (
        <div className="border border-live/40 bg-live/5 text-live text-sm px-4 py-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            No active client. Go to <Link href="/brand" className="underline">Clients · Brand Brain</Link> to create or select one. The
            wizard uses the brand brain to make every asset on-voice and accurate.
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 border border-base-600 bg-base-900/40 p-5 space-y-3">
          <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">1 · Inputs</h2>

          <div>
            <label htmlFor="wiz-campaign-name" className="label">Campaign name</label>
            <input id="wiz-campaign-name" className="input-base" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Q3 trial blitz" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="wiz-goal" className="label">Goal</label>
              <select id="wiz-goal" className="input-base" value={goal} onChange={(e) => setGoal(e.target.value as any)}>
                <option value="awareness">Awareness</option>
                <option value="leads">Leads</option>
                <option value="sales">Sales</option>
                <option value="launch">Launch</option>
                <option value="engagement">Engagement</option>
              </select>
            </div>
            <div>
              <label htmlFor="wiz-duration" className="label">Duration</label>
              <select id="wiz-duration" className="input-base" value={duration} onChange={(e) => setDuration(e.target.value as any)}>
                <option value="1_week">1 week</option>
                <option value="2_weeks">2 weeks</option>
                <option value="1_month">1 month</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="wiz-budget" className="label">Total budget ({getCurrency().code})</label>
              <input id="wiz-budget" className="input-base" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={`${getCurrency().symbol}5,000`} />
            </div>
            <div>
              <label htmlFor="wiz-launch-date" className="label">Launch date</label>
              <input id="wiz-launch-date" type="date" className="input-base tabular" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label" id="wiz-platforms-label">Platforms</label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="wiz-platforms-label">
              {ALL_PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    aria-pressed={on}
                    // py-2 mobile / py-1 desktop hits 44px touch target.
                    className={`text-[11px] font-mono uppercase tracking-ui-wide px-2.5 py-2 md:py-1 border transition ${
                      on ? "bg-live text-base-950 border-live" : "border-base-600 text-ink-muted hover:border-base-500"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="wiz-notes" className="label">Notes (optional)</label>
            <textarea
              id="wiz-notes"
              rows={3}
              className="input-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything specific the AI should know — e.g. 'lean into compliance angle', 'avoid mentioning competitors'"
            />
          </div>

          {topError ? (
            <div className={`border ${/rate limit|quota|too many requests|429|retry in/i.test(topError) ? "border-live/40 bg-live/5" : "border-neg/40 bg-neg/5"} px-3 py-3 space-y-3`}>
              <div className={`text-[11px] font-mono uppercase tracking-ui-wide ${/rate limit|quota|too many requests|429|retry in/i.test(topError) ? "text-live" : "text-neg"}`}>{topError}</div>
              {/rate limit|quota|too many requests|429|retry in/i.test(topError) ? (
                <ProviderSwitcher reason="rate-limit" />
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={runWizard}
              disabled={running || !brain}
              className="btn-primary flex-1"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {running ? "Building your launch kit…" : "Build it · 10-min launch kit"}
            </button>
            {running ? (
              <button onClick={stopWizard} className="btn-ghost" title="Stop the wizard — finished phases stay saved" aria-label="Stop wizard">
                <StopCircle size={12} />
              </button>
            ) : null}
          </div>

          {campaignId ? (
            <div className="text-[10px] text-pos flex items-center gap-1.5 font-mono uppercase tracking-ui-mega">
              <Check size={10} /> Campaign saved · linked to history
            </div>
          ) : null}
        </section>

        <section className="lg:col-span-3 space-y-3">
          {phases.length === 0 ? (
            <div className="border border-dashed border-base-600 bg-base-900/20 text-[11px] font-mono uppercase tracking-ui-mega text-ink-faint min-h-[260px] grid place-items-center">
              Inputs on the left → click build · 5 assets generated in parallel
            </div>
          ) : (
            <div className="space-y-3">
              {phases.map((p) => (
                <PhaseCard key={p.key} phase={p} onRetry={running ? undefined : () => retryPhase(p.key)} />
              ))}
              {!running && phases.every((p) => p.status === "done" || p.status === "error") ? (
                <FinalSummary phases={phases} campaignId={campaignId} />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PhaseCard({ phase, onRetry }: { phase: Phase; onRetry?: () => void }) {
  const Icon =
    phase.status === "done" ? Check : phase.status === "running" ? Loader2 : phase.status === "error" ? X : null;
  return (
    <details
      open={phase.status === "running" || phase.status === "done" || phase.status === "error"}
      className="border border-base-700 bg-base-900/30"
    >
      <summary className="cursor-pointer list-none flex items-center gap-3 px-4 py-2.5 hover:bg-base-800/40 transition">
        <span
          className={`h-2 w-2 rounded-full ${
            phase.status === "done"
              ? "bg-pos"
              : phase.status === "running"
              ? "bg-live animate-pulse"
              : phase.status === "error"
              ? "bg-neg"
              : "bg-base-600"
          }`}
        />
        <span className="font-mono text-[11px] uppercase tracking-ui-wide text-ink-muted flex-1">{phase.label}</span>
        {Icon ? <Icon size={12} className={phase.status === "running" ? "animate-spin text-live" : phase.status === "done" ? "text-pos" : "text-neg"} /> : null}
      </summary>
      <div className="px-4 pb-4 pt-2">
        {phase.status === "error" ? (
          <div className="space-y-2">
            <p className="text-xs text-neg">{phase.error}</p>
            {onRetry ? (
              <button
                onClick={onRetry}
                className="text-[11px] font-mono uppercase tracking-ui-wide text-live hover:text-live/80 transition flex items-center gap-1.5"
              >
                ↻ retry this phase
              </button>
            ) : null}
          </div>
        ) : phase.text ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <CopyButton text={phase.text} />
            </div>
            <pre className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed text-ink max-h-[280px] overflow-auto border border-base-700 bg-base-900/50 p-3 rounded-xs">
              {phase.text}
              {phase.status === "running" ? <span className="text-live">▌</span> : null}
            </pre>
          </div>
        ) : phase.status === "running" ? (
          <p className="text-xs text-ink-muted">connecting to the model…</p>
        ) : (
          <p className="text-xs text-ink-subtle">queued</p>
        )}
      </div>
    </details>
  );
}

function FinalSummary({ phases, campaignId }: { phases: Phase[]; campaignId: string | null }) {
  const done = phases.filter((p) => p.status === "done").length;
  const errored = phases.filter((p) => p.status === "error");
  return (
    <Section title={`Done · ${done}/${phases.length} phases complete`}>
      {errored.length ? (
        <div className="border border-neg/40 bg-neg/5 px-3 py-2 mb-3">
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-neg mb-1">{errored.length} failed</div>
          {errored.map((p) => (
            <div key={p.key} className="text-[11px] text-ink-muted">
              {p.label} — {p.error}
            </div>
          ))}
          <p className="text-[11px] text-ink-muted mt-1">Re-run the wizard to retry. Completed phases are already saved.</p>
        </div>
      ) : null}
      <ul className="space-y-1.5">
        <li>
          <Link
            href={campaignId ? `/campaigns?focus=${campaignId}` : "/campaigns"}
            className="flex items-center justify-between px-3 py-2 border border-base-700 hover:border-live/40 hover:bg-base-800/40 transition"
          >
            <span className="text-sm text-ink">View this campaign</span>
            <ArrowRight size={12} className="text-live" />
          </Link>
        </li>
        <li>
          <Link
            href="/history"
            className="flex items-center justify-between px-3 py-2 border border-base-700 hover:border-live/40 hover:bg-base-800/40 transition"
          >
            <span className="text-sm text-ink">Open History for individual asset editing</span>
            <ArrowRight size={12} className="text-live" />
          </Link>
        </li>
        <li>
          <Link
            href="/generate/hashtags"
            className="flex items-center justify-between px-3 py-2 border border-base-700 hover:border-live/40 hover:bg-base-800/40 transition"
          >
            <span className="text-sm text-ink">Generate hashtag stacks for the platforms above</span>
            <ArrowRight size={12} className="text-live" />
          </Link>
        </li>
        <li>
          <Link
            href="/generate/reel-ideas"
            className="flex items-center justify-between px-3 py-2 border border-base-700 hover:border-live/40 hover:bg-base-800/40 transition"
          >
            <span className="text-sm text-ink">Build 12 Reel ideas to support the launch</span>
            <ArrowRight size={12} className="text-live" />
          </Link>
        </li>
      </ul>
    </Section>
  );
}
