import type { Metadata } from "next";
import Client from "./Client";

// Server wrapper so this public page can export its own title/description;
// the interactive UI lives in ./Client (a "use client" component).
export const metadata: Metadata = {
  title: "Ad Platform Decision Tree — Which Channel Should You Run?",
  description:
    "Answer a few questions about your goal, budget, product and timeline and get a recommended ad platform, campaign format and what to avoid.",
  alternates: { canonical: "/strategy/decision-tree" },
};

export default function Page() {
  return <Client />;
}
