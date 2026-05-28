import type { MetadataRoute } from "next";
import { PLATFORM_HUBS } from "@/lib/platform-hubs";
import { CONCEPTS } from "@/lib/learn-content";
import { COURSES } from "@/lib/courses";

const BASE = "https://openadkit.dicecodes.com";

// Use the latest git commit timestamp (resolved at build time via
// NEXT_PUBLIC_BUILD_ID-style env vars on Vercel) or a hardcoded baseline.
// Mixing per-page lastModified would require tracking edits per content
// file; for the current static evergreen pages, a single build-time stamp
// is more honest than `new Date()` (which always says "modified just now"
// and defeats the freshness signal search engines use to schedule recrawls).
const STATIC_CONTENT_REVISION = "2026-05-28";

// Surface only the public, evergreen routes to search engines. Gated app
// routes (generators, optimizers, settings) sit behind ApiKeyGate and produce
// near-empty pages for crawlers. (Audit finding #50.)
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = STATIC_CONTENT_REVISION;
  const fixed: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/alternatives`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/how-to-use`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/benchmarks`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/platforms`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/courses`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/frameworks`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/launch-guide`, lastModified, changeFrequency: "monthly", priority: 0.7 },
  ];
  const platformPages: MetadataRoute.Sitemap = Object.keys(PLATFORM_HUBS).map((slug) => ({
    url: `${BASE}/platforms/${slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const conceptPages: MetadataRoute.Sitemap = CONCEPTS.map((c) => ({
    url: `${BASE}/learn/${c.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  const coursePages: MetadataRoute.Sitemap = COURSES.flatMap((c) => [
    { url: `${BASE}/learn/courses/${c.slug}`, lastModified, changeFrequency: "monthly" as const, priority: 0.5 },
    ...c.lessons.map((l) => ({
      url: `${BASE}/learn/courses/${c.slug}/${l.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ]);
  return [...fixed, ...platformPages, ...conceptPages, ...coursePages];
}
