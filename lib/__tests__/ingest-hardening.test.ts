/**
 * Hardening for the hosted /api/ingest route helpers:
 *  - stripHtml() must be linear-time (the old lazy `[\s\S]*?` regexes went
 *    quadratic on unclosed tags — a 500 KB body of "<script" pinned a CPU).
 *  - rateLimitKey() must not trust client-supplied X-Forwarded-For unless the
 *    deployment explicitly sits behind a trusted proxy.
 */
import { describe, it, expect } from "vitest";
import { stripHtml, rateLimitKey, extractMetadata } from "@/lib/server/url-helpers";

describe("stripHtml — linear time on adversarial input", () => {
  it("500 KB of repeated '<script' finishes fast", () => {
    const evil = "<script".repeat(Math.ceil(500_000 / 7));
    const t0 = performance.now();
    stripHtml(evil);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it("500 KB of unclosed '<' / '<style' / '<head' finishes fast", () => {
    for (const unit of ["<", "<style", "<head", "<noscript", "<a "]) {
      const evil = unit.repeat(Math.ceil(500_000 / unit.length));
      const t0 = performance.now();
      stripHtml(evil);
      expect(performance.now() - t0).toBeLessThan(200);
    }
  });

  it("keeps text after an unclosed <script (matches the old regex semantics)", () => {
    expect(stripHtml("<p>hi</p><script>tail")).toBe("hi tail");
  });

  it("removes multiple blocks, case-insensitively", () => {
    expect(stripHtml("a<SCRIPT>x</SCRIPT>b<script type=x>y</script>c")).toBe("abc");
  });

  it("does not treat <header> as <head>", () => {
    expect(stripHtml("<header>Brand</header><p>body</p>")).toBe("Brand body");
  });

  it("strips tags with '<' inside and leaves a bare '<>' alone", () => {
    expect(stripHtml("x <> y")).toBe("x <> y");
    expect(stripHtml("a<b<c>d")).toBe("a d");
  });
});

describe("extractMetadata — no quadratic blow-up on unclosed tags", () => {
  it("500 KB of '<meta ' / '<a ' / '<link ' / json-ld opens finishes fast", () => {
    for (const unit of ["<meta ", "<a href=x ", "<link ", '<script type="application/ld+json">']) {
      const evil = unit.repeat(Math.ceil(500_000 / unit.length));
      const t0 = performance.now();
      extractMetadata(evil, "https://example.com/");
      expect(performance.now() - t0).toBeLessThan(500);
    }
  });
});

describe("rateLimitKey", () => {
  const h = (o: Record<string, string>) => new Headers(o);

  it("self-hosted (no proxy trust): ignores X-Forwarded-For — one global bucket", () => {
    const env = {};
    const a = rateLimitKey(h({ "x-forwarded-for": "1.1.1.1" }), env);
    const b = rateLimitKey(h({ "x-forwarded-for": "2.2.2.2" }), env);
    const c = rateLimitKey(h({ "x-real-ip": "3.3.3.3", "cf-connecting-ip": "4.4.4.4" }), env);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("OPENADKIT_TRUST_PROXY=0 is not trust", () => {
    expect(rateLimitKey(h({ "x-forwarded-for": "1.1.1.1" }), { OPENADKIT_TRUST_PROXY: "0" })).toBe(
      rateLimitKey(h({}), {})
    );
  });

  it("VERCEL: keys on the platform-provided client IP", () => {
    const env = { VERCEL: "1" };
    expect(rateLimitKey(h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "9.9.9.9" }), env)).toBe("ip:9.9.9.9");
    expect(rateLimitKey(h({ "x-forwarded-for": "5.5.5.5, 10.0.0.1" }), env)).toBe("ip:5.5.5.5");
  });

  it("OPENADKIT_TRUST_PROXY=1: uses the hop the trusted proxy appended (rightmost XFF)", () => {
    const env = { OPENADKIT_TRUST_PROXY: "1" };
    // Client spoofs a leading entry; the proxy appends the real peer address.
    expect(rateLimitKey(h({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" }), env)).toBe("ip:7.7.7.7");
    expect(rateLimitKey(h({ "x-real-ip": "8.8.8.8" }), env)).toBe("ip:8.8.8.8");
  });

  it("trusted proxy but no IP headers → global bucket, never 'unknown' per-request keys", () => {
    expect(rateLimitKey(h({}), { VERCEL: "1" })).toBe(rateLimitKey(h({}), {}));
  });
});
