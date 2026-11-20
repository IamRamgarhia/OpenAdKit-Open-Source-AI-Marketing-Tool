import type { Metadata } from "next";
import { SupportClient } from "./SupportClient";

export const metadata: Metadata = {
  title: "Support OpenAdKit · DiceCodes",
  description:
    "OpenAdKit is free and open source. Support it by UPI or PayPal, star it on GitHub, report a bug, or hire DiceCodes to build custom software.",
};

export default function SupportPage() {
  return <SupportClient />;
}
