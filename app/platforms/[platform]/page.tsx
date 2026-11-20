import type { Metadata } from "next";
import { PLATFORM_HUBS } from "@/lib/platform-hubs";
import PlatformClient from "./Client";

// Pre-render every known platform slug so direct navigation works under
// static export and Vercel's edge runtime. (Audit finding #18.)
export function generateStaticParams() {
  return Object.keys(PLATFORM_HUBS).map((platform) => ({ platform }));
}

export const dynamicParams = false;

type Params = Promise<{ platform: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { platform } = await params;
  const hub = PLATFORM_HUBS[platform];
  if (!hub) return {};
  return {
    title: `${hub.name} Ads — Formats, Specs & Best Practices`,
    description: `${hub.tagline} ${hub.intro}`.slice(0, 300),
    alternates: { canonical: `/platforms/${hub.slug}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { platform } = await params;
  return <PlatformClient platform={platform} />;
}
