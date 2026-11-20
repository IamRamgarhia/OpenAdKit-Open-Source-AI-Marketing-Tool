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
 * SSRF guarded: blocks loopback, RFC1918 private, link-local, CGNAT, IPv6
 * unique-local, and 169.254.169.254 (cloud metadata) on both the initial URL
 * and every redirect hop. Resolved addresses are PINNED into the connection so
 * a hostile short-TTL DNS record can't answer the validation lookup and the
 * fetch differently (rebinding TOCTOU). Body capped at 500 KB. 15s timeout per
 * hop, max 5 redirects. Rate limited per client IP behind a trusted proxy, globally otherwise.
 *
 * Mirrors the response shape of the sidecar (lib/url-ingest.ts uses both
 * interchangeably via serverProxyUrl()).
 */
import dns from "node:dns";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { NextResponse } from "next/server";
import {
  isPrivateOrLoopbackHost,
  extractMetadata,
  stripHtml as stripHtmlHelper,
  rateLimitKey,
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
  "Mozilla/5.0 (compatible; OpenAdKit/1.0; +https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool)";

// --- Abuse control ---------------------------------------------------------
// Bucket key comes from rateLimitKey() (lib/server/url-helpers.ts): forwarded
// IP headers are only trusted on Vercel or with OPENADKIT_TRUST_PROXY=1 —
// otherwise they are client-controlled and every request shares one bucket.
// This route does a server-side fetch of any public URL. Without a limit,
// anyone who finds a hosted deployment can use it as a free open proxy at the
// operator's bandwidth/compute expense. In-memory token bucket per client IP:
// good enough for a single-instance deploy, and it degrades to per-instance
// limits on serverless (which still bounds any one lambda). Operators who need
// hard global limits should front this with their platform's rate limiter.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(key, hits);
  // Opportunistic sweep so the map can't grow without bound.
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (!v.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return hits.length > RATE_LIMIT_MAX;
}

// Resolve the hostname and reject if ANY resolved address is private/loopback/
// link-local. This defeats decimal/hex/octal IP encodings that slip past the
// literal-string guard, plus DNS-rebinding (a public name pointing at an
// internal IP). Resolution failure is treated as blocked — fail closed.
async function assertResolvesPublic(hostname: string): Promise<dns.LookupAddress[]> {
  let resolved: dns.LookupAddress[];
  try {
    resolved = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new Error("Private / loopback / link-local host blocked");
  }
  if (!resolved.length) throw new Error("Private / loopback / link-local host blocked");
  for (const { address } of resolved) {
    if (isPrivateOrLoopbackHost(address)) {
      throw new Error("Private / loopback / link-local host blocked");
    }
  }
  return resolved;
}

/**
 * Build a `lookup` that resolves ONLY to addresses we already validated.
 *
 * Without this there's a time-of-check/time-of-use hole: assertResolvesPublic()
 * does its own DNS lookup, then the HTTP client does a completely independent
 * one. A hostile DNS server with a 0-second TTL can answer the check with a
 * public IP and the connection with 169.254.169.254 (cloud metadata). Feeding
 * the vetted addresses back in removes the second lookup entirely.
 *
 * Every address is re-checked inside the callback too, so even a
 * pinned-but-somehow-private address can't get through.
 *
 * NOTE: this is why the request below uses node:http/node:https rather than
 * global fetch. Node's fetch is undici, which ignores `agent` and exposes no
 * `lookup` hook — passing one there would look like a fix while silently
 * leaving the rebinding window wide open.
 */
function pinnedLookup(addresses: dns.LookupAddress[]): net.LookupFunction {
  return ((_hostname: string, options: any, callback: any) => {
    const cb = typeof options === "function" ? options : callback;
    const wantsAll = typeof options === "object" && options !== null && options.all;
    const safe = addresses.filter((a) => !isPrivateOrLoopbackHost(a.address));
    if (!safe.length) {
      cb(new Error("Private / loopback / link-local host blocked"));
      return;
    }
    if (wantsAll) cb(null, safe);
    else cb(null, safe[0].address, safe[0].family);
  }) as unknown as net.LookupFunction;
}

interface RawResponse {
  status: number;
  location: string | null;
  body: string;
}

/** One HTTP(S) GET with the DNS result pinned, a hard timeout, and a byte cap. */
function requestOnce(target: string, addresses: dns.LookupAddress[]): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(target);
    const transport = u.protocol === "http:" ? http : https;
    const req = transport.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: `${u.pathname}${u.search}`,
        method: "GET",
        lookup: pinnedLookup(addresses),
        // SNI/Host must stay the original hostname even though we connect to a
        // pinned IP, or virtual-hosted sites return the wrong content.
        servername: u.protocol === "https:" ? u.hostname : undefined,
        headers: {
          Host: u.host,
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      } as http.RequestOptions,
      (res) => {
        const status = res.statusCode ?? 0;
        const location = (res.headers.location as string | undefined) ?? null;
        // Don't buffer redirect bodies — we only need the Location header.
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location, body: "" });
          return;
        }
        const decoder = new TextDecoder("utf-8", { fatal: false });
        let out = "";
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.byteLength;
          if (total > MAX_REMOTE_BYTES) {
            req.destroy();
            reject(new Error(`Remote body exceeded ${MAX_REMOTE_BYTES} bytes`));
            return;
          }
          out += decoder.decode(chunk, { stream: true });
        });
        res.on("end", () => {
          out += decoder.decode();
          resolve({ status, location, body: out });
        });
        res.on("error", reject);
      }
    );
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`Timed out after ${TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
    req.end();
  });
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
    // Re-checked on every hop (initial URL + each redirect target), and the
    // resolved addresses are pinned into the connection.
    const addresses = await assertResolvesPublic(u.hostname);
    const res = await requestOnce(current, addresses);

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`Redirect ${res.status} without Location header`);
      current = new URL(res.location, current).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 400) {
      throw new Error(`HTTP ${res.status} from target`);
    }
    return res.body;
  }
  throw new Error("Too many redirects");
}

export async function GET(req: Request) {
  if (rateLimited(rateLimitKey(req.headers))) {
    return NextResponse.json(
      { ok: false, error: `Rate limit: max ${RATE_LIMIT_MAX} ingests per minute.` },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
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
