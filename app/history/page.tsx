"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2, Download, Search, Star, TrendingUp } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { CopyButton } from "@/components/CopyButton";
import { PerformanceDialog } from "@/components/PerformanceDialog";
import { listAds, listBrains, softDeleteAd, restoreAd, updateAd, type GeneratedAd, type Platform } from "@/lib/storage";
import { showUndoToast } from "@/components/UndoToast";
import { SkeletonRow, LoadingAnnouncement } from "@/components/Skeleton";
import { getActiveBrainId } from "@/lib/settings";
import type { BrandBrain } from "@/lib/brand-brain";

const STATUSES: GeneratedAd["status"][] = ["draft", "testing", "live", "paused", "winner", "loser"];

const statusTone: Record<GeneratedAd["status"], string> = {
  draft: "border-base-600 text-ink-muted",
  testing: "border-info/40 text-info",
  live: "border-live/40 text-live",
  paused: "border-base-600 text-ink-subtle",
  winner: "border-pos/40 text-pos",
  loser: "border-neg/40 text-neg",
};

export default function HistoryPage() {
  return (
    <ApiKeyGate>
      <Suspense fallback={null}>
        <HistoryInner />
      </Suspense>
    </ApiKeyGate>
  );
}

function HistoryInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [status, setStatus] = useState<GeneratedAd["status"] | "all">("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scope, setScope] = useState<"active_brand" | "all_brands">("active_brand");
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [perfDialogAd, setPerfDialogAd] = useState<GeneratedAd | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [a, b] = await Promise.all([listAds(), listBrains()]);
    setAds(a);
    setBrains(b);
    setActiveBrandId(getActiveBrainId());
    setLoading(false);
  }
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("ados:brains-changed", h);
    return () => window.removeEventListener("ados:brains-changed", h);
  }, []);

  // Deep-link support: /history?focus=<adId> expands the row and scrolls it
  // into view. Wait until ads are loaded so the target element exists, then
  // widen the scope to "all brands" if the focused ad isn't in the active one
  // (otherwise the row may be filtered out).
  useEffect(() => {
    if (!focusId || ads.length === 0) return;
    const target = ads.find((a) => a.id === focusId);
    if (!target) return;
    if (activeBrandId && target.brand_id !== activeBrandId) setScope("all_brands");
    setExpanded(focusId);
    // Wait one frame so the row is rendered before scrolling.
    requestAnimationFrame(() => {
      const el = document.getElementById(focusId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-live");
      setTimeout(() => el?.classList.remove("ring-2", "ring-live"), 2400);
    });
  }, [focusId, ads, activeBrandId]);

  const filtered = useMemo(() => {
    return ads.filter((a) => {
      if (scope === "active_brand" && activeBrandId && a.brand_id !== activeBrandId) return false;
      if (platform !== "all" && a.platform !== platform) return false;
      if (status !== "all" && a.status !== status) return false;
      if (starredOnly && !a.starred) return false;
      if (!q) return true;
      const hay = `${a.title} ${a.campaign_type} ${a.platform} ${a.notes ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [ads, q, platform, status, starredOnly, scope, activeBrandId]);

  const activeBrand = brains.find((b) => b.id === activeBrandId);

  // Per-brand cost rollup over the visible (filtered) set + last-30-days slice.
  // Agencies running N clients can see at a glance which client is consuming
  // the most token budget this month.
  const perBrandCost = useMemo(() => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = new Map<string, { brain_id: string; name: string; total: number; last30: number; count: number; tokens: number }>();
    for (const a of ads) {
      const brain = brains.find((b) => b.id === a.brand_id);
      const name = brain?.name || brain?.business_name || "(no client)";
      const cur = rows.get(a.brand_id) ?? { brain_id: a.brand_id, name, total: 0, last30: 0, count: 0, tokens: 0 };
      cur.total += a.cost_usd ?? 0;
      cur.count += 1;
      cur.tokens += (a.usage_input_tokens ?? 0) + (a.usage_output_tokens ?? 0);
      if (a.created_at >= monthAgo) cur.last30 += a.cost_usd ?? 0;
      rows.set(a.brand_id, cur);
    }
    return Array.from(rows.values()).sort((a, b) => b.last30 - a.last30);
  }, [ads, brains]);

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download(`ados-history-${Date.now()}.json`, JSON.stringify(filtered, null, 2), "application/json");
  }

  function exportCsv() {
    const headers = ["id", "platform", "campaign_type", "status", "starred", "title", "model", "input_tokens", "output_tokens", "cost_usd", "created_at", "notes"];
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const rows = filtered.map((a) =>
      [
        a.id, a.platform, a.campaign_type, a.status, a.starred, a.title,
        a.model_id, a.usage_input_tokens, a.usage_output_tokens, a.cost_usd.toFixed(6),
        new Date(a.created_at).toISOString(), a.notes,
      ].map(esc).join(",")
    );
    download(`ados-history-${Date.now()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
  }

  function exportMarkdown() {
    const md = filtered.map((a) =>
      `## ${a.title}\n\n- **Platform**: ${a.platform} · ${a.campaign_type}\n- **Status**: ${a.status}${a.starred ? " · ⭐" : ""}\n- **When**: ${new Date(a.created_at).toLocaleString()}\n- **Model**: \`${a.model_id}\` · in ${a.usage_input_tokens} · out ${a.usage_output_tokens} · $${a.cost_usd.toFixed(4)}\n${a.notes ? `- **Notes**: ${a.notes}\n` : ""}\n\`\`\`\n${a.output_text}\n\`\`\`\n`
    ).join("\n---\n\n");
    download(`ados-history-${Date.now()}.md`, `# AdForge History Export\n\nGenerated ${new Date().toISOString()} · ${filtered.length} entries\n\n${md}`, "text/markdown");
  }

  async function setStatusOn(id: string, s: GeneratedAd["status"]) {
    await updateAd(id, { status: s });
    refresh();
  }
  async function toggleStar(ad: GeneratedAd) {
    await updateAd(ad.id, { starred: !ad.starred });
    refresh();
  }
  async function setNote(id: string, notes: string) {
    await updateAd(id, { notes });
    refresh();
  }

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { all: ads.length };
    for (const a of ads) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [ads]);

  return (
    <div>
      <PageHeader
        scope="history"
        title="History"
        subtitle={`${ads.length} generation${ads.length === 1 ? "" : "s"} stored in this browser. Tag with status, star winners, export anywhere.`}
      />

      {perBrandCost.length > 1 ? (
        <details className="mb-3 border border-base-600 bg-base-900/40 group">
          <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2 hover:bg-base-800/40 transition">
            <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">Spend by client · last 30d</span>
            <span className="flex-1" />
            <span className="text-[11px] tabular text-ink">
              total ${perBrandCost.reduce((s, r) => s + r.last30, 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-ink-faint font-mono uppercase tracking-ui-wide group-open:hidden">show</span>
            <span className="text-[10px] text-ink-faint font-mono uppercase tracking-ui-wide hidden group-open:inline">hide</span>
          </summary>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint border-t border-base-700">
                <th className="text-left px-3 py-1.5 font-normal">client</th>
                <th className="text-right px-3 py-1.5 font-normal">last 30d</th>
                <th className="text-right px-3 py-1.5 font-normal">all time</th>
                <th className="text-right px-3 py-1.5 font-normal">runs</th>
                <th className="text-right px-3 py-1.5 font-normal">tokens</th>
              </tr>
            </thead>
            <tbody>
              {perBrandCost.map((r) => (
                <tr key={r.brain_id} className="border-t border-base-700/50 hover:bg-base-800/30">
                  <td className="px-3 py-1.5 text-ink">{r.name}</td>
                  <td className="px-3 py-1.5 text-right tabular text-pos">${r.last30.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-ink-muted">${r.total.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right tabular text-ink-muted">{r.count}</td>
                  <td className="px-3 py-1.5 text-right tabular text-ink-subtle">{r.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      <div className="flex items-center gap-2 mb-3 border border-base-600 bg-base-900/40 p-2">
        <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint ml-1">scope:</span>
        <button
          onClick={() => setScope("active_brand")}
          disabled={!activeBrandId}
          className={`border px-2 py-1 text-[11px] font-mono uppercase tracking-ui-wide ${
            scope === "active_brand" ? "border-live text-live bg-live/5" : "border-base-600 text-ink-muted"
          } disabled:opacity-50`}
        >
          active brand{activeBrand ? ` · ${activeBrand.name || activeBrand.business_name}` : ""}
        </button>
        <button
          onClick={() => setScope("all_brands")}
          className={`border px-2 py-1 text-[11px] font-mono uppercase tracking-ui-wide ${
            scope === "all_brands" ? "border-live text-live bg-live/5" : "border-base-600 text-ink-muted"
          }`}
        >
          all brands ({brains.length})
        </button>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">showing {filtered.length} / {ads.length}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-2.5 top-2.5 text-ink-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search title, campaign, notes…"
            className="input-base pl-8"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform | "all")}
          className="input-base w-auto"
        >
          <option value="all">all platforms</option>
          <option value="google">google</option>
          <option value="meta">meta</option>
          <option value="tiktok">tiktok</option>
          <option value="youtube">youtube</option>
          <option value="linkedin">linkedin</option>
          <option value="twitter">twitter/x</option>
          <option value="display">display</option>
        </select>
        <button
          onClick={() => setStarredOnly((s) => !s)}
          className={`btn-ghost ${starredOnly ? "border-live text-live" : ""}`}
        >
          <Star size={11} className={starredOnly ? "fill-live" : ""} /> starred
        </button>
        <div className="relative group">
          <button className="btn-ghost"><Download size={11} /> export</button>
          <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:block bg-base-950 border border-base-600 min-w-[120px]">
            <button onClick={exportJson} className="block w-full text-left px-3 py-2 text-[11px] font-mono uppercase tracking-ui-mega text-ink hover:bg-base-800/60">json</button>
            <button onClick={exportCsv} className="block w-full text-left px-3 py-2 text-[11px] font-mono uppercase tracking-ui-mega text-ink hover:bg-base-800/60">csv</button>
            <button onClick={exportMarkdown} className="block w-full text-left px-3 py-2 text-[11px] font-mono uppercase tracking-ui-mega text-ink hover:bg-base-800/60">markdown</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        <StatusChip active={status === "all"} count={counts.all ?? 0} onClick={() => setStatus("all")} label="all" />
        {STATUSES.map((s) => (
          <StatusChip key={s} active={status === s} count={counts[s] ?? 0} onClick={() => setStatus(s)} label={s} tone={statusTone[s]} />
        ))}
      </div>

      {loading ? (
        <div className="space-y-1.5" aria-busy="true">
          <LoadingAnnouncement what="history" />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : filtered.length === 0 ? (
        ads.length === 0 ? (
          <div className="border border-live/30 bg-live/[0.03] p-6 text-center">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2">empty history</div>
            <h3 className="font-display italic text-xl text-ink leading-tight mb-2">Nothing generated yet.</h3>
            <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed mb-4">
              Every ad you generate gets saved here automatically — local-only, never sent off-device. Start with the wizard or pick a tool from the sidebar.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <a href="/launch/wizard" className="btn-primary">⚡ 10-minute Launch Wizard</a>
              <a href="/" className="btn-ghost">Browse tools</a>
            </div>
          </div>
        ) : (
          <div className="border border-base-600 bg-base-900/40 px-4 py-3 text-sm text-ink-muted">
            no matching generations — try clearing filters above.
          </div>
        )
      ) : (
        <div className="space-y-1.5">
          {filtered.map((a) => (
            <div key={a.id} id={a.id} className="border border-base-600 bg-base-900/40">
              <div className="flex items-start justify-between gap-3 p-3">
                <button
                  className="text-left flex-1 min-w-0"
                  onClick={() => setExpanded((cur) => (cur === a.id ? null : a.id))}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-ui-mega ${statusTone[a.status]}`}>
                      {a.status}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live">{a.platform}</span>
                    <span className="text-[10px] text-ink-faint">·</span>
                    <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle">
                      {a.campaign_type}
                    </span>
                    <span className="text-[10px] text-ink-faint">·</span>
                    <span className="text-[10px] font-mono text-ink-subtle">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="font-medium text-ink truncate flex items-center gap-1.5">
                    {a.starred ? <Star size={11} className="text-live fill-live shrink-0" /> : null}
                    {a.title}
                  </div>
                  <div className="text-[10px] font-mono text-ink-faint mt-1 tabular">
                    {a.model_id} · in {a.usage_input_tokens.toLocaleString()} · out {a.usage_output_tokens.toLocaleString()} · ${a.cost_usd.toFixed(4)}
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setPerfDialogAd(a)} className="btn-ghost" title="Log performance">
                    <TrendingUp size={11} className={a.performance ? "text-live" : ""} />
                  </button>
                  <button onClick={() => toggleStar(a)} className="btn-ghost" title="Star">
                    <Star size={11} className={a.starred ? "fill-live text-live" : ""} />
                  </button>
                  <CopyButton text={a.output_text} />
                  <button
                    onClick={async () => {
                      await softDeleteAd(a.id);
                      refresh();
                      showUndoToast({
                        message: `Deleted "${a.title.slice(0, 40)}"`,
                        undo: async () => {
                          await restoreAd(a.id);
                          refresh();
                        },
                      });
                    }}
                    className="btn-ghost hover:text-neg"
                    title="Delete (undo for 7 seconds)"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              {expanded === a.id ? (
                <div className="border-t border-base-700 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mr-2">tag as:</span>
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusOn(a.id, s)}
                        className={`border px-2 py-1 text-[10px] font-mono uppercase tracking-ui-mega ${
                          a.status === s ? statusTone[s] : "border-base-600 text-ink-muted hover:text-ink"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="label">notes</label>
                    <textarea
                      rows={2}
                      defaultValue={a.notes}
                      onBlur={(e) => setNote(a.id, e.target.value)}
                      className="input-base"
                      placeholder="What worked? What didn't? Result?"
                    />
                  </div>
                  <pre className="max-h-96 overflow-auto border border-base-700 bg-base-950/60 p-3 text-[11px] font-mono whitespace-pre-wrap text-ink">
                    {a.output_text}
                  </pre>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {perfDialogAd ? (
        <PerformanceDialog
          ad={perfDialogAd}
          onClose={() => {
            setPerfDialogAd(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function StatusChip({ label, active, count, onClick, tone }: { label: string; active: boolean; count: number; onClick: () => void; tone?: string }) {
  return (
    <button
      onClick={onClick}
      className={`border px-2 py-1 text-[10px] font-mono uppercase tracking-ui-mega flex items-center gap-1.5 ${
        active ? tone ?? "border-live text-live bg-live/5" : "border-base-600 text-ink-muted hover:text-ink"
      }`}
    >
      {label}
      <span className="tabular text-ink-faint">{count}</span>
    </button>
  );
}
