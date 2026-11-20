import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  suggestNextSteps,
  normalizeRoute,
  generatorForPlatformLabel,
  platformForHashtagInput,
  platformForReelInput,
} from "../next-steps";

const APP_DIR = path.resolve(__dirname, "..", "..", "app");
const TOOL_ROUTES = ["generate", "optimize"].flatMap((top) =>
  fs
    .readdirSync(path.join(APP_DIR, top), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(APP_DIR, top, d.name, "page.tsx")))
    .map((d) => `${top}/${d.name}`)
);

const hrefs = (route: string, input?: Record<string, unknown>) =>
  suggestNextSteps({ route, ad_id: "a-1", input }).map((s) => s.href);

describe("suggestNextSteps — keyed by route", () => {
  it("Meta ad generation surfaces score + CTR + reels + hashtags + A/B + audience", () => {
    const h = hrefs("/generate/meta");
    for (const r of ["/optimize/creative-score", "/optimize/ctr", "/generate/reel-ideas", "/generate/hashtags", "/optimize/ab-test", "/optimize/audience"]) {
      expect(h).toContain(r);
    }
  });

  it("Google RSA surfaces QS + keywords + LP + bid + A/B, with a valid bid platform", () => {
    const steps = suggestNextSteps({ route: "generate/google", ad_id: "g" });
    const bid = steps.find((s) => s.href === "/optimize/bid-strategy");
    expect(bid?.carry?.platform).toBe("Google Ads");
    for (const r of ["/optimize/quality-score", "/optimize/keywords", "/optimize/landing-page", "/optimize/ab-test"]) {
      expect(steps.map((s) => s.href)).toContain(r);
    }
  });

  it("never links a tool to itself (regression: keyword plan, LP grade, bid, A/B, hashtags)", () => {
    for (const route of TOOL_ROUTES) {
      for (const s of suggestNextSteps({ route, ad_id: "x", input: { platform: "instagram" } })) {
        expect(normalizeRoute(s.href), `${route} links to itself`).not.toBe(route);
      }
    }
  });

  it("Keyword Plan does not suggest the Keyword Builder; LP grade does not suggest the LP grader", () => {
    expect(hrefs("optimize/keywords")).not.toContain("/optimize/keywords");
    expect(hrefs("optimize/landing-page")).not.toContain("/optimize/landing-page");
    expect(hrefs("optimize/bid-strategy")).not.toContain("/optimize/bid-strategy");
    expect(hrefs("optimize/ab-test")).not.toContain("/optimize/ab-test");
    expect(hrefs("generate/hashtags", { platform: "tiktok" })).not.toContain("/generate/hashtags");
  });

  it("QS Improver gets QS-specific steps, not a generic /improve/ rewrite to Meta", () => {
    const steps = suggestNextSteps({ route: "optimize/quality-score", ad_id: "q" });
    expect(steps[0].href).toBe("/generate/google");
    expect(steps.map((s) => s.href)).not.toContain("/generate/meta");
  });

  it("Apply rewrite targets the generator for the optimizer's platform and carries ad_id", () => {
    const ctr = suggestNextSteps({ route: "optimize/ctr", ad_id: "o-1", input: { platform: "LinkedIn Sponsored" } });
    expect(ctr[0].label).toContain("Apply rewrite");
    expect(ctr[0].href).toBe("/generate/linkedin");
    expect(ctr[0].carry?.ad_id).toBe("o-1");
    const cs = suggestNextSteps({ route: "optimize/creative-score", ad_id: "o-2", input: { platform: "Google Display" } });
    expect(cs[0].href).toBe("/generate/display");
  });

  it("email subjects are not routed into Google-only tools", () => {
    const h = hrefs("generate/email-subjects");
    expect(h).not.toContain("/optimize/quality-score");
    expect(h).not.toContain("/optimize/keywords");
    expect(h).not.toContain("/optimize/bid-strategy");
  });

  it("reel ideas follow the selected platform, not a hard-coded one", () => {
    const tt = suggestNextSteps({ route: "generate/reel-ideas", ad_id: "r", input: { platform: "tiktok" } });
    expect(tt.find((s) => s.href === "/generate/hashtags")?.carry?.platform).toBe("tiktok");
    const yt = suggestNextSteps({ route: "generate/reel-ideas", ad_id: "r", input: { platform: "youtube_shorts" } });
    expect(yt.find((s) => s.href === "/generate/hashtags")?.carry?.platform).toBe("youtube");
  });

  it("every list ends with a working 'Add to a campaign' step that carries the ad", () => {
    for (const route of [...TOOL_ROUTES, "launch-guide", "unknown"]) {
      const steps = suggestNextSteps({ route, ad_id: "z-9" });
      const last = steps[steps.length - 1];
      expect(last.href).toBe("/campaigns");
      expect(last.carry?.add).toBe("z-9");
    }
  });

  it("every step has href / label / reason", () => {
    for (const route of TOOL_ROUTES) {
      for (const s of suggestNextSteps({ route, ad_id: "v" })) {
        expect(s.href).toMatch(/^\//);
        expect(s.label).toBeTruthy();
        expect(s.reason).toBeTruthy();
      }
    }
  });

  it("accepts leading slash / trailing slash / query in the route", () => {
    expect(normalizeRoute("/generate/meta/?x=1")).toBe("generate/meta");
  });
});

describe("platform helpers", () => {
  it("generatorForPlatformLabel", () => {
    expect(generatorForPlatformLabel("Google Search")).toBe("/generate/google");
    expect(generatorForPlatformLabel("Google Display")).toBe("/generate/display");
    expect(generatorForPlatformLabel("Meta Reels")).toBe("/generate/meta");
    expect(generatorForPlatformLabel("TikTok In-Feed")).toBe("/generate/tiktok");
    expect(generatorForPlatformLabel("Twitter/X")).toBe("/generate/twitter");
    expect(generatorForPlatformLabel("YouTube In-Stream")).toBe("/generate/youtube");
    expect(generatorForPlatformLabel("", "")).toBe("");
  });

  it("hashtag + reel inputs map to a stored platform", () => {
    expect(platformForHashtagInput("tiktok")).toBe("tiktok");
    expect(platformForHashtagInput("instagram")).toBe("meta");
    expect(platformForHashtagInput("linkedin")).toBe("linkedin");
    expect(platformForReelInput("tiktok")).toBe("tiktok");
    expect(platformForReelInput("youtube_shorts")).toBe("youtube");
    expect(platformForReelInput("instagram_reels")).toBe("meta");
  });
});
