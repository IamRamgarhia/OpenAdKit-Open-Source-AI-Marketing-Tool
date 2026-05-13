"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Sparkles,
  Facebook,
  Search as SearchIcon,
  Music2,
  Linkedin,
  Youtube,
  Twitter,
  Mail,
  Microscope,
  CalendarDays,
  GraduationCap,
  Database,
  Lock,
  Brain,
  Plus,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-config";
import { listBrains } from "@/lib/storage";
import { getActiveBrainId, setActiveBrainId } from "@/lib/settings";
import type { BrandBrain } from "@/lib/brand-brain";

// Lucide doesn't ship a Google-G icon by default; use SearchIcon as the closest
// semantic fit (Google = search ads in this app). Same for TikTok → Music2.
const GROUP_ICONS: Record<string, LucideIcon> = {
  "Start here": Sparkles,
  "Meta · Facebook + Instagram": Facebook,
  "Google · Search + PMax + Shopping": SearchIcon,
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

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) init[g.title] = g.defaultOpen ?? false;
    return init;
  });

  // Active-client tracking: every tool in the sidebar reads the active brain,
  // so the sidebar shows which brain that is + lets the user quick-switch.
  const [brains, setBrains] = useState<BrandBrain[]>([]);
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const list = await listBrains();
      if (!mounted) return;
      setBrains(list);
      setActiveBrandIdState(getActiveBrainId());
    };
    load();
    const onChange = () => load();
    window.addEventListener("ados:brains-changed", onChange);
    window.addEventListener("ados:active-brain-changed", onChange);
    return () => {
      mounted = false;
      window.removeEventListener("ados:brains-changed", onChange);
      window.removeEventListener("ados:active-brain-changed", onChange);
    };
  }, []);

  function pickBrand(id: string) {
    setActiveBrainId(id);
    setActiveBrandIdState(id);
    setSwitcherOpen(false);
  }

  // Auto-expand the group containing the current path so users never have a
  // hidden active item.
  useEffect(() => {
    if (!path) return;
    setOpen((cur) => {
      const next = { ...cur };
      for (const g of NAV_GROUPS) {
        const hit = g.items.some((i) => path === i.href || (i.href !== "/" && path.startsWith(i.href)));
        if (hit) next[g.title] = true;
      }
      return next;
    });
  }, [path]);

  const activeBrand = brains.find((b) => b.id === activeBrandId);

  return (
    <aside
      className={cn(
        // Frosted dark sidebar — slightly translucent over the gradient page bg
        "hidden md:flex w-[280px] shrink-0 flex-col",
        "border-r border-base-700/60 bg-base-950/85 backdrop-blur-xl",
        // subtle inner edge highlight for depth
        "shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]"
      )}
    >
      {/* Brand block */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-base-700/60">
        <Link href="/" className="flex items-center gap-2.5 group" aria-label="AdForge dashboard">
          <div className="relative h-9 w-9 grid place-items-center">
            <div className="absolute inset-0 bg-live rounded-sm" />
            <div className="absolute inset-0 bg-live/40 rounded-sm blur-md group-hover:blur-lg transition-all" />
            <span className="relative text-base-950 font-bold font-display italic text-xl leading-none">A</span>
          </div>
          <div className="leading-tight">
            <div className="font-display italic text-2xl text-ink group-hover:text-live transition-colors">AdForge</div>
            <div className="text-[10px] text-ink-subtle font-mono uppercase tracking-ui-wide">ai ads · byok · local</div>
          </div>
        </Link>
        <Link
          href="/about"
          className="ml-auto text-[10px] text-live hover:text-live/80 transition shrink-0 font-mono uppercase tracking-ui-wide"
          aria-label="About Dicecodes"
        >
          by Dicecodes
        </Link>
      </div>

      {/* Active-client block — persistent reminder of which brain every tool
          below this point will use. Click to quick-switch between saved clients;
          no client yet → CTA into the onboarding flow. */}
      <div className="border-b border-base-700/60 px-3 py-3 relative">
        {activeBrand ? (
          <>
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 group text-left"
              aria-expanded={switcherOpen}
              aria-haspopup="listbox"
            >
              <div className="shrink-0 h-7 w-7 grid place-items-center bg-live/20 border border-live/40 rounded-sm">
                <Brain size={12} className="text-live" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint leading-none">active client</div>
                <div className="text-[13px] text-ink font-medium truncate leading-tight mt-0.5">
                  {activeBrand.name || activeBrand.business_name}
                </div>
              </div>
              <ChevronDown size={12} className={cn("text-ink-faint shrink-0 transition-transform", switcherOpen && "rotate-180")} />
            </button>

            {switcherOpen ? (
              <div className="absolute left-2 right-2 top-full mt-1 z-40 bg-base-900 border border-base-600 shadow-2xl animate-fade-up max-h-[60vh] overflow-y-auto">
                <div className="px-3 py-2 border-b border-base-700/60 text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint">
                  switch active client
                </div>
                <ul role="listbox" className="py-1">
                  {brains.map((b) => {
                    const isActive = b.id === activeBrandId;
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => pickBrand(b.id)}
                          role="option"
                          aria-selected={isActive}
                          className={cn(
                            "w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors",
                            isActive ? "bg-live/10 text-live" : "text-ink-muted hover:bg-base-800 hover:text-ink"
                          )}
                        >
                          {isActive ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{b.name || b.business_name}</div>
                            {b.industry ? (
                              <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-faint truncate">{b.industry}</div>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-base-700/60 p-1">
                  <Link
                    href="/brand/new"
                    onClick={() => setSwitcherOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-live hover:bg-live/10 transition-colors"
                  >
                    <Plus size={11} /> Add new client
                  </Link>
                  <Link
                    href="/brand"
                    onClick={() => setSwitcherOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-ink-muted hover:text-ink hover:bg-base-800 transition-colors"
                  >
                    Manage all clients →
                  </Link>
                </div>
              </div>
            ) : null}

            <p className="text-[9px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-2 leading-relaxed">
              every tool below uses this client's brand brain
            </p>
          </>
        ) : (
          <Link
            href="/brand/new"
            className="flex items-center gap-2.5 group p-1.5 rounded-sm border border-live/40 bg-live/[0.04] hover:bg-live/10 transition-colors"
          >
            <div className="shrink-0 h-7 w-7 grid place-items-center bg-base-900 border border-live/40 rounded-sm">
              <Plus size={12} className="text-live" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono uppercase tracking-ui-mega text-live leading-none">no client yet</div>
              <div className="text-[12px] text-ink leading-tight mt-0.5">Add your first client →</div>
            </div>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 sidebar-nav">
        {NAV_GROUPS.map((g) => {
          const isOpen = !!open[g.title];
          const Icon = GROUP_ICONS[g.title];
          // Does any item in this group match the current path? Used to
          // highlight the group header even when collapsed.
          const hasActive = g.items.some(
            (i) => path === i.href || (i.href !== "/" && path?.startsWith(i.href))
          );
          return (
            <div key={g.title}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [g.title]: !s[g.title] }))}
                aria-expanded={isOpen}
                aria-controls={`navgroup-${g.title.replace(/[^a-z0-9]+/gi, "-")}`}
                className={cn(
                  "w-full group flex items-center gap-2 px-2.5 py-2 rounded-sm transition-colors",
                  "text-[11px] font-semibold uppercase tracking-wider",
                  hasActive ? "text-ink" : "text-ink-muted hover:text-ink",
                  "hover:bg-base-900/60"
                )}
              >
                {Icon ? (
                  <Icon
                    size={13}
                    className={cn(
                      "transition-colors shrink-0",
                      hasActive ? "text-live" : "text-ink-faint group-hover:text-ink-muted"
                    )}
                  />
                ) : null}
                <span className="truncate flex-1 text-left">{g.title}</span>
                {!isOpen ? (
                  <span className="text-[9px] font-mono normal-case tracking-normal text-ink-faint tabular">
                    {g.items.length}
                  </span>
                ) : null}
                <ChevronRight
                  size={12}
                  className={cn(
                    "shrink-0 transition-transform duration-200 text-ink-faint",
                    isOpen && "rotate-90"
                  )}
                />
              </button>

              {/* Items — height-animated collapse via max-h + overflow-hidden */}
              <div
                id={`navgroup-${g.title.replace(/[^a-z0-9]+/gi, "-")}`}
                role="region"
                aria-label={g.title}
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                  isOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="mt-0.5 mb-1 space-y-px">
                  {g.items.map((item, itemIdx) => {
                    const active =
                      path === item.href || (item.href !== "/" && path?.startsWith(item.href));
                    const href = item.query ? `${item.href}?${item.query}` : item.href;
                    const linkKey = `${g.title}::${item.href}::${item.query ?? ""}`;
                    return (
                      <Link
                        key={linkKey}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        // Staggered fade-up: each item enters 25ms after the previous one
                        // when the group opens. Hard-cap at 8 items of stagger so groups
                        // with 12+ tools don't have a noticeable tail.
                        style={isOpen ? { animationDelay: `${Math.min(itemIdx, 8) * 25}ms` } : undefined}
                        className={cn(
                          "group relative flex items-center gap-2 pl-7 pr-3 py-1.5 text-[13px] transition-colors",
                          isOpen && "animate-fade-up",
                          active
                            ? "text-ink bg-gradient-to-r from-live/[0.08] to-transparent font-medium"
                            : "text-ink-muted hover:text-ink hover:bg-base-900/40"
                        )}
                      >
                        {/* Left rail accent — orange for active, faint dot for hover */}
                        <span
                          className={cn(
                            "absolute left-3 top-1/2 -translate-y-1/2 transition-all",
                            active
                              ? "w-0.5 h-4 bg-live rounded-full"
                              : "w-1 h-1 bg-base-700 rounded-full group-hover:bg-base-500"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer · privacy badge */}
      <div className="border-t border-base-700/60 px-4 py-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-ui-wide text-ink-muted">
        <Lock size={11} className="text-pos shrink-0" />
        <div className="leading-tight">
          <div className="text-ink">zero backend · zero telemetry</div>
          <div className="text-ink-subtle normal-case tracking-normal">Your key. Your data.</div>
        </div>
      </div>
    </aside>
  );
}
