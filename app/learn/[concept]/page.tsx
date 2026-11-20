import type { Metadata } from "next";
import { CONCEPTS } from "@/lib/learn-content";
import ConceptClient from "./Client";

export function generateStaticParams() {
  return CONCEPTS.map((c) => ({ concept: c.slug }));
}

export const dynamicParams = false;

type Params = Promise<{ concept: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { concept } = await params;
  const def = CONCEPTS.find((c) => c.slug === concept);
  if (!def) return {};
  return {
    title: `${def.name} — Explained for Paid Ads`,
    description: def.blurb,
    alternates: { canonical: `/learn/${def.slug}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { concept } = await params;
  return <ConceptClient concept={concept} />;
}
