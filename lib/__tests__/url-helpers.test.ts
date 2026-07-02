/**
 * Tests for the server-side URL ingest helpers. Most critical: the SSRF guard
 * (blocking these is the difference between a useful /api/ingest route and a
 * cloud-credential leak via AWS IMDS). Also covers metadata extraction edge
 * cases that have bitten brand extraction in the past (unquoted attrs, OG
 * tags in different attribute orders, JSON-LD with whitespace).
 */
import { describe, it, expect } from "vitest";
import {
  isPrivateOrLoopbackHost,
  extractMetadata,
  stripHtml,
} from "@/lib/server/url-helpers";

describe("isPrivateOrLoopbackHost — SSRF guard", () => {
  it("blocks localhost variants", () => {
    expect(isPrivateOrLoopbackHost("localhost")).toBe(true);
    expect(isPrivateOrLoopbackHost("LOCALHOST")).toBe(true);
    expect(isPrivateOrLoopbackHost("ip6-localhost")).toBe(true);
    expect(isPrivateOrLoopbackHost("ip6-loopback")).toBe(true);
  });

  it("blocks IPv4 loopback (127.0.0.0/8)", () => {
    expect(isPrivateOrLoopbackHost("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("127.255.255.255")).toBe(true);
    expect(isPrivateOrLoopbackHost("127.1.2.3")).toBe(true);
  });

  it("blocks RFC1918 private ranges", () => {
    expect(isPrivateOrLoopbackHost("10.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("10.255.255.255")).toBe(true);
    expect(isPrivateOrLoopbackHost("192.168.1.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("172.16.0.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("172.31.255.255")).toBe(true);
  });

  it("does NOT block public IPs that happen to start with 17", () => {
    // 172.15.x and 172.32.x are public — boundary case for RFC1918.
    expect(isPrivateOrLoopbackHost("172.15.0.1")).toBe(false);
    expect(isPrivateOrLoopbackHost("172.32.0.1")).toBe(false);
  });

  it("blocks link-local 169.254.0.0/16 (AWS IMDS lives here)", () => {
    // 169.254.169.254 is the AWS Instance Metadata Service endpoint.
    // A successful fetch returns IAM credentials. This must be blocked.
    expect(isPrivateOrLoopbackHost("169.254.169.254")).toBe(true);
    expect(isPrivateOrLoopbackHost("169.254.1.2")).toBe(true);
  });

  it("blocks the 0.0.0.0/8 'this network' range", () => {
    expect(isPrivateOrLoopbackHost("0.0.0.0")).toBe(true);
    expect(isPrivateOrLoopbackHost("0.1.2.3")).toBe(true);
  });

  it("blocks IPv6 loopback + link-local + ULA", () => {
    expect(isPrivateOrLoopbackHost("::1")).toBe(true);
    expect(isPrivateOrLoopbackHost("::")).toBe(true);
    expect(isPrivateOrLoopbackHost("fe80::1")).toBe(true);
    expect(isPrivateOrLoopbackHost("fe90::1")).toBe(true);
    expect(isPrivateOrLoopbackHost("fc00::1")).toBe(true);
    expect(isPrivateOrLoopbackHost("fd00::1")).toBe(true);
  });

  it("blocks bracketed IPv6 literals (the REAL URL.hostname production inputs)", () => {
    // new URL("http://[::1]/").hostname === "[::1]" — WITH brackets. The bare
    // "::1" cases above never occur in production; these are what route.ts sees.
    expect(isPrivateOrLoopbackHost("[::1]")).toBe(true);
    expect(isPrivateOrLoopbackHost("[::]")).toBe(true);
    expect(isPrivateOrLoopbackHost("[fe80::1]")).toBe(true);
    expect(isPrivateOrLoopbackHost("[fc00::1]")).toBe(true);
    expect(isPrivateOrLoopbackHost("[fd00::1]")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 (::ffff:*) — dotted + hex-compressed forms", () => {
    // ::ffff:169.254.169.254 is AWS IMDS wearing an IPv6 costume.
    expect(isPrivateOrLoopbackHost("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateOrLoopbackHost("[::ffff:169.254.169.254]")).toBe(true);
    expect(isPrivateOrLoopbackHost("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("::ffff:169.254.169.254")).toBe(true);
    // Hex-compressed: 7f00:1 → 127.0.0.1, a9fe:a9fe → 169.254.169.254.
    expect(isPrivateOrLoopbackHost("::ffff:7f00:1")).toBe(true);
    expect(isPrivateOrLoopbackHost("::ffff:a9fe:a9fe")).toBe(true);
  });

  it("allows real public hostnames", () => {
    expect(isPrivateOrLoopbackHost("example.com")).toBe(false);
    expect(isPrivateOrLoopbackHost("api.openai.com")).toBe(false);
    expect(isPrivateOrLoopbackHost("8.8.8.8")).toBe(false);
    expect(isPrivateOrLoopbackHost("1.1.1.1")).toBe(false);
  });

  it("blocks empty / nullish hostnames defensively", () => {
    expect(isPrivateOrLoopbackHost("")).toBe(true);
  });
});

describe("extractMetadata", () => {
  it("pulls title", () => {
    const html = '<html><head><title>Acme Inc</title></head><body></body></html>';
    expect(extractMetadata(html, "https://acme.com").title).toBe("Acme Inc");
  });

  it("pulls meta description (quoted attr)", () => {
    const html = '<meta name="description" content="The widget company">';
    expect(extractMetadata(html, "https://acme.com").description).toBe("The widget company");
  });

  it("pulls meta description (unquoted attr — older WP/CMS templates)", () => {
    const html = "<meta name=description content=Widgets>";
    expect(extractMetadata(html, "https://acme.com").description).toBe("Widgets");
  });

  it("pulls OG tags into og.*", () => {
    const html =
      '<meta property="og:title" content="Acme"><meta property="og:image" content="https://x/img.jpg">';
    const m = extractMetadata(html, "https://acme.com");
    expect(m.og.title).toBe("Acme");
    expect(m.og.image).toBe("https://x/img.jpg");
  });

  it("falls back twitter:* to og.* when og missing", () => {
    const html = '<meta name="twitter:title" content="From Twitter">';
    expect(extractMetadata(html, "https://acme.com").og.title).toBe("From Twitter");
  });

  it("resolves relative favicon against baseUrl", () => {
    const html = '<link rel="icon" href="/icon.png">';
    expect(extractMetadata(html, "https://acme.com").favicon).toBe("https://acme.com/icon.png");
  });

  it("defaults favicon to /favicon.ico when no <link rel=icon> present", () => {
    expect(extractMetadata("<html></html>", "https://acme.com").favicon).toBe(
      "https://acme.com/favicon.ico"
    );
  });

  it("extracts social links (one per platform)", () => {
    const html = `
      <a href="https://facebook.com/acme">fb</a>
      <a href="https://www.instagram.com/acme">ig</a>
      <a href="https://twitter.com/acme">tw</a>
      <a href="https://x.com/acme2">x</a>
      <a href="https://linkedin.com/company/acme">li</a>
    `;
    const m = extractMetadata(html, "https://acme.com");
    expect(m.social_links.facebook).toContain("facebook.com/acme");
    expect(m.social_links.instagram).toContain("instagram.com/acme");
    expect(m.social_links.twitter).toContain("twitter.com/acme"); // first wins
    expect(m.social_links.linkedin).toContain("linkedin.com/company/acme");
  });

  it("ignores facebook /sharer/ and twitter /intent/ links (these are share buttons, not profiles)", () => {
    const html = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=foo">share fb</a>
      <a href="https://twitter.com/intent/tweet?text=hi">share tw</a>
    `;
    const m = extractMetadata(html, "https://acme.com");
    expect(m.social_links.facebook).toBeUndefined();
    expect(m.social_links.twitter).toBeUndefined();
  });

  it("parses JSON-LD organization schema", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>`;
    const m = extractMetadata(html, "https://acme.com");
    expect(m.json_ld).toHaveLength(1);
    expect((m.json_ld[0] as any).name).toBe("Acme");
  });

  it("skips malformed JSON-LD without throwing", () => {
    const html = `<script type="application/ld+json">{ not valid json }</script>`;
    const m = extractMetadata(html, "https://acme.com");
    expect(m.json_ld).toHaveLength(0);
  });
});

describe("stripHtml", () => {
  it("removes script tags + content", () => {
    expect(stripHtml('<p>visible</p><script>alert(1)</script><p>also</p>')).toBe(
      "visible also"
    );
  });

  it("removes style + noscript + head blocks", () => {
    expect(stripHtml('<head><title>x</title></head><body><p>hello</p></body>')).toBe("hello");
    expect(stripHtml('<style>p{color:red}</style><p>hello</p>')).toBe("hello");
    expect(stripHtml('<noscript>js off</noscript><p>hello</p>')).toBe("hello");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtml("<p>Tom &amp; Jerry &lt;3 &quot;cats&quot;</p>")).toBe(
      'Tom & Jerry <3 "cats"'
    );
  });

  it("collapses whitespace + trims", () => {
    expect(stripHtml("<p>  hello\n\n\n   world  </p>")).toBe("hello world");
  });
});
