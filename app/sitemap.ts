import type { MetadataRoute } from "next";
import { PLATFORM_HUBS } from "@/lib/platform-hubs";
import { CONCEPTS } from "@/lib/learn-content";
import { COURSES } from "@/lib/courses";

const BASE = "https://adforge.dicecodes.com";

// Surface only the public, evergreen routes to search engines. Gated app
// routes (generators, optimizers, settings) sit behind ApiKeyGate and produce
// near-empty pages for crawlers. (Audit finding #50.)
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
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
