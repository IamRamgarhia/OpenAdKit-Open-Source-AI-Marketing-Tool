"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CONCEPTS, CATEGORY_LABEL, type ConceptDef } from "@/lib/learn-content";

export default function Client() {
  return <Inner />;
}

function Inner() {
  const [filter, setFilter] = useState<ConceptDef["category"] | "all">("all");
  const filtered = filter === "all" ? CONCEPTS : CONCEPTS.filter((c) => c.category === filter);

  return (
    <div>
      <PageHeader
        scope="learn"
        title="Concept library"
        subtitle="Plain-English explanations, with your money's stake spelled out. Click any to ask Claude for the deep dive."
      />

      <div className="flex flex-wrap gap-1.5 mb-6">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>all</Chip>
        {(Object.keys(CATEGORY_LABEL) as ConceptDef["category"][]).map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {CATEGORY_LABEL[c].toLowerCase()}
          </Chip>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3 stagger">
        {filtered.map((c) => (
          <Link
            key={c.slug}
            href={`/learn/${c.slug}`}
            className="border border-base-600 bg-base-900/40 p-4 hover:bg-base-800/60 hover:border-base-500 transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint">
                {CATEGORY_LABEL[c.category]}
              </span>
              <span className="text-[10px] font-mono text-ink-faint group-hover:text-live transition">→</span>
            </div>
            <h3 className="font-display italic text-lg text-ink leading-tight">{c.name}</h3>
            <p className="text-xs text-ink-muted mt-2 leading-relaxed">{c.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-ui-mega ${
        active ? "border-live text-live bg-live/5" : "border-base-600 text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
