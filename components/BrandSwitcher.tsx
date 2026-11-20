"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Brain } from "lucide-react";
import { listBrains, getBrain } from "@/lib/storage";
import { getActiveBrainId, setActiveBrainId } from "@/lib/settings";
import type { BrandBrain } from "@/lib/brand-brain";

async function loadSwitcherState(): Promise<{ all: BrandBrain[]; cur: BrandBrain | null }> {
  const all = await listBrains();
  const id = getActiveBrainId();
  const cur = id ? (await getBrain(id)) ?? null : null;
  if (!id && all[0]) setActiveBrainId(all[0].id);
  return { all, cur: cur ?? all[0] ?? null };
}

export function BrandSwitcher() {
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [active, setActive] = useState<BrandBrain | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const h = () => {
      loadSwitcherState().then(({ all, cur }) => {
        if (cancelled) return;
        setBrains(all);
        setActive(cur);
      });
    };
    h();
    window.addEventListener("storage", h);
    window.addEventListener("ados:brains-changed", h);
    // PageHeader chip needs to refresh when the Sidebar switches active brand.
    // (Audit finding #32.)
    window.addEventListener("ados:active-brain-changed", h);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", h);
      window.removeEventListener("ados:brains-changed", h);
      window.removeEventListener("ados:active-brain-changed", h);
    };
  }, []);

  async function pick(b: BrandBrain) {
    // setActiveBrainId already dispatches `ados:active-brain-changed`.
    // Don't double-dispatch `ados:brains-changed` — that triggers the
    // non-reset handler in GeneratorShell right after the reset one,
    // leaving the form in a partially merged state. (Audit finding #12.)
    setActiveBrainId(b.id);
    setActive(b);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-base-600 bg-base-900/70 hover:bg-base-800 px-3 py-1.5 text-[11px] uppercase tracking-ui-wide font-mono"
      >
        <Brain size={12} className="text-live" />
        <span className="max-w-[140px] truncate text-ink">
          {active?.name || active?.business_name || "no brand"}
        </span>
        <ChevronDown size={11} className="text-ink-subtle" />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-72 border border-base-600 bg-base-950 shadow-2xl">
          {brains.length === 0 ? (
            <div className="px-3 py-3 text-[11px] font-mono uppercase tracking-ui-mega text-ink-subtle">
              no brand brains yet
            </div>
          ) : (
            brains.map((b) => (
              <button
                key={b.id}
                onClick={() => pick(b)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-base-800/70 border-b border-base-700 last:border-b-0"
              >
                <div className="font-medium text-ink truncate">{b.name || b.business_name || "untitled"}</div>
                <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-subtle truncate mt-0.5">
                  {b.industry || "industry unspecified"}
                </div>
              </button>
            ))
          )}
          <div className="border-t border-base-600">
            <Link
              href="/brand"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[11px] font-mono uppercase tracking-ui-mega text-live hover:bg-base-800/70"
            >
              + new brand brain
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
