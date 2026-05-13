"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, AlertTriangle, Check, X, ArrowRight, StopCircle } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { CopyButton } from "@/components/CopyButton";
import { getActiveBrainId, addUsage, getLanguage, getToneOverride } from "@/lib/settings";
import { llmStream, estimateCostUsd, tryParseJson } from "@/lib/llm";
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
      // Default campaign name + launch date
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate() + 7).padStart(2, "0");
      setLaunchDate(`${yyyy}-${mm}-${dd}`);
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
    updatePhase(args.key, { status: "running", text: "" });
    const system = buildBrandSystemPrompt(brain, { language: getLanguage(), tone_override: getToneOverride() });
    let accumulated = "";
    try {
      const res = await llmStream(
        {
          system,
          messages: [{ role: "user", content: args.prompt }],
          maxTokens: args.maxTokens,
          temperature: 0.7,
          signal: args.signal,
        },
        {
          onDelta: (delta) => {
            accumulated += delta;
            // Throttle setPhases updates to ~every 200ms equivalent — render
            // the latest accumulated text via functional update so it doesn't
            // stall the UI on every token.
            updatePhase(args.key, { text: accumulated });
          },
        }
      );
      const cost = estimateCostUsd(res.providerId, res.modelId, res.usage);
      addUsage(cost, res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
      const json = args.expectJson === false ? null : tryParseJson<any>(res.text);
      updatePhase(args.key, { status: "done", result: json, text: res.text });
      return { json, text: res.text, modelId: res.modelId, usage: res.usage, cost };
    } catch (e: any) {
      updatePhase(args.key, { status: "error", error: e?.message ?? "Phase failed" });
      throw e;
    }
  }

  async function persistAsAd(args: {
    campaign_id: string;
    platform: GeneratedAd["platform"];
    campaign_type: string;
    title: string;
    input: Record<string, unknown>;
    output_json: any;
    output_text: string;
    modelId: string;
    usage: any;
    cost: number;
  }): Promise<string> {
    const ad: GeneratedAd = {
      id: crypto.randomUUID(),
      brand_id: brain?.id ?? "",
      platform: args.platform,
      campaign_type: args.campaign_type,
      title: args.title,
      input: args.input,
      output_json: args.output_json,
      output_text: args.output_text,
      model_id: args.modelId,
      usage_input_tokens: args.usage?.input_tokens ?? 0,
      usage_output_tokens: args.usage?.output_tokens ?? 0,
      cost_usd: args.cost,
      starred: false,
      status: "draft",
      notes: "",
      created_at: Date.now(),
      campaign_id: args.campaign_id,
    };
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
    const camp: Campaign = {
      id: crypto.randomUUID(),
      brand_id: brain.id,
      name: campaignName.trim(),
      goal,
      status: "planning",
      created_at: Date.now(),
      notes: `Launch date ${launchDate} · duration ${duration} · budget ${budget} · platforms ${platforms.join(", ")}`,
    };
    await saveCampaign(camp);
    setCampaignId(camp.id);

    const common: LaunchWizardCommon = {
      campaign_name: campaignName.trim(),
      goal,
      platforms,
      budget_total: budget.trim(),
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
      const strat = strategy.json ?? {};
      await persistAsAd({
        campaign_id: camp.id,
        platform: "google" as any,
        campaign_type: "Launch Strategy",
        title: `Strategy · ${common.campaign_name}`,
        input: common as any,
        output_json: strategy.json,
        output_text: strategy.text,
        modelId: strategy.modelId,
        usage: strategy.usage,
        cost: strategy.cost,
      });

      // ── Phases 2-5 · run in parallel; they don't depend on each other now that
      //              strategy has populated the system context.
      const big_idea = strat.big_idea ?? "";
      const positioning_one_liner = strat.positioning_one_liner ?? "";
      const primary_cta = strat.primary_cta ?? "";
      const proof_points = strat.proof_points ?? [];

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
            usage: t.value.usage,
            cost: t.value.cost,
          });
        })
      );

      // Update the dashboard "last generated" pill to the wizard's last completed asset.
      rememberLastGenerated({
        id: camp.id,
        title: `Launch kit · ${common.campaign_name}`,
        platform: "google",
        campaign_type: "Launch Wizard",
        brand_id: brain.id,
        saved_at: Date.now(),
      });
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
            <label className="label">Campaign name</label>
            <input className="input-base" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Q3 trial blitz" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Goal</label>
              <select className="input-base" value={goal} onChange={(e) => setGoal(e.target.value as any)}>
                <option value="awareness">Awareness</option>
                <option value="leads">Leads</option>
                <option value="sales">Sales</option>
                <option value="launch">Launch</option>
                <option value="engagement">Engagement</option>
              </select>
            </div>
            <div>
              <label className="label">Duration</label>
              <select className="input-base" value={duration} onChange={(e) => setDuration(e.target.value as any)}>
                <option value="1_week">1 week</option>
                <option value="2_weeks">2 weeks</option>
                <option value="1_month">1 month</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Total budget</label>
              <input className="input-base" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="$5,000" />
            </div>
            <div>
              <label className="label">Launch date</label>
              <input type="date" className="input-base tabular" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`text-[11px] font-mono uppercase tracking-ui-wide px-2.5 py-1 border transition ${
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
            <label className="label">Notes (optional)</label>
            <textarea
              rows={3}
              className="input-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything specific the AI should know — e.g. 'lean into compliance angle', 'avoid mentioning competitors'"
            />
          </div>

          {topError ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">{topError}</div>
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
              <button onClick={stopWizard} className="btn-ghost" title="Stop the wizard — finished phases stay saved">
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
                <PhaseCard key={p.key} phase={p} />
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

function PhaseCard({ phase }: { phase: Phase }) {
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
          <p className="text-xs text-neg">{phase.error}</p>
        ) : phase.text ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <CopyButton text={phase.text} />
            </div>
            <pre className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed text-ink max-h-[280px] overflow-auto border border-base-700 bg-base-900/50 p-3 rounded-sm">
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
