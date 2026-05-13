"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import { BrandBrainForm } from "@/components/BrandBrainForm";
import { listBrains, softDeleteBrain, restoreBrain, getBrain, exportBrain, importBrain } from "@/lib/storage";
import { showUndoToast } from "@/components/UndoToast";
import { type BrandBrain } from "@/lib/brand-brain";
import { setActiveBrainId, getActiveBrainId } from "@/lib/settings";

export default function BrandPage() {
  return (
    <ApiKeyGate>
      <Suspense fallback={null}>
        <BrandInner />
      </Suspense>
    </ApiKeyGate>
  );
}

function BrandInner() {
  const params = useSearchParams();
  const router = useRouter();
  // Backwards-compat: anything in the codebase still pointing at /brand?first=1
  // gets routed forward to the dedicated onboarding page.
  const isFirst = params.get("first") === "1";
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [editing, setEditing] = useState<BrandBrain | null>(null);
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const list = await listBrains();
    setBrains(list);
    setActiveBrandIdState(getActiveBrainId());
    setLoading(false);
  }

  function activateBrand(id: string) {
    setActiveBrainId(id);
    setActiveBrandIdState(id);
    window.dispatchEvent(new Event("ados:brains-changed"));
  }

  async function downloadBrain(id: string, name: string) {
    const json = await exportBrain(id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brain-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadBrain(file: File) {
    try {
      const text = await file.text();
      await importBrain(text);
      window.dispatchEvent(new Event("ados:brains-changed"));
      refresh();
    } catch (e: any) {
      alert(`Import failed: ${e?.message ?? "invalid file"}`);
    }
  }

  useEffect(() => {
    refresh();
    // Route /brand?first=1 to the dedicated onboarding page.
    if (isFirst) router.replace("/brand/new");
  }, [isFirst, router]);

  // Editing flow — when the user clicks "Edit" on a brand card, the existing
  // BrandBrainForm component takes over. Cleaner than having a separate route
  // for now since the form already handles save + cancel + redirect.
  if (editing) {
    return (
      <div>
        <PageHeader
          scope={`brand/${editing.id.slice(0, 8)}`}
          title="Edit client"
          subtitle="Refine the brand brain. Every change flows into future generations."
          actions={
            <button onClick={() => { setEditing(null); refresh(); }} className="btn-ghost">
              ← back to clients
            </button>
          }
        />
        <BrandBrainForm initial={editing} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        scope="brand"
        title="Clients"
        subtitle="Your saved brand brains. Click a card to activate it — every tool across AdForge auto-uses the active client's voice, audience, products, and pillars."
        actions={
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBrain(f); e.target.value = ""; }}
            />
            <button onClick={() => importRef.current?.click()} className="btn-ghost">
              <Upload size={12} /> import
            </button>
            <Link href="/brand/new" className="btn-primary">
              <Plus size={12} /> Add new client
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-2">
          <div className="h-24 border border-base-700/50 bg-base-900/30 animate-pulse-soft" />
          <div className="h-24 border border-base-700/50 bg-base-900/30 animate-pulse-soft" />
        </div>
      ) : brains.length === 0 ? (
        // First-touch empty state — clear single path forward.
        <div className="border border-live/40 bg-live/[0.04] p-8 text-center">
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2">no clients yet</div>
          <h2 className="font-display italic text-3xl text-ink leading-tight mb-2">Add your first client to unlock every tool.</h2>
          <p className="text-sm text-ink-muted max-w-xl mx-auto leading-relaxed mb-5">
            AdForge's brand brain is what makes every output sound like <em>this</em> client — not generic AI copy. Paste a website URL, search Google by name, or start from an industry template. AI extracts 90% of the intelligence in ~10 seconds; you cross-check and approve.
          </p>
          <Link href="/brand/new" className="btn-primary text-base">
            <Plus size={14} /> Add your first client
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink">
              {brains.length} {brains.length === 1 ? "client" : "clients"}
            </h2>
            <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle">click a card to switch · entire app reflects the active client</p>
          </div>
          <div className="space-y-2 stagger">
            {brains.map((b) => {
              const isActive = b.id === activeBrandId;
              // Brain-completeness signal: how many of the 12 brand-defining fields
              // are filled? Below 50% means most generators will fall back to
              // generic copy for at least some surfaces.
              const completeness = brainCompleteness(b);
              return (
                <div
                  key={b.id}
                  className={`group border bg-base-900/40 p-4 flex items-start justify-between gap-4 transition-all cursor-pointer ${
                    isActive
                      ? "border-live shadow-[0_0_0_1px_rgba(255,176,32,0.4)_inset] bg-live/[0.03]"
                      : "border-base-600 hover:border-base-500 hover:bg-base-800/40"
                  }`}
                  onClick={() => activateBrand(b.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateBrand(b.id); } }}
                  aria-pressed={isActive}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isActive ? (
                        <span className="text-[10px] font-mono uppercase tracking-ui-mega bg-live text-base-950 px-1.5 py-0.5 font-bold">
                          ✓ active
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
                          click to activate
                        </span>
                      )}
                      <span className="text-[10px] text-ink-faint">·</span>
                      <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
                        {b.industry || "industry unspecified"}
                      </span>
                      <span className="text-[10px] text-ink-faint">·</span>
                      <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle">
                        updated {new Date(b.updated_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-ink-faint">·</span>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-ui-mega ${
                          completeness.tone === "good" ? "text-pos" : completeness.tone === "okay" ? "text-live" : "text-neg"
                        }`}
                        title={`${completeness.filled} of ${completeness.total} brand fields filled. Generators read every field — thin brains produce more generic copy.`}
                      >
                        brain {completeness.filled}/{completeness.total}
                      </span>
                    </div>
                    <div className={`font-display italic text-xl ${isActive ? "text-live" : "text-ink"}`}>
                      {b.name || b.business_name}
                    </div>
                    {b.usp ? (
                      <p className="text-sm text-ink-muted mt-2 line-clamp-2">{b.usp}</p>
                    ) : null}
                    {(b.platforms?.length || b.content_pillars?.length) ? (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(b.platforms ?? []).slice(0, 6).map((p) => (
                          <span key={p} className="text-[10px] font-mono uppercase tracking-ui-wide border border-base-700 px-1.5 py-0.5 text-ink-muted">{p}</span>
                        ))}
                        {(b.content_pillars ?? []).slice(0, 4).map((p) => (
                          <span key={p} className="text-[10px] font-mono uppercase tracking-ui-wide border border-info/30 text-info px-1.5 py-0.5">{p}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={async () => setEditing((await getBrain(b.id)) ?? null)}
                      className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-muted hover:text-ink transition flex items-center gap-1.5 px-2 py-1 border border-base-700 hover:border-base-500"
                      title="Edit this brand's fields"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                    <button
                      onClick={() => downloadBrain(b.id, b.name || b.business_name)}
                      className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-muted hover:text-ink transition flex items-center gap-1.5 px-2 py-1 border border-base-700 hover:border-base-500"
                      title="Export this brain as JSON"
                    >
                      <Download size={10} /> Export
                    </button>
                    <button
                      onClick={async () => {
                        const label = b.name || b.business_name;
                        if (!confirm(`Delete "${label}"?\n\nYou can undo from the toast for 7 seconds, but after that the brand and its history link are gone.`)) return;
                        await softDeleteBrain(b.id);
                        window.dispatchEvent(new Event("ados:brains-changed"));
                        refresh();
                        showUndoToast({
                          message: `Deleted "${label}"`,
                          undo: async () => {
                            await restoreBrain(b.id);
                            window.dispatchEvent(new Event("ados:brains-changed"));
                            refresh();
                          },
                        });
                      }}
                      className="text-[11px] font-mono uppercase tracking-ui-wide text-neg hover:bg-neg/10 transition flex items-center gap-1.5 px-2 py-1 border border-neg/40"
                      title="Delete (undo for 7 seconds)"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-6 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
        no brand?{" "}
        <Link href="/generate/google" className="text-live hover:underline">
          generate without one →
        </Link>{" "}
        (output will be generic)
      </div>
    </div>
  );
}

/**
 * Rough brain-completeness rating. Counts how many of the 12 generator-defining
 * fields are populated and buckets into good (≥9) / okay (5-8) / thin (<5).
 * Used by the client cards on /brand so users can see at-a-glance which
 * clients have skinny brains.
 */
function brainCompleteness(b: BrandBrain): { filled: number; total: number; tone: "good" | "okay" | "thin" } {
  const filled =
    (b.business_name ? 1 : 0) +
    (b.industry ? 1 : 0) +
    (b.niche ? 1 : 0) +
    (b.usp ? 1 : 0) +
    (b.tone ? 1 : 0) +
    (b.audience_who ? 1 : 0) +
    (b.audience_pain_points?.length ? 1 : 0) +
    (b.audience_desires?.length ? 1 : 0) +
    (b.key_benefits?.length ? 1 : 0) +
    (b.products?.length ? 1 : 0) +
    (b.platforms?.length ? 1 : 0) +
    (b.content_pillars?.length ? 1 : 0);
  const total = 12;
  return { filled, total, tone: filled >= 9 ? "good" : filled >= 5 ? "okay" : "thin" };
}
