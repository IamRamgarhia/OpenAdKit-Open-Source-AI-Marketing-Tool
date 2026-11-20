import type { Metadata } from "next";
import Client from "./Client";

export const metadata: Metadata = {
  title: "About OpenAdKit & Dicecodes",
  description:
    "OpenAdKit is a free, MIT-licensed, browser-only AI marketing tool built by Dicecodes. Learn who builds it and how to get in touch.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <Client />;
}
