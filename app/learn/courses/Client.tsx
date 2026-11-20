"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { COURSES } from "@/lib/courses";

export default function Client() {
  return <Inner />;
}

function Inner() {
  return (
    <div>
      <PageHeader
        scope="learn/courses"
        title="Mini-courses"
        subtitle="Pre-written tracks. Lessons designed to be read in ~5 minutes each. End each one with a real action."
      />

      <div className="grid md:grid-cols-3 gap-3 stagger">
        {COURSES.map((c) => (
          <Link
            key={c.slug}
            href={`/learn/courses/${c.slug}`}
            className="border border-base-600 bg-base-900/40 p-5 hover:bg-base-800/60 hover:border-base-500 transition group flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live">
                {c.lessons.length} lessons
              </span>
              <span className="text-[10px] font-mono text-ink-faint group-hover:text-live transition">↗</span>
            </div>
            <h3 className="font-display italic text-2xl text-ink leading-tight">{c.name}</h3>
            <p className="text-xs text-ink-muted leading-relaxed">{c.blurb}</p>
            <div className="mt-auto text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
              total read · ~{c.lessons.reduce((s, l) => s + l.read_minutes, 0)} min
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
        ← <Link href="/learn" className="text-live hover:underline">back to concept library</Link>
      </div>
    </div>
  );
}
