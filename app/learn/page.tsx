import type { Metadata } from "next";
import Client from "./Client";

// Server wrapper so this public page can export its own title/description;
// the interactive UI lives in ./Client (a "use client" component).
export const metadata: Metadata = {
  title: "Learn Paid Ads — Metrics, Concepts & Frameworks",
  description:
    "Plain-English explainers for every paid-ads concept: CTR, CPC, ROAS, Quality Score, attribution, bidding, creative frameworks and more.",
  alternates: { canonical: "/learn" },
};

export default function Page() {
  return <Client />;
}
