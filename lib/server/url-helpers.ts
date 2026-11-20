/**
 * Pure helpers used by app/api/ingest/route.ts. Lives in lib/server/ so it's
 * unambiguously server-only (no browser globals), and so the unit tests in
 * lib/__tests__/url-helpers.test.ts can exercise them without spinning up
 * the Next runtime.
 *
 * What's here:
 *  - isPrivateOrLoopbackHost(): SSRF guard. Blocks loopback, RFC1918,
 *    link-local (169.254.x — cloud-metadata IMDS!), IPv6 ULA/link-local.
 *  - extractMetadata(): pulls <title>, OG/Twitter cards, favicon, social
 *    anchors, JSON-LD blocks out of raw HTML. No DOM parser dependency
 *    (Node + tests both happy).
 *  - stripHtml(): strips script/style/noscript/head + tags + common HTML
 *    entities → plain text. Cheap and predictable.
 */

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (!hostname) return true;
  let h = hostname.toLowerCase();
  // URL.hostname returns IPv6 literals WITH brackets (e.g. "[::1]"). Strip a
  // single surrounding pair so the IPv6 checks below actually match.
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h === "localhost" || h === "ip6-localhost" || h === "ip6-loopback") return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or hex-compressed ::ffff:7f00:1 /
  // ::ffff:a9fe:a9fe). Unwrap the embedded IPv4 and validate it against the
  // IPv4 rules below — otherwise ::ffff:169.254.169.254 (AWS IMDS) sails past.
  const mapped = h.match(/^::ffff:([0-9a-f:.]+)$/i);
  if (mapped) {
    const v4 = mappedIPv6ToIPv4(mapped[1]);
    if (v4) h = v4;
  }
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // 169.254.0.0/16 includes AWS IMDS (169.254.169.254) — leaking this would
  // expose instance metadata + IAM credentials on EC2. Hard block.
  if (/^169\.254\./.test(h)) return true;
  if (/^0\./.test(h)) return true;
  // 100.64.0.0/10 — carrier-grade NAT (RFC 6598). Used for internal service
  // meshes (Tailscale, some k8s CNIs, several cloud providers' internal
  // ranges), so it's reachable-but-private from a hosted deployment.
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  // 192.0.0.0/24 (IETF protocol assignments) and 198.18.0.0/15 (benchmarking)
  // are also non-public and occasionally routed internally.
  if (/^192\.0\.0\./.test(h)) return true;
  if (/^198\.1[89]\./.test(h)) return true;
  // Multicast (224.0.0.0/4) and reserved/broadcast (240.0.0.0/4, incl.
  // 255.255.255.255) — never a legitimate web origin.
  if (/^(22[4-9]|2[3-5]\d)\.\d/.test(h)) return true;
  if (h === "::1" || h === "::") return true;
  // IPv6 link-local (fe80::/10) and unique-local (fc00::/7).
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
  // IPv6 multicast (ff00::/8).
  if (/^ff[0-9a-f]{2}:/i.test(h)) return true;
  return false;
}

/**
 * Convert the tail of an IPv4-mapped IPv6 address (the part after "::ffff:")
 * into dotted-quad IPv4. Accepts dotted form ("127.0.0.1") verbatim and the
 * hex-compressed form ("7f00:1", "a9fe:a9fe" → "127.0.0.1", "169.254.169.254").
 * Returns null if it can't be parsed as an embedded IPv4.
 */
function mappedIPv6ToIPv4(embedded: string): string | null {
  if (embedded.includes(".")) return embedded;
  const groups = embedded.split(":").filter((g) => g.length > 0);
  if (groups.length === 0 || groups.length > 2) return null;
  let value = 0;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    value = ((value << 16) | parseInt(g, 16)) >>> 0;
  }
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join(".");
}

// ---------------------------------------------------------------------------
// Linear-time HTML scanning.
//
// Every helper below is built on indexOf / literal (backtracking-free) regex
// searches so the cost is O(n) in the body size no matter how malformed the
// input is. The previous implementation used lazy `[\s\S]*?` and `[^>]*`
// patterns, which re-scan to the end of the string from EVERY unclosed open
// tag — a 500 KB body of "<script" (or "<meta ", "<a ", a bare "<") took
// minutes of CPU, i.e. a trivially reachable DoS on a public ingest endpoint.
//
// scripts/local-sync.cjs carries a hand-copied CommonJS port of stripHtml /
// scanTags (it can't import TypeScript). Keep the two in lockstep; both are
// covered by lib/__tests__/ingest-hardening.test.ts and sidecar.test.ts.
// ---------------------------------------------------------------------------

const TAG_NAME_CHAR = /[a-z0-9-]/i;

/** Literal, case-insensitive search for `needle` starting at `from`. */
function indexOfCI(haystack: string, needle: string, from: number): number {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "gi");
  re.lastIndex = from;
  const m = re.exec(haystack);
  return m ? m.index : -1;
}

/**
 * Remove every `<tag ...> ... </tag>` block (case-insensitive). An open tag
 * with no later close is left in place — the same result the old
 * `/<tag[\s\S]*?<\/tag>/gi` produced, just without the quadratic scan.
 * Requires a tag-name boundary so `<head` doesn't match `<header>`.
 */
function removeBlocks(s: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const start = indexOfCI(s, open, i);
    if (start < 0) break;
    const after = s.charAt(start + open.length);
    if (after && TAG_NAME_CHAR.test(after)) {
      // e.g. <header> while removing <head> — not ours, keep scanning.
      out += s.slice(i, start + 1);
      i = start + 1;
      continue;
    }
    const end = indexOfCI(s, close, start + open.length);
    if (end < 0) break; // no close anywhere after this point → nothing more to remove
    out += s.slice(i, start);
    i = end + close.length;
  }
  return out + s.slice(i);
}

/** Replace every `<...>` (at least one char inside) with a space. Equivalent
 *  to `.replace(/<[^>]+>/g, " ")`, in one forward pass. */
function replaceTags(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) break;
    const gt = s.indexOf(">", lt + 1);
    if (gt < 0) break; // no '>' left → no more tags can match
    if (gt === lt + 1) {
      // "<>" is not a tag; keep the '<' and continue right after it.
      out += s.slice(i, lt + 1);
      i = lt + 1;
      continue;
    }
    out += s.slice(i, lt) + " ";
    i = gt + 1;
  }
  return out + s.slice(i);
}

export function stripHtml(html: string): string {
  let s = removeBlocks(html, "script");
  s = removeBlocks(s, "style");
  s = removeBlocks(s, "noscript");
  s = removeBlocks(s, "head");
  return replaceTags(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface ScannedTag {
  /** Lower-cased tag name ("meta", "a", "script", "/title", …). */
  name: string;
  /** The full tag text, from '<' to '>' inclusive. */
  raw: string;
  /** Index just past the closing '>'. */
  end: number;
}

/** Visit every `<name ...>` tag in one forward pass. Stops at the first '<'
 *  with no later '>' (nothing after it can be a complete tag). */
function scanTags(html: string, visit: (tag: ScannedTag) => boolean | void): void {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) return;
    if (html.charAt(lt + 1) === "<") {
      i = lt + 1;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) return;
    let n = lt + 1;
    if (html.charAt(n) === "/") n++;
    while (n < gt && TAG_NAME_CHAR.test(html.charAt(n))) n++;
    const name = html.slice(lt + 1, n).toLowerCase();
    const stop = visit({ name, raw: html.slice(lt, gt + 1), end: gt + 1 });
    if (stop === true) return;
    i = gt + 1;
  }
}

export interface Metadata {
  title: string;
  description: string;
  og: Record<string, string>;
  favicon: string;
  social_links: Record<string, string>;
  json_ld: unknown[];
}

const attrRe = (name: string) =>
  new RegExp(`(?:${name})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
const NAME_ATTR = attrRe("name|property");
const CONTENT_ATTR = attrRe("content");

export function extractMetadata(html: string, baseUrl: string): Metadata {
  const meta: Metadata = {
    title: "",
    description: "",
    og: {},
    favicon: "",
    social_links: {},
    json_ld: [],
  };

  let faviconLocked = false;
  let scriptCloseExhausted = false;

  const onAnchor = (tag: string) => {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return;
    let u: URL;
    try {
      u = new URL(hrefMatch[1], baseUrl);
    } catch {
      return;
    }
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const url = u.toString();
    if (!meta.social_links.facebook && /(^|\.)facebook\.com$/.test(host) && !/\/sharer/i.test(u.pathname))
      meta.social_links.facebook = url;
    if (!meta.social_links.instagram && /(^|\.)instagram\.com$/.test(host))
      meta.social_links.instagram = url;
    if (
      !meta.social_links.twitter &&
      (/(^|\.)twitter\.com$/.test(host) || /(^|\.)x\.com$/.test(host)) &&
      !/\/intent\//i.test(u.pathname)
    )
      meta.social_links.twitter = url;
    if (!meta.social_links.linkedin && /(^|\.)linkedin\.com$/.test(host))
      meta.social_links.linkedin = url;
    if (!meta.social_links.youtube && /(^|\.)youtube\.com$/.test(host))
      meta.social_links.youtube = url;
    if (!meta.social_links.tiktok && /(^|\.)tiktok\.com$/.test(host))
      meta.social_links.tiktok = url;
    if (!meta.social_links.pinterest && /(^|\.)pinterest\.com$/.test(host))
      meta.social_links.pinterest = url;
    if (!meta.social_links.threads && /(^|\.)threads\.net$/.test(host))
      meta.social_links.threads = url;
  };

  scanTags(html, ({ name, raw, end }) => {
    if (name === "title" && !meta.title) {
      // <title ...>TEXT</title> where TEXT has no '<'.
      const lt = html.indexOf("<", end);
      if (lt > end && html.slice(lt, lt + 8).toLowerCase() === "</title>") {
        meta.title = html.slice(end, lt).trim();
      }
    } else if (name === "meta") {
      const nameMatch = raw.match(NAME_ATTR);
      const contentMatch = raw.match(CONTENT_ATTR);
      if (!nameMatch || !contentMatch) return;
      const key = (nameMatch[1] || nameMatch[2] || nameMatch[3] || "").toLowerCase();
      const val = contentMatch[1] || contentMatch[2] || contentMatch[3] || "";
      if (key === "description" && !meta.description) meta.description = val;
      if (key.startsWith("og:")) meta.og[key.slice(3)] = val;
      if (key === "twitter:title" && !meta.og.title) meta.og.title = val;
      if (key === "twitter:description" && !meta.og.description) meta.og.description = val;
      if (key === "twitter:image" && !meta.og.image) meta.og.image = val;
    } else if (name === "link" && !faviconLocked) {
      const relMatch = raw.match(/rel\s*=\s*["']([^"']+)["']/i);
      const hrefMatch = raw.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!relMatch || !hrefMatch) return;
      if (/icon/i.test(relMatch[1])) {
        try {
          meta.favicon = new URL(hrefMatch[1], baseUrl).toString();
          if (!/apple-touch/i.test(relMatch[1])) faviconLocked = true;
        } catch {
          // ignore
        }
      }
    } else if (name === "a") {
      onAnchor(raw);
    } else if (
      name === "script" &&
      !scriptCloseExhausted &&
      /type\s*=\s*["']application\/ld\+json["']/i.test(raw)
    ) {
      const close = indexOfCI(html, "</script>", end);
      if (close < 0) {
        // No close tag anywhere after here: no later JSON-LD block can be
        // complete either, so stop looking (keeps this linear).
        scriptCloseExhausted = true;
        return;
      }
      try {
        meta.json_ld.push(JSON.parse(html.slice(end, close).trim()));
      } catch {
        // skip malformed JSON-LD
      }
    }
  });

  if (!meta.favicon) {
    try {
      meta.favicon = new URL("/favicon.ico", baseUrl).toString();
    } catch {
      // ignore
    }
  }

  return meta;
}

/**
 * Rate-limit bucket key for /api/ingest.
 *
 * X-Forwarded-For / X-Real-IP / CF-Connecting-IP are plain request headers:
 * any client can set them, so keying on them unconditionally let a caller
 * rotate a fake IP per request and never hit the limit. They are only trusted
 * when the deployment says a proxy in front of us sets them:
 *
 *  - VERCEL (set by the platform): Vercel overwrites X-Forwarded-For and sets
 *    X-Real-IP to the real client address.
 *  - OPENADKIT_TRUST_PROXY=1: a self-managed reverse proxy (nginx, Caddy, …)
 *    that APPENDS the peer address — so only the rightmost XFF hop is trusted;
 *    everything left of it is client-controlled.
 *
 * Otherwise (self-hosted, typically single-user) every request shares one
 * global bucket.
 */
export function rateLimitKey(
  headers: Headers,
  env: Record<string, string | undefined> = process.env
): string {
  const GLOBAL = "global";
  const xff = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (env.VERCEL) {
    const ip = headers.get("x-real-ip")?.trim() || xff[0];
    return ip ? `ip:${ip}` : GLOBAL;
  }
  if (env.OPENADKIT_TRUST_PROXY === "1") {
    const ip = xff[xff.length - 1] || headers.get("x-real-ip")?.trim();
    return ip ? `ip:${ip}` : GLOBAL;
  }
  return GLOBAL;
}
