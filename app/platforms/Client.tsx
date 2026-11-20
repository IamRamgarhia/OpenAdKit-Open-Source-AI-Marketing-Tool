"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PLATFORM_LIST } from "@/lib/platform-hubs";

export default function Client() {
  return <Inner />;
}

function Inner() {
  return (
    <div>
      <PageHeader
        scope="platforms"
        title="Pick your platform"
        subtitle="One click → everything for that ad platform in one place: formats, generators, launch guide, best practices."
      />
      <div className="grid md:grid-cols-2 gap-3 stagger">
        {PLATFORM_LIST.map((p) => (
          <Link
            key={p.slug}
            href={`/platforms/${p.slug}`}
            className="border border-base-600 bg-base-900/40 hover:bg-base-800/60 hover:border-base-500 p-5 transition group flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live">{p.formats.length} formats</span>
              <span className="text-[10px] font-mono text-ink-faint group-hover:text-live transition">↗</span>
            </div>
            <h3 className="font-display italic text-2xl text-ink leading-tight">{p.name}</h3>
            <p className="text-xs text-ink-muted leading-relaxed italic">{p.tagline}</p>
            <div className="mt-auto pt-3 border-t border-base-700 text-[11px] text-ink-muted">
              <span className="text-pos">Best for:</span> {p.best_for}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
