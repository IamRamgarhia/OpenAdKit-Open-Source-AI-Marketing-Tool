"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, FolderOpen, Loader2, Download, Printer, ListPlus, X } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { listCampaigns, saveCampaign, deleteCampaign, listAds, updateAd, getAd, type Campaign, type GeneratedAd } from "@/lib/storage";
import { getActiveBrainId } from "@/lib/settings";
import { showUndoToast } from "@/components/UndoToast";

const STATUS_TONE: Record<Campaign["status"], "live" | "pos" | "default" | "neg"> = {
  planning: "default",
  live: "live",
  paused: "default",
  done: "pos",
};

async function loadCampaignData() {
  const id = getActiveBrainId();
  const [c, a] = await Promise.all([listCampaigns(id ?? undefined), listAds({ brand_id: id ?? undefined })]);
  return { id, campaigns: c, ads: a };
}

function newCampaign(brand_id: string, name: string, goal: string): Campaign {
  return { id: crypto.randomUUID(), brand_id, name, goal, status: "planning", created_at: Date.now() };
}

function exportFilename(c: Campaign): string {
  return `${c.name.replace(/[^a-z0-9-_ ]/gi, "_")}-${Date.now()}.md`;
}

const HTML_ESCAPES: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s: string) => s.replace(/[<>&"']/g, (ch) => HTML_ESCAPES[ch]);

export default function CampaignsPage() {
  return (
    <ApiKeyGate>
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </ApiKeyGate>
  );
}

function Inner() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  // ?add=<adId> — arriving from a generator's "Add to a campaign" next step.
  const addId = useSearchParams().get("add");
  const [pendingAd, setPendingAd] = useState<GeneratedAd | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!addId) return;
    let cancelled = false;
    getAd(addId).then((a) => {
      if (!cancelled) setPendingAd(a ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [addId]);

  function apply(d: Awaited<ReturnType<typeof loadCampaignData>>) {
    setActiveBrandId(d.id);
    setCampaigns(d.campaigns);
    setAds(d.ads);
  }
  async function refresh() {
    apply(await loadCampaignData());
  }

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadCampaignData().then((d) => {
        if (!cancelled) apply(d);
      });
    load();
    window.addEventListener("ados:brains-changed", load);
    window.addEventListener("ados:active-brain-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("ados:brains-changed", load);
      window.removeEventListener("ados:active-brain-changed", load);
    };
  }, []);

  async function assign(adId: string, campaignId: string | undefined) {
    await updateAd(adId, { campaign_id: campaignId });
    setAds((cur) => cur.map((a) => (a.id === adId ? { ...a, campaign_id: campaignId } : a)));
  }

  async function create() {
    if (!name.trim() || !activeBrandId) return;
    setSaving(true);
    await saveCampaign(newCampaign(activeBrandId, name.trim(), goal.trim()));
    setName("");
    setGoal("");
    setCreating(false);
    setSaving(false);
    refresh();
  }

  function adsFor(campaign_id: string) {
    return ads.filter((a) => a.campaign_id === campaign_id);
  }

  /** Print-friendly PDF export. Opens a new window with a clean printable
   *  layout and triggers the browser's print dialog → "Save as PDF" works
   *  with zero dependencies. */
  function printCampaign(c: Campaign) {
    const items = adsFor(c.id);
    if (!items.length) return;
    // No "noopener" in the features string: with it, window.open() returns
    // null by spec, so the document could never be written and the button
    // did nothing at all. Sever the back-reference manually instead.
    setPrintError(null);
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) {
      setPrintError("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      return;
    }
    w.opener = null;
    const created = new Date(c.created_at).toLocaleString();
    const safeName = escapeHtml(c.name || "Campaign");
    const escape = escapeHtml;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${safeName} — OpenAdKit campaign</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1a1a22; max-width: 720px; margin: 0 auto; padding: 20px; }
  h1 { font: italic 700 32px/1.15 "Georgia", serif; margin: 0 0 6px; }
  h2 { font-size: 18px; margin: 28px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 18px; }
  .asset { page-break-inside: avoid; margin-bottom: 18px; }
  .asset-meta { font-size: 11px; color: #555; margin: 2px 0 6px; font-family: ui-monospace, monospace; }
  pre { background: #f5f5f7; border: 1px solid #e1e1e6; padding: 10px 12px; white-space: pre-wrap; word-wrap: break-word; font: 11px/1.5 ui-monospace, "Cascadia Code", monospace; color: #222; border-radius: 3px; }
  .footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
  @media print { .no-print { display: none; } }
  .no-print { margin: 0 0 20px; padding: 8px 12px; background: #fff8e7; border: 1px solid #ffb020; font-size: 12px; }
  .no-print button { margin-left: 8px; padding: 4px 10px; cursor: pointer; }
</style>
</head><body>
  <div class="no-print">
    Print or "Save as PDF" from your browser's print dialog.
    <button onclick="window.print()">Print now</button>
    <button onclick="window.close()">Close</button>
  </div>
  <h1>${safeName}</h1>
  <div class="meta">Status: ${c.status} · Goal: ${escape(c.goal || "—")} · Created: ${created} · ${items.length} asset${items.length === 1 ? "" : "s"}</div>
  ${items.map((a) => `
    <section class="asset">
      <h2>${escape(a.title)}</h2>
      <div class="asset-meta">${a.platform} · ${escape(a.campaign_type)} · ${a.status} · ${new Date(a.created_at).toLocaleDateString()} · $${(a.cost_usd ?? 0).toFixed(4)}</div>
      ${a.notes ? `<div class="asset-meta">${escape(a.notes)}</div>` : ""}
      <pre>${escape(a.output_text)}</pre>
    </section>
  `).join("")}
  <div class="footer">Generated by OpenAdKit · ${new Date().toLocaleString()}</div>
  <script>
    // Auto-fire print after the page settles. User can cancel and use the
    // "Print now" button instead if they want to tweak settings first.
    setTimeout(function () { try { window.print(); } catch (e) {} }, 350);
  </script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function exportCampaign(c: Campaign) {
    const items = adsFor(c.id);
    if (!items.length) return;
    const created = new Date(c.created_at).toLocaleString();
    const lines: string[] = [
      `# ${c.name}`,
      ``,
      `**Status:** ${c.status} · **Goal:** ${c.goal || "—"} · **Created:** ${created}`,
      c.notes ? `\n${c.notes}\n` : "",
      `---`,
      ``,
    ];
    for (const a of items) {
      lines.push(`## ${a.title}`);
      lines.push(``);
      lines.push(`> ${a.platform} · ${a.campaign_type} · ${a.status} · ${new Date(a.created_at).toLocaleDateString()} · $${(a.cost_usd ?? 0).toFixed(4)}`);
      lines.push(``);
      if (a.notes) lines.push(`_${a.notes}_\n`);
      lines.push("```");
      lines.push(a.output_text);
      lines.push("```");
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename(c);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    // Defer revoke: revoking synchronously can cancel the download in Firefox/Safari.
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  }

  return (
    <div>
      <PageHeader
        scope="campaigns"
        title="Campaigns"
        subtitle="Group ads into named campaigns. Track planning → live → done. Scoped to active brand."
      />

      {!activeBrandId ? (
        <div className="border border-live/30 bg-live/5 text-live text-sm px-4 py-3 mb-4">
          No active brand. <Link href="/brand" className="underline">Set one</Link> first.
        </div>
      ) : null}

      {pendingAd ? (
        <div className="border border-live/40 bg-live/5 p-4 mb-4 space-y-2" data-testid="pending-add">
          <div className="text-sm text-ink">
            Add <strong>{pendingAd.title}</strong> to a campaign:
          </div>
          <div className="flex flex-wrap gap-2">
            {campaigns.map((c) => (
              <button
                key={c.id}
                className="btn-ghost"
                onClick={async () => {
                  await assign(pendingAd.id, c.id);
                  setAddedMsg(`Added "${pendingAd.title}" to ${c.name}.`);
                  setPendingAd(null);
                }}
              >
                <FolderOpen size={11} /> {c.name}
              </button>
            ))}
            {!creating ? (
              <button className="btn-primary" onClick={() => setCreating(true)} disabled={!activeBrandId}>
                <Plus size={11} /> New campaign
              </button>
            ) : null}
            <button className="btn-ghost" onClick={() => setPendingAd(null)}>Not now</button>
          </div>
        </div>
      ) : null}
      {addedMsg ? (
        <div role="status" className="border border-pos/40 bg-pos/5 text-pos text-[12px] px-3 py-2 mb-4">
          ✓ {addedMsg}
        </div>
      ) : null}

      {printError ? (
        <div role="alert" className="border border-neg/40 bg-neg/5 text-neg text-[12px] px-3 py-2 mb-4">
          {printError}
        </div>
      ) : null}

      <div className="mb-4">
        {creating ? (
          <div className="border border-base-600 bg-base-900/40 p-4 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Campaign name *</label>
                <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 trial blitz" autoFocus />
              </div>
              <div>
                <label className="label">Goal</label>
                <input className="input-base" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="1,000 trial signups" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={create} disabled={saving || !name.trim()} className="btn-primary">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Create
              </button>
              <button onClick={() => { setCreating(false); setName(""); setGoal(""); }} className="btn-ghost">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} disabled={!activeBrandId} className="btn-primary">
            <Plus size={11} /> New campaign
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="border border-live/30 bg-live/3 p-6 text-center">
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2">no campaigns yet</div>
          <h3 className="font-display italic text-xl text-ink leading-tight mb-2">Group your work by launch.</h3>
          <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed mb-4">
            Campaigns let you bundle related ads, calendars, and emails for one launch — then download the whole kit as markdown or PDF for client hand-off. The fastest way to fill one is the <strong className="text-ink">10-Minute Launch Wizard</strong>.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href="/launch/wizard" className="btn-primary">⚡ Build a launch kit</Link>
            {activeBrandId ? (
              <button onClick={() => setCreating(true)} className="btn-ghost">
                <Plus size={11} /> Empty campaign
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2 stagger">
          {campaigns.map((c) => {
            const items = adsFor(c.id);
            return (
              <div key={c.id} className="border border-base-600 bg-base-900/40 p-4">
                <div className="flex items-start gap-3">
                  <FolderOpen size={16} className="text-live mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display italic text-xl text-ink">{c.name}</span>
                      <Pill text={c.status} tone={STATUS_TONE[c.status]} />
                      <span className="text-[11px] text-ink-faint">created {new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    {c.goal ? <p className="text-sm text-ink-muted mt-1">{c.goal}</p> : null}
                    <div className="text-[12px] text-ink-muted mt-2 flex items-center gap-3 flex-wrap">
                      <span>{items.length === 0 ? "No ads assigned yet." : `${items.length} ad${items.length === 1 ? "" : "s"} grouped`}</span>
                      <button
                        onClick={() => setAddingTo((cur) => (cur === c.id ? null : c.id))}
                        className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-ui-wide text-live hover:underline"
                        aria-expanded={addingTo === c.id}
                      >
                        <ListPlus size={11} /> {addingTo === c.id ? "done" : "add from history"}
                      </button>
                    </div>
                    {items.length ? (
                      <ul className="mt-2 space-y-1" aria-label={`Ads in ${c.name}`}>
                        {items.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 text-[12px] border border-base-700 px-2 py-1">
                            <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live w-14 shrink-0">{a.platform}</span>
                            <Link href={`/history?focus=${encodeURIComponent(a.id)}`} className="flex-1 truncate text-ink hover:underline">{a.title}</Link>
                            <button onClick={() => assign(a.id, undefined)} className="text-ink-faint hover:text-neg" aria-label={`Remove ${a.title} from campaign`} title="Remove from campaign">
                              <X size={11} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {addingTo === c.id ? (
                      <AddFromHistory ads={ads.filter((a) => a.campaign_id !== c.id)} onAdd={(id) => assign(id, c.id)} />
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    {(["planning", "live", "paused", "done"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => saveCampaign({ ...c, status: s }).then(refresh)}
                        className={`border px-2 py-0.5 text-[10px] uppercase tracking-wider ${c.status === s ? "border-live text-live bg-live/10" : "border-base-700 text-ink-muted hover:text-ink"}`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => exportCampaign(c)}
                      disabled={items.length === 0}
                      className="btn-ghost disabled:opacity-30"
                      title={items.length ? `Download all ${items.length} assets as one markdown file` : "No assets to export"}
                    >
                      <Download size={11} />
                    </button>
                    <button
                      onClick={() => printCampaign(c)}
                      disabled={items.length === 0}
                      className="btn-ghost disabled:opacity-30"
                      title={items.length ? `Open print-friendly view → Save as PDF from the print dialog` : "No assets to export"}
                    >
                      <Printer size={11} />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteCampaign(c.id);
                        refresh();
                        showUndoToast({
                          message: `Deleted "${c.name}"`,
                          undo: async () => {
                            await saveCampaign({ ...c, deleted_at: undefined } as any);
                            refresh();
                          },
                        });
                      }}
                      className="btn-ghost hover:text-neg"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddFromHistory({ ads, onAdd }: { ads: GeneratedAd[]; onAdd: (id: string) => void }) {
  const [q, setQ] = useState("");
  const shown = ads
    .filter((a) => !q || `${a.title} ${a.campaign_type} ${a.platform}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);
  return (
    <div className="mt-3 border border-base-700 bg-base-950/40 p-2 space-y-2" data-testid="add-from-history">
      <input
        className="input-base"
        placeholder="filter saved ads for this client..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filter saved ads"
      />
      {shown.length === 0 ? (
        <p className="text-[12px] text-ink-muted px-1">
          No other saved ads for this client. <Link href="/history" className="text-live underline">Open history</Link>
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y divide-base-700">
          {shown.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-1 py-1.5 text-[12px]">
              <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live w-14 shrink-0">{a.platform}</span>
              <span className="flex-1 truncate text-ink">{a.title}</span>
              {a.campaign_id ? <span className="text-[10px] text-ink-faint">in another campaign</span> : null}
              <button onClick={() => onAdd(a.id)} className="btn-ghost py-0.5" aria-label={`Add ${a.title}`}>
                <Plus size={11} /> add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
