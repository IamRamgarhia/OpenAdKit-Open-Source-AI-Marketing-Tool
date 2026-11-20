/**
 * Platform character limits on generated output (lib/tools/limits.ts). The
 * schemas only check shape; these rules catch copy the ad platform would
 * reject. Fixtures are shaped like real model replies to each prompt template.
 */
import { describe, it, expect } from "vitest";
import { limitViolations, limitedFieldCount, xWeightedLength } from "../tools/limits";

const paths = (tool: string, data: unknown) => limitViolations(tool, data).map((v) => v.path);
const s = (n: number, ch = "a") => ch.repeat(n);

describe("display ads", () => {
  const creative = (size: string, h: string, d: string, cta = "Book scan") => ({
    size,
    name: size,
    short_headline: h,
    description: d,
    cta_button: cta,
    image_concept: "Smiling patient holding clear aligner, plenty of negative space for text, no stock smiles at all",
  });

  it("applies each size's own headline / description limit", () => {
    const data = {
      creatives: [
        creative("728×90", s(30), s(50)), // at the limit: ok
        creative("320×50", s(23), s(28)), // mobile banner headline cap is 22
        creative("160×600", s(25), s(81)), // skyscraper description cap is 80
      ],
    };
    expect(paths("generate_display_ads", data)).toEqual(["creatives[1].short_headline", "creatives[2].description"]);
  });

  it("caps the CTA button at 12 characters", () => {
    const data = { creatives: [creative("300×250", "Straighter teeth", "No metal braces", "Book a free scan")] };
    expect(paths("generate_display_ads", data)).toEqual(["creatives[0].cta_button"]);
  });

  it("checks responsive display assets", () => {
    const data = {
      creatives: [creative("300×250", "ok", "ok")],
      responsive_display_assets: {
        short_headlines: ["Straighter Teeth, No Metal", s(31)],
        long_headline: s(91),
        descriptions: [s(90), s(95)],
        business_name: "Sunrise Dental Clinic",
        image_prompts: [s(300)],
      },
    };
    expect(paths("generate_display_ads", data)).toEqual([
      "responsive_display_assets.short_headlines[1]",
      "responsive_display_assets.long_headline",
      "responsive_display_assets.descriptions[1]",
    ]);
  });
});

describe("X / Twitter", () => {
  it("counts every link as 23 characters (t.co)", () => {
    const url = "https://ledgerly.example/demo?utm_source=x&utm_campaign=ap-automation-launch";
    expect(xWeightedLength(`Read invoices from email. ${url}`)).toBe("Read invoices from email. ".length + 23);
  });

  it("flags tweets and thread posts over 280 weighted chars", () => {
    const longUrl = `https://ledgerly.example/${s(200, "x")}`;
    const data = {
      tweets: [
        { label: "A", angle: "pain", text: `${s(250)} ${longUrl}`, chars: 274, status: "ok", trimmed_alt: null }, // 251 + 23: fine
        { label: "B", angle: "pain", text: s(281), chars: 281, status: "over", trimmed_alt: null },
        { label: "C", angle: "pain", text: s(300), chars: 300, status: "over", trimmed_alt: s(200) }, // fitting alt
      ],
      website_card_title: s(71),
    };
    expect(paths("generate_x_twitter_ads", data)).toEqual(["tweets[1].text", "website_card_title"]);
    expect(paths("generate_x_twitter_ads", { thread: [{ position: 1, role: "hook", text: s(281), chars: 281 }] })).toEqual(["thread[0].text"]);
  });
});

describe("TikTok", () => {
  it("caps UGC captions at 100 unless a fitting caption_trimmed_alt exists", () => {
    const data = {
      scripts: [
        { title: "t", caption: s(101), caption_trimmed_alt: s(90), hashtags: [], b_roll: [] },
        { title: "t", caption: s(120), caption_trimmed_alt: null, hashtags: [], b_roll: [] },
      ],
    };
    expect(paths("generate_tiktok_ads", data)).toEqual(["scripts[1].caption"]);
  });
  it("caps Spark Ads caption variants at 100", () => {
    const data = { adaptation_copy: { caption_variants: ["Leaves unfurling, harvest date on the pack.", s(101)], on_screen_text_variants: [s(150)] } };
    expect(paths("generate_tiktok_spark_ads", data)).toEqual(["adaptation_copy.caption_variants[1]"]);
  });
  it("checks the Discover page copy of a hashtag challenge", () => {
    const data = { discover_page: { challenge_name: s(25), description: s(81), featured_creator_brief: s(400) } };
    expect(paths("generate_tiktok_hashtag_challenge", data)).toEqual(["discover_page.challenge_name", "discover_page.description"]);
  });
});

describe("Google Shopping", () => {
  it("caps the title at 150 and highlights at 60", () => {
    const data = {
      title: { text: s(151), chars: 151, status: "over" },
      description: { text: s(1200), chars: 1200, status: "ok" },
      highlights: ["First flush 2026 harvest", s(61)],
    };
    expect(paths("generate_google_shopping_feed", data)).toEqual(["title.text", "highlights[1]"]);
  });
});

describe("campaign kit", () => {
  it("checks RSA headlines / descriptions, Meta headlines and tweets", () => {
    const data = {
      master_hook: "Whiter teeth, with the price in writing first",
      google_rsa: { headlines: ["Teeth Whitening in Pune", s(31)], descriptions: [s(91)] },
      meta_feed: { primary_text: [s(400)], headlines: [s(41)], cta: "Book now" },
      twitter: [s(281)],
    };
    expect(paths("generate_campaign_kit", data)).toEqual([
      "google_rsa.headlines[1]",
      "google_rsa.descriptions[0]",
      "meta_feed.headlines[0]",
      "twitter[0]",
    ]);
  });
});

describe("quality score + youtube", () => {
  it("caps improved RSA headlines at 30", () => {
    const data = { improved_headlines: [{ text: "Teeth Whitening Pune", chars: 20 }, { text: s(31), chars: 31 }] };
    expect(paths("optimize_quality_score", data)).toEqual(["improved_headlines[1].text"]);
    expect(limitedFieldCount("optimize_quality_score", data)).toBe(2);
  });
  it("caps YouTube discovery headlines at 100", () => {
    expect(paths("generate_youtube_ads", { headlines: [s(100), s(101)], descriptions: [] })).toEqual(["headlines[1]"]);
  });
});
