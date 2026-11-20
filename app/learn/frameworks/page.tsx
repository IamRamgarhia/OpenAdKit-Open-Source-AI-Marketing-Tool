import type { Metadata } from "next";
import Client from "./Client";

// Server wrapper so this public page can export its own title/description;
// the interactive UI lives in ./Client (a "use client" component).
export const metadata: Metadata = {
  title: "Ad Copy School — AIDA, PAS, BAB & More Copywriting Frameworks",
  description:
    "Interactive trainer for the copywriting frameworks behind high-performing ads: AIDA, PAS, Before-After-Bridge, 4U and more, with examples.",
  alternates: { canonical: "/learn/frameworks" },
};

export default function Page() {
  return <Client />;
}
