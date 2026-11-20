import type { Metadata } from "next";
import { COURSES, findCourse } from "@/lib/courses";
import CourseClient from "./Client";

export function generateStaticParams() {
  return COURSES.map((c) => ({ course: c.slug }));
}

export const dynamicParams = false;

type Params = Promise<{ course: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { course } = await params;
  const c = findCourse(course);
  if (!c) return {};
  return {
    title: `${c.name} — Free Course`,
    description: c.blurb,
    alternates: { canonical: `/learn/courses/${c.slug}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { course } = await params;
  return <CourseClient course={course} />;
}
