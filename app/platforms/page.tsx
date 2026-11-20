import type { Metadata } from "next";
import Client from "./Client";

// Server wrapper so this public page can export its own title/description;
// the interactive UI lives in ./Client (a "use client" component).
export const metadata: Metadata = {
  title: "Pick an Ad Platform — Google, Meta, TikTok, YouTube, LinkedIn, X",
  description:
    "Formats, specs, audiences, best practices and common mistakes for every major ad platform, with the matching OpenAdKit generators.",
  alternates: { canonical: "/platforms" },
};

export default function Page() {
  return <Client />;
}
