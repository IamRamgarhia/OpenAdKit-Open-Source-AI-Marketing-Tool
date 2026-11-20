import type { Metadata } from "next";
import { COURSES, findLesson } from "@/lib/courses";
import LessonClient from "./Client";

export function generateStaticParams() {
  const out: Array<{ course: string; lesson: string }> = [];
  for (const c of COURSES) {
    for (const l of c.lessons) {
      out.push({ course: c.slug, lesson: l.slug });
    }
  }
  return out;
}

export const dynamicParams = false;

type Params = Promise<{ course: string; lesson: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { course, lesson } = await params;
  const found = findLesson(course, lesson);
  if (!found) return {};
  return {
    title: `${found.lesson.title} — ${found.course.name}`,
    description: found.lesson.takeaway,
    alternates: { canonical: `/learn/courses/${found.course.slug}/${found.lesson.slug}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { course, lesson } = await params;
  return <LessonClient course={course} lesson={lesson} />;
}
