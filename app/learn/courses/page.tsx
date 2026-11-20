import type { Metadata } from "next";
import Client from "./Client";

// Server wrapper so this public page can export its own title/description;
// the interactive UI lives in ./Client (a "use client" component).
export const metadata: Metadata = {
  title: "Free Paid-Ads Courses — Google, Meta & TikTok Beginner Tracks",
  description:
    "Free beginner courses for Google Ads, Meta Ads and TikTok Ads: from auction mechanics to your first optimization routine.",
  alternates: { canonical: "/learn/courses" },
};

export default function Page() {
  return <Client />;
}
