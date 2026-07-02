/**
 * Server-side URL ingest — the hosted-mode equivalent of the local sidecar's
 * /ingest endpoint. Called by lib/url-ingest.ts when running on a non-loopback
 * host (i.e. deployed to Vercel/Cloudflare/Netlify).
 *
 * What it does: server-side HTTP GET of a user-supplied URL, strip HTML to
 * plain text, extract OG/title/JSON-LD metadata, return as JSON. Bypasses
 * browser CORS so the same URL ingest flow works without the local sidecar.
 *
 * What it does NOT do:
 *  - No LLM calls. The user's BYOK key never touches the server.
 *  - No persistence. We don't store the URL, the content, or anything else.
 *  - No telemetry. No logs of which URLs were ingested.
 *
 * SSRF guarded: blocks loopback, RFC1918 private, link-local, IPv6 unique-
 * local, and 169.254.169.254 (cloud metadata) on both the initial URL and
 * every redirect hop. Body capped at 500 KB. 15s timeout per hop, max 5
 * redirects.
 *
 * Mirrors the response shape of the sidecar (lib/url-ingest.ts uses both
 * interchangeably via serverProxyUrl()).
 */
import dns from "node:dns";
import { NextResponse } from "next/server";
import {
  isPrivateOrLoopbackHost,
  extractMetadata,
  stripHtml as stripHtmlHelper,
} from "@/lib/server/url-helpers";

// Force Node runtime (not Edge) — we need redirect-by-hand control + the
// 15s timeout per hop, which Edge fetch doesn't expose granularly.
export const runtime = "nodejs";
// No caching — every ingest is a fresh fetch. We don't want stale brand data.
export const dynamic = "force-dynamic";

const MAX_REMOTE_BYTES = 500_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const OUTPUT_CAP = 40_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; OpenAdKit/1.0; +https://github.com/IamRamgarhia/AdForge)";

// Resolve the hostname and reject if ANY resolved address is private/loopback/
// link-local. This defeats decimal/hex/octal IP encodings that slip past the
// literal-string guard, plus DNS-rebinding (a public name pointing at an
// internal IP). Resolution failure is treated as blocked — fail closed.
async function assertResolvesPublic(hostname: string): Promise<void> {
  let resolved: dns.LookupAddress[];
  try {
    resolved = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new Error("Private / loopback / link-local host blocked");
  }
  for (const { address } of resolved) {
    if (isPrivateOrLoopbackHost(address)) {
      throw new Error("Private / loopback / link-local host blocked");
    }
  }
}

async function fetchWithRedirects(initialUrl: string): Promise<string> {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Non-http(s) URL blocked");
    }
    if (isPrivateOrLoopbackHost(u.hostname)) {
      throw new Error("Private / loopback / link-local host blocked");
    }
    // Re-checked on every hop (initial URL + each redirect target).
    await assertResolvesPublic(u.hostname);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirect ${res.status} without Location header`);
      current = new URL(loc, current).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 400) {
      throw new Error(`HTTP ${res.status} from target`);
    }
    // Read body with cap. Reader to enforce the byte budget without
    // accumulating an unbounded string in memory.
    if (!res.body) return await res.text();
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let out = "";
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REMOTE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        throw new Error(`Remote body exceeded ${MAX_REMOTE_BYTES} bytes`);
      }
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  }
  throw new Error("Too many redirects");
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const target = u.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ ok: false, error: "Missing url param." }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid url." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json(
      { ok: false, error: "Only http/https URLs supported." },
      { status: 400 }
    );
  }
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    return NextResponse.json(
      { ok: false, error: "Private / loopback / link-local hosts are not allowed." },
      { status: 400 }
    );
  }

  let body: string;
  try {
    body = await fetchWithRedirects(target);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const metadata = extractMetadata(body, target);
  const text = stripHtmlHelper(body);
  const truncated = text.length > OUTPUT_CAP;
  return NextResponse.json({
    ok: true,
    url: target,
    content: truncated ? text.slice(0, OUTPUT_CAP) : text,
    truncated,
    source: "hosted-api",
    metadata,
  });
}
