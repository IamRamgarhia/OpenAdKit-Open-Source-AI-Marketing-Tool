import type { Metadata } from "next";
import Client from "./Client";

export const metadata: Metadata = {
  title: "Which AI Should I Use? — Claude vs GPT vs Gemini vs Groq for Ads",
  description:
    "Published prices, free-tier limits, vision support and context windows for every AI provider OpenAdKit supports, plus what your own runs actually cost.",
  alternates: { canonical: "/providers" },
};

export default function Page() {
  return <Client />;
}
