"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Sparkles, Brain, Activity, ClipboardList, BookOpen, FileBarChart } from "lucide-react";
import { hasSeenTour, markTourSeen, isOnboarded } from "@/lib/settings";

interface Slide {
  icon: any;
  label: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}

const SLIDES: Slide[] = [
  {
    icon: Brain,
    label: "step 1 of 4",
    title: "Brand Brain anchors everything.",
    body: "Every generation pulls from your active Brand Brain — tone, audience, VOC, USP. Set it once; it's injected into every Claude call.",
    cta: { href: "/brand", label: "open brand brain" },
  },
  {
    icon: Sparkles,
    label: "step 2 of 4",
    title: "13 generators · 7 platforms · 1 brief.",
    body: "Google · Meta · TikTok · YouTube · LinkedIn · X · Display. Plus Campaign Kit (one brief → every platform), hashtags, lead forms, email subjects, and AI image/video prompts.",
    cta: { href: "/generate/campaign-kit", label: "try campaign kit" },
  },
  {
    icon: Activity,
    label: "step 3 of 4",
    title: "10 optimizers + competitor research.",
    body: "CTR, Quality Score, Budget Waste, Bid Strategy, Audience Targeting, Landing Page, A/B Test Planner, Ad Fatigue, Keywords, Budget Planner — and a Steal-and-Beat that tears down competitor ads from Meta/Google libraries.",
    cta: { href: "/research/competitors", label: "see steal & beat" },
  },
  {
    icon: BookOpen,
    label: "step 4 of 4",
    title: "Routines · benchmarks · learning.",
    body: "Daily/weekly/monthly checklists with streak counters. Industry benchmarks to compare your numbers. 3 mini-courses (28 lessons) + Ad Copy School framework trainer.",
    cta: { href: "/checklist/daily", label: "start daily routine" },
  },
];

export function FeatureTour() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOnboarded()) return;
    if (hasSeenTour()) return;
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Escape-to-close + focus management, matching the app's other dialogs.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prevFocusRef.current?.focus?.();
    };
  }, [open]);

  function dismiss() {
    markTourSeen();
    setOpen(false);
  }

  if (!open) return null;

  const slide = SLIDES[idx];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 bg-base-950/80 backdrop-blur grid place-items-center p-4">
      <div ref={dialogRef} tabIndex={-1} className="border border-live/40 bg-base-900 w-full max-w-lg animate-fade-up outline-none">
        <div className="flex items-center justify-between border-b border-base-600 px-5 py-3">
          <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live">{slide.label}</span>
          <button onClick={dismiss} className="text-ink-subtle hover:text-ink" aria-label="Close tour">
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="h-10 w-10 grid place-items-center bg-live/10 border border-live/40 mb-4">
            <Icon size={18} className="text-live" />
          </div>
          <h3 className="font-display italic text-3xl text-ink leading-tight">{slide.title}</h3>
          <p className="text-sm text-ink-muted mt-3 leading-relaxed">{slide.body}</p>
          {slide.cta ? (
            <Link
              href={slide.cta.href}
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-mono uppercase tracking-ui-mega text-live hover:underline"
            >
              {slide.cta.label} →
            </Link>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-base-600 px-5 py-3">
          <div className="flex gap-1">
            {SLIDES.map((_, i) => (
              <span key={i} className={`h-1 w-7 ${i <= idx ? "bg-live" : "bg-base-600"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={dismiss} className="btn-ghost">skip</button>
            {idx < SLIDES.length - 1 ? (
              <button onClick={() => setIdx(idx + 1)} className="btn-primary">next →</button>
            ) : (
              <button onClick={dismiss} className="btn-primary">done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
