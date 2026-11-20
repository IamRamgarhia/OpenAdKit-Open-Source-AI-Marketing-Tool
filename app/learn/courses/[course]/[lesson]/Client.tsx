"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Markdown } from "@/components/Markdown";
import { findLesson } from "@/lib/courses";

export default function LessonClient({ course, lesson }: { course: string; lesson: string }) {
  return <Inner courseSlug={course} lessonSlug={lesson} />;
}

function Inner({ courseSlug, lessonSlug }: { courseSlug: string; lessonSlug: string }) {
  const found = findLesson(courseSlug, lessonSlug);
  if (!found) {
    return (
      <div>
        <PageHeader scope="learn/lesson/not-found" title="Lesson not found" />
        <Link href="/learn/courses" className="btn-ghost">← back</Link>
      </div>
    );
  }

  const { course, lesson } = found;
  const lessonIdx = course.lessons.findIndex((l) => l.slug === lesson.slug);
  const prev = course.lessons[lessonIdx - 1];
  const next = course.lessons[lessonIdx + 1];

  return (
    <div>
      <PageHeader
        scope={`learn/courses/${course.slug}/${lesson.slug}`}
        title={lesson.title}
        subtitle={lesson.takeaway}
      />

      <div className="mb-4 flex items-center gap-3">
        <Link href={`/learn/courses/${course.slug}`} className="btn-ghost">
          <ArrowLeft size={11} /> {course.name}
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
          lesson {lessonIdx + 1} / {course.lessons.length} · {lesson.read_minutes} min
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <article className="lg:col-span-2 border border-base-600 bg-base-900/40 p-6">
          <Markdown text={lesson.body_md} />
        </article>

        <aside className="space-y-3">
          <div className="border border-live/40 bg-live/5 p-4">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2 flex items-center gap-1.5">
              <Sparkles size={11} /> quick action
            </div>
            <p className="text-sm text-ink leading-relaxed">{lesson.quick_action}</p>
          </div>

          <div className="border border-base-600 bg-base-900/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted mb-2 flex items-center gap-1.5">
              <BookOpen size={11} /> practice with OpenAdKit
            </div>
            <p className="text-sm text-ink-muted leading-relaxed">{lesson.ai_practice_prompt}</p>
          </div>

          <div className="border border-base-600 bg-base-900/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint mb-2">lessons</div>
            <ol className="space-y-1 text-xs">
              {course.lessons.map((l, i) => (
                <li key={l.slug}>
                  <Link
                    href={`/learn/courses/${course.slug}/${l.slug}`}
                    className={`flex gap-2 px-2 py-1.5 transition ${
                      l.slug === lesson.slug ? "bg-base-800/60 text-ink border-l-2 border-live" : "text-ink-muted hover:text-ink border-l-2 border-transparent"
                    }`}
                  >
                    <span className="font-mono tabular w-5 text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 truncate">{l.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <div className="mt-8 flex items-center justify-between">
        {prev ? (
          <Link href={`/learn/courses/${course.slug}/${prev.slug}`} className="btn-ghost">
            <ArrowLeft size={11} /> {prev.title.slice(0, 32)}…
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/learn/courses/${course.slug}/${next.slug}`} className="btn-primary">
            next: {next.title.slice(0, 32)}… →
          </Link>
        ) : (
          <Link href={`/learn/courses/${course.slug}`} className="btn-primary">
            finish course →
          </Link>
        )}
      </div>
    </div>
  );
}
