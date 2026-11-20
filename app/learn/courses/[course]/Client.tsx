"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { findCourse } from "@/lib/courses";

export default function CourseClient({ course: slug }: { course: string }) {
  return <Inner courseSlug={slug} />;
}

function Inner({ courseSlug }: { courseSlug: string }) {
  const course = findCourse(courseSlug);
  if (!course) {
    return (
      <div>
        <PageHeader scope="learn/courses/not-found" title="Course not found" />
        <Link href="/learn/courses" className="btn-ghost">← back</Link>
      </div>
    );
  }
  return (
    <div>
      <PageHeader scope={`learn/courses/${course.slug}`} title={course.name} subtitle={course.blurb} />

      <ol className="space-y-2 stagger">
        {course.lessons.map((l, i) => (
          <li key={l.slug}>
            <Link
              href={`/learn/courses/${course.slug}/${l.slug}`}
              className="flex items-center gap-3 border border-base-600 bg-base-900/40 p-4 hover:bg-base-800/60 hover:border-base-500 transition group"
            >
              <span className="font-mono text-[10px] uppercase tracking-ui-mega text-ink-faint w-6 tabular">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display italic text-lg text-ink leading-tight">{l.title}</div>
                <p className="text-[11px] text-ink-muted mt-1.5">{l.takeaway}</p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-ui-mega text-live shrink-0">
                {l.read_minutes} min
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-8 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
        ← <Link href="/learn/courses" className="text-live hover:underline">all courses</Link>
      </div>
    </div>
  );
}
