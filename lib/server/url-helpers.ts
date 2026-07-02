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
  if (h === "::1" || h === "::") return true;
  // IPv6 link-local (fe80::/10) and unique-local (fc00::/7).
  if (/^fe[89ab][0-9a-f]:/i.test(h)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
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

export interface Metadata {
  title: string;
  description: string;
  og: Record<string, string>;
  favicon: string;
  social_links: Record<string, string>;
  json_ld: unknown[];
}

export function extractMetadata(html: string, baseUrl: string): Metadata {
  const meta: Metadata = {
    title: "",
    description: "",
    og: {},
    favicon: "",
    social_links: {},
    json_ld: [],
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  const metaTagRe = /<meta\b[^>]*>/gi;
  const attrRe = (name: string) =>
    new RegExp(`(?:${name})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  let m: RegExpExecArray | null;
  while ((m = metaTagRe.exec(html)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(attrRe("name|property"));
    const contentMatch = tag.match(attrRe("content"));
    if (!nameMatch || !contentMatch) continue;
    const key = (nameMatch[1] || nameMatch[2] || nameMatch[3] || "").toLowerCase();
    const val = contentMatch[1] || contentMatch[2] || contentMatch[3] || "";
    if (key === "description" && !meta.description) meta.description = val;
    if (key.startsWith("og:")) meta.og[key.slice(3)] = val;
    if (key === "twitter:title" && !meta.og.title) meta.og.title = val;
    if (key === "twitter:description" && !meta.og.description) meta.og.description = val;
    if (key === "twitter:image" && !meta.og.image) meta.og.image = val;
  }

  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    const relMatch = tag.match(/rel\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    if (/icon/i.test(relMatch[1])) {
      try {
        meta.favicon = new URL(hrefMatch[1], baseUrl).toString();
        if (!/apple-touch/i.test(relMatch[1])) break;
      } catch {
        // ignore
      }
    }
  }
  if (!meta.favicon) {
    try {
      meta.favicon = new URL("/favicon.ico", baseUrl).toString();
    } catch {
      // ignore
    }
  }

  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = anchorRe.exec(html)) !== null) {
    let u: URL;
    try {
      u = new URL(m[1], baseUrl);
    } catch {
      continue;
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
  }

  const jsonLdRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = jsonLdRe.exec(html)) !== null) {
    try {
      meta.json_ld.push(JSON.parse(m[1].trim()));
    } catch {
      // skip malformed JSON-LD
    }
  }

  return meta;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
