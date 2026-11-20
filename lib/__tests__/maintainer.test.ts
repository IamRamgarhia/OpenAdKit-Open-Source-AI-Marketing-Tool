import { describe, it, expect } from "vitest";
import { MAINTAINER, upiDeepLink, upiNote, enquiryMailto, whatsappShareUrl } from "@/lib/maintainer";
import { REPO_URL, REPO_SLUG } from "@/lib/repo";

describe("maintainer support links", () => {
  it("builds a UPI deep link every UPI app understands", () => {
    const url = new URL(upiDeepLink({ amount: 250, note: "OpenAdKit support" }));
    expect(url.protocol).toBe("upi:");
    expect(url.searchParams.get("pa")).toBe(MAINTAINER.upi);
    expect(url.searchParams.get("pn")).toBe("DiceCodes");
    expect(url.searchParams.get("cu")).toBe("INR");
    expect(url.searchParams.get("am")).toBe("250");
    expect(url.searchParams.get("tn")).toBe("OpenAdKit support");
    expect(upiDeepLink({ note: "OpenAdKit support" })).toContain("tn=OpenAdKit%20support");
    expect(upiDeepLink({ note: "OpenAdKit support" })).not.toContain("+");
  });

  it("omits the amount for 'any amount' so the payer chooses", () => {
    const url = new URL(upiDeepLink({ amount: null }));
    expect(url.searchParams.has("am")).toBe(false);
  });

  it("keeps the bank-statement note identifiable, sanitised and short", () => {
    expect(upiNote()).toBe("OpenAdKit support");
    expect(upiNote("  Asha   Traders <script> ")).toBe("OpenAdKit support - Asha Traders script");
    expect(upiNote("x".repeat(200)).length).toBeLessThanOrEqual(50);
  });

  it("points every link at the canonical repo and contact address", () => {
    expect(REPO_URL).toBe(`https://github.com/${REPO_SLUG}`);
    expect(REPO_SLUG).toBe("IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool");
    expect(enquiryMailto()).toMatch(/^mailto:contact@dicecodes\.com\?subject=/);
    expect(decodeURIComponent(whatsappShareUrl())).toContain(REPO_URL);
  });
});
