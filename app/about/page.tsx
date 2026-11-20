import type { Metadata } from "next";
import Client from "./Client";

export const metadata: Metadata = {
  title: "About OpenAdKit & DiceCodes",
  description:
    "OpenAdKit is a free, MIT-licensed, browser-only AI marketing tool built by DiceCodes. Learn who builds it and how to get in touch.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <Client />;
}
