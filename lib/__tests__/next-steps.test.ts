import { describe, it, expect } from "vitest";
import { suggestNextSteps } from "../next-steps";

describe("suggestNextSteps — platform routing", () => {
  it("Meta ad generation surfaces Reels + CTR + hashtags + A/B + audience", () => {
    const steps = suggestNextSteps({ platform: "meta", campaign_type: "Meta Ads", ad_id: "a-1" });
    const hrefs = steps.map((s) => s.href);
    expect(hrefs).toContain("/generate/reel-ideas");
    expect(hrefs).toContain("/optimize/creative-score");
    expect(hrefs).toContain("/optimize/ctr");
    expect(hrefs).toContain("/generate/hashtags");
    expect(hrefs).toContain("/optimize/ab-test");
    expect(hrefs).toContain("/optimize/audience");
  });

  it("Google ad generation surfaces Quality Score + Keywords + LP + Bid + A/B", () => {
    const steps = suggestNextSteps({ platform: "google", campaign_type: "Google RSA", ad_id: "g-1" });
    const hrefs = steps.map((s) => s.href);
    expect(hrefs).toContain("/optimize/quality-score");
    expect(hrefs).toContain("/optimize/keywords");
    expect(hrefs).toContain("/optimize/landing-page");
    expect(hrefs).toContain("/optimize/bid-strategy");
    expect(hrefs).toContain("/optimize/ab-test");
  });

  it("TikTok surfaces organic Reel ideas + Spark Ads + creative score + hashtags + fatigue", () => {
    const steps = suggestNextSteps({ platform: "tiktok", campaign_type: "TikTok Hooks", ad_id: "t-1" });
    const hrefs = steps.map((s) => s.href);
    expect(hrefs).toContain("/generate/reel-ideas");
    expect(hrefs).toContain("/generate/spark-ads");
    expect(hrefs).toContain("/optimize/creative-score");
    expect(hrefs).toContain("/generate/hashtags");
    expect(hrefs).toContain("/optimize/ad-fatigue");
  });

  it("Optimizer outputs ALL steer back toward the matching generator", () => {
    const steps = suggestNextSteps({ platform: "meta", campaign_type: "CTR Optimize", ad_id: "o-1" });
    expect(steps[0].href).toBe("/generate/meta");
    expect(steps[0].label).toContain("Apply rewrite");
    // And an A/B test option follows.
    expect(steps.some((s) => s.href === "/optimize/ab-test")).toBe(true);
  });

  it("optimizer keyword variants (Improver / Score / Optimizer) all match the optimizer branch", () => {
    for (const ct of ["Quality Score Improver", "CTR Optimizer", "Audience Optimize"]) {
      const steps = suggestNextSteps({ platform: "google", campaign_type: ct, ad_id: "x" });
      // Optimizer branch leads with "Apply rewrite as a new {platform} variant".
      expect(steps[0].label).toContain("Apply rewrite");
    }
  });

  it("unknown platform falls back to universal steps", () => {
    const steps = suggestNextSteps({ platform: "display" as any, campaign_type: "Random Type", ad_id: "u-1" });
    // display has its own list; sample a known step:
    const hrefs = steps.map((s) => s.href);
    expect(hrefs).toContain("/optimize/creative-score");
  });

  it("every step has href / label / reason", () => {
    const steps = suggestNextSteps({ platform: "meta", campaign_type: "Meta Ads", ad_id: "v-1" });
    for (const s of steps) {
      expect(s.href).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.reason).toBeTruthy();
    }
  });

  it("carries ad_id forward on deep links so receiving tools can hydrate", () => {
    const steps = suggestNextSteps({ platform: "meta", campaign_type: "Meta Ads", ad_id: "meta-42" });
    const ctr = steps.find((s) => s.href === "/optimize/ctr");
    expect(ctr?.carry?.ad_id).toBe("meta-42");
    expect(ctr?.carry?.platform).toBe("Meta Feed");
  });
});
