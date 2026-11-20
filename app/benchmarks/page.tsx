import type { Metadata } from "next";
import Client from "./Client";

// Server wrapper so this public page can export its own title/description;
// the interactive UI lives in ./Client (a "use client" component).
export const metadata: Metadata = {
  title: "Ad Benchmarks — CTR, CPC, CVR, ROAS by Platform & Industry",
  description:
    "Directional industry ranges for CTR, CPC, conversion rate and ROAS across Google, Meta, TikTok, LinkedIn and more. Compare your own numbers against them.",
  alternates: { canonical: "/benchmarks" },
};

export default function Page() {
  return <Client />;
}
