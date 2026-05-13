"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  Brain,
  Sparkles,
  Facebook,
  Search as GoogleIcon,
  Music2,
  Linkedin,
  Youtube,
  Twitter,
  Mail,
  Microscope,
  CalendarDays,
  GraduationCap,
  Database,
  History,
  Zap,
} from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
import { listBrains, listAds } from "@/lib/storage";
import { getActiveBrainId, setActiveBrainId } from "@/lib/settings";
import type { BrandBrain } from "@/lib/brand-brain";
import type { GeneratedAd } from "@/lib/storage";

type Action = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: any;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [recent, setRecent] = useState<GeneratedAd[]>([]);
  const [activeBrainId, setActiveBrain] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [b, a] = await Promise.all([listBrains(), listAds()]);
    setBrains(b);
    setRecent(a.slice(0, 8));
    setActiveBrain(getActiveBrainId());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      refresh();
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, refresh]);

  const actions = useMemo<Action[]>(() => {
    const groupIconMap: Record<string, any> = {
      "Start here": Sparkles,
      "Meta · Facebook + Instagram": Facebook,
      "Google · Search + PMax + Shopping": GoogleIcon,
      "TikTok": Music2,
      "LinkedIn · B2B": Linkedin,
      "YouTube": Youtube,
      "X · Twitter": Twitter,
      "Email + Display": Mail,
      "Research & Insights": Microscope,
      "Routines": CalendarDays,
      "Learn": GraduationCap,
      "Data": Database,
    };
    // Dedup cross-platform tools: a single tool listed under multiple platform
    // groups should appear once in the palette. Keep the first occurrence's
    // group label so users still get a sensible category, but suppress repeats.
    const seenHrefs = new Set<string>();
    const nav: Action[] = NAV_GROUPS.flatMap((g) =>
      g.items
        .filter((item) => {
          const key = item.href + (item.query ?? "");
          if (seenHrefs.has(key)) return false;
          seenHrefs.add(key);
          return true;
        })
        .map<Action>((item) => ({
          id: `nav:${g.title}::${item.href}::${item.query ?? ""}`,
          label: item.label,
          group: g.title,
          icon: groupIconMap[g.title] ?? ArrowRight,
          run: () => {
            const href = item.query ? `${item.href}?${item.query}` : item.href;
            router.push(href);
            setOpen(false);
          },
        }))
    );

    // Quick actions — flagship features that deserve top-of-mind discovery.
    const quickActions: Action[] = [
      {
        id: "quick:wizard",
        label: "Build a 10-minute launch kit",
        hint: "5 chained AI generations → one Campaign",
        group: "Quick actions",
        icon: Zap,
        run: () => { router.push("/launch/wizard"); setOpen(false); },
      },
      {
        id: "quick:batch",
        label: "Multi-client batch generate",
        hint: "Same asset across N clients in parallel",
        group: "Quick actions",
        icon: Zap,
        run: () => { router.push("/batch"); setOpen(false); },
      },
    ];

    const brainActions: Action[] = brains.map((b) => ({
      id: `brain:${b.id}`,
      label: `Switch to ${b.name || b.business_name}`,
      hint: b.industry || undefined,
      group: "Switch client",
      icon: Brain,
      run: () => {
        setActiveBrainId(b.id);
        window.dispatchEvent(new Event("ados:brains-changed"));
        setOpen(false);
      },
    }));

    const recentActions: Action[] = recent.map((a) => ({
      id: `ad:${a.id}`,
      label: a.title,
      hint: `${a.platform} · ${a.campaign_type}`,
      group: "Recent history",
      icon: History,
      run: () => {
        // /history?focus=<id> auto-expands + scrolls + ring-highlights the row.
        router.push(`/history?focus=${a.id}`);
        setOpen(false);
      },
    }));

    return [...quickActions, ...brainActions, ...recentActions, ...nav];
  }, [brains, recent, router]);

  const filtered = useMemo(() => {
    if (!q.trim()) return actions;
    const needle = q.toLowerCase();
    return actions.filter((a) => {
      const hay = `${a.label} ${a.hint ?? ""} ${a.group}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [actions, q]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[idx]?.run();
    }
  };

  if (!open) return null;

  // Group filtered actions by their group label
  const grouped: Record<string, Action[]> = {};
  for (const a of filtered) {
    (grouped[a.group] ||= []).push(a);
  }

  let renderedIdx = 0;
  const activeBrandName = brains.find((b) => b.id === activeBrainId)?.name;

  return (
    <div
      className="fixed inset-0 z-[60] bg-base-950/80 backdrop-blur grid place-items-start pt-[10vh] px-4"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl bg-base-900 border border-base-600 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-base-600">
          <Search size={16} className="text-ink-muted" aria-hidden="true" />
          <label htmlFor="cmdk-input" className="sr-only">
            Search pages, clients, and recent history
          </label>
          <input
            ref={inputRef}
            id="cmdk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page, switch client, find a saved ad…"
            className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder-ink-subtle"
            aria-autocomplete="list"
            aria-controls="cmdk-listbox"
            aria-activedescendant={filtered[idx] ? `cmdk-opt-${filtered[idx].id}` : undefined}
          />
          <kbd className="text-[10px] font-mono text-ink-faint border border-base-600 px-1.5 py-0.5" aria-hidden="true">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2" id="cmdk-listbox" role="listbox" aria-label="Results">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-muted" role="status">No matches.</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="py-1" role="group" aria-label={group}>
                <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{group}</div>
                {items.map((a) => {
                  const isActive = renderedIdx === idx;
                  const myIdx = renderedIdx;
                  renderedIdx++;
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      id={`cmdk-opt-${a.id}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setIdx(myIdx)}
                      onClick={() => a.run()}
                      className={`w-full text-left flex items-center gap-3 px-4 py-2 text-[14px] ${
                        isActive ? "bg-base-800 text-ink" : "text-ink-muted hover:bg-base-800/50"
                      }`}
                    >
                      <Icon size={14} className={isActive ? "text-live" : "text-ink-faint"} aria-hidden="true" />
                      <span className="flex-1 truncate">{a.label}</span>
                      {a.hint ? (
                        <span className="text-[11px] text-ink-faint truncate max-w-[200px]">{a.hint}</span>
                      ) : null}
                      {isActive ? <span className="text-[10px] font-mono text-live" aria-hidden="true">↵</span> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-base-600 px-4 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          <span>{activeBrandName ? `Active: ${activeBrandName}` : "No active brand"}</span>
          <span>
            <kbd className="border border-base-600 px-1.5 py-0.5 mr-1">↑↓</kbd>
            <kbd className="border border-base-600 px-1.5 py-0.5">↵</kbd>
            <span className="ml-2">Cmd+K to open anywhere</span>
          </span>
        </div>
      </div>
    </div>
  );
}
