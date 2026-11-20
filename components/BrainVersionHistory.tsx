"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, Loader2 } from "lucide-react";
import { listBrainVersions, restoreBrainVersion, MAX_BRAIN_VERSIONS, type BrainVersion } from "@/lib/storage";
import type { BrandBrain } from "@/lib/brand-brain";

/**
 * Version history for one brand brain.
 *
 * Brains were previously overwritten in place with no history. That made the
 * flagship onboarding flow ("paste a URL, let the model infer everything")
 * a one-way door: a re-extraction that came back worse than what you had
 * destroyed the good version with no way back. We snapshot on every save and
 * expose the last few here.
 */
export function BrainVersionHistory({
  brainId,
  onRestored,
}: {
  brainId: string;
  onRestored?: (b: BrandBrain) => void;
}) {
  const [versions, setVersions] = useState<BrainVersion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await listBrainVersions(brainId));
    } catch {
      setVersions([]);
    } finally {
      setLoaded(true);
    }
  }, [brainId]);

  useEffect(() => {
    let cancelled = false;
    listBrainVersions(brainId)
      .catch(() => [] as BrainVersion[])
      .then((v) => {
        if (cancelled) return;
        setVersions(v);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brainId]);

  async function restore(v: BrainVersion) {
    const when = new Date(v.created_at).toLocaleString();
    if (
      !confirm(
        `Restore this brand brain to its state from ${when}?\n\nYour current version is snapshotted first, so you can undo this too.`
      )
    ) {
      return;
    }
    setBusyId(v.id);
    try {
      const restored = await restoreBrainVersion(v.id);
      if (restored) {
        window.dispatchEvent(new Event("ados:brains-changed"));
        onRestored?.(restored);
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded) return null;
  if (!versions.length) {
    return (
      <p className="text-[11px] text-ink-subtle font-mono uppercase tracking-ui-wide">
        no earlier versions yet — the next save will snapshot this one
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-ink-muted leading-relaxed">
        The last {MAX_BRAIN_VERSIONS} saves are kept. Restoring snapshots your current version first,
        so it&apos;s reversible.
      </p>
      <ul className="divide-y divide-base-700 border border-base-700">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center gap-3 px-3 py-2">
            <History size={12} className="text-ink-faint shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-ink truncate">
                {v.snapshot.business_name || v.snapshot.name || "(unnamed)"}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint">
                {new Date(v.created_at).toLocaleString()} · {v.reason} · {filledCount(v.snapshot)} fields
              </div>
            </div>
            <button
              onClick={() => restore(v)}
              disabled={busyId !== null}
              className="btn-ghost shrink-0"
              title="Restore this version"
            >
              {busyId === v.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rough "how complete was this snapshot" signal, so the user can tell a rich
 *  version from a thin one at a glance without opening each. */
function filledCount(b: BrandBrain): number {
  let n = 0;
  for (const v of Object.values(b)) {
    if (Array.isArray(v)) {
      if (v.length) n++;
    } else if (typeof v === "string") {
      if (v.trim()) n++;
    } else if (v && typeof v === "object") {
      if (Object.values(v).some((x) => x && String(x).trim())) n++;
    }
  }
  return n;
}
