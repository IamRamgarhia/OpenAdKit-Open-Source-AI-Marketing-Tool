// OpenAdKit service worker — offline shell only.
// We DO NOT cache or proxy LLM provider / ingest API calls — those always go
// live so stale responses never leak.
// VERSION comes from the registration URL (/sw.js?v=<build id>), which
// components/ServiceWorkerRegister.tsx sets from NEXT_PUBLIC_BUILD_ID. A new
// build => a new script URL => the browser installs a fresh worker and the
// activate handler deletes the previous shell cache. Nothing rewrites this
// file at build time, so the git tree stays clean.
const VERSION = "openadkit-" + (new URL(self.location.href).searchParams.get("v") || "dev");
const SHELL = ["/", "/setup", "/manifest.webmanifest"];

// Runtime cache cap. Every visited page + static chunk used to be cached
// forever (until the next build), so the cache grew without bound.
const MAX_ENTRIES = 60;

// Minimal offline page for navigations we have no cached copy of. Serving the
// cached "/" HTML for every URL rendered the dashboard under the wrong address
// (and its client router then tried to hydrate the wrong route).
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · OpenAdKit</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08080a;color:#e7e7ea;font:15px/1.5 system-ui,sans-serif}main{max-width:28rem;padding:24px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#9a9aa3;margin:0 0 16px}a,button{color:#08080a;background:#d97706;border:0;padding:8px 14px;font:inherit;cursor:pointer;text-decoration:none}</style></head><body><main><h1>You're offline</h1><p>This page hasn't been opened on this device yet, so there's no saved copy. Your data is safe in this browser — reconnect and try again.</p><button onclick="location.reload()">Retry</button></main></body></html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** React Server Component payloads (client-side navigations / prefetches).
 *  They're keyed by an `_rsc` query param and/or the RSC request header;
 *  caching them filled the cache with near-duplicate flight data, and serving
 *  a stale one after a deploy breaks client navigation. */
function isRscRequest(request, url) {
  if (url.searchParams.has("_rsc")) return true;
  const h = request.headers;
  return h.get("RSC") === "1" || h.has("Next-Router-State-Tree") || h.has("Next-Router-Prefetch");
}

/** Keep the runtime cache at MAX_ENTRIES (oldest first; shell entries kept). */
async function trimCache() {
  const cache = await caches.open(VERSION);
  const keys = await cache.keys();
  const shell = new Set(SHELL.map((p) => new URL(p, self.location.origin).href));
  const evictable = keys.filter((k) => !shell.has(k.url));
  const excess = evictable.length - MAX_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(evictable[i]);
}

// Any GET request whose hostname includes one of these strings is left
// untouched by the service worker (no cache read, no cache write).
const NEVER_INTERCEPT_HOSTS = [
  // LLM providers (vision + text)
  "anthropic.com",
  "openai.com",
  "generativelanguage.googleapis.com",  // Gemini specifically — not all of *.googleapis.com (Audit MEDIUM-3)
  "groq.com",
  "cerebras.ai",
  "together.xyz",
  "together.ai",
  "deepseek.com",
  "mistral.ai",
  "openrouter.ai",
  // URL ingest / read fallback
  "jina.ai",               // r.jina.ai (Reader) + s.jina.ai (Search)
  "allorigins.win",        // CORS proxy fallback for ingest
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never touch LLM provider or ingest API calls.
  if (NEVER_INTERCEPT_HOSTS.some((h) => url.hostname.includes(h))) return;

  // Never touch the local launcher sidecar — it's stateful, and its port is
  // assigned at launch time so we can't match on a fixed number (this used to
  // check `url.port === "3006"`, which stopped matching the moment the port
  // resolver shipped; sidecar calls then got the offline shell HTML handed
  // back to them instead of a network error).
  //
  // Rule: any loopback request to an origin that ISN'T this page's own origin
  // is a sidecar call. Same-origin loopback requests are the app shell and
  // stay cacheable, minus the sidecar API paths the app also serves.
  const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (isLoopback) {
    if (url.origin !== self.location.origin) return;
    if (
      url.pathname.startsWith("/health") ||
      url.pathname.startsWith("/status") ||
      url.pathname.startsWith("/snapshot") ||
      url.pathname.startsWith("/ingest") ||
      url.pathname.startsWith("/config") ||
      url.pathname.startsWith("/update") ||
      url.pathname.startsWith("/diagnostics")
    ) {
      return;
    }
  }

  // Never cache /api/* responses — these are dynamic (URL ingest, etc.) and
  // caching them would serve a stale page when the user re-ingests a URL.
  if (url.pathname.startsWith("/api/")) return;

  // Only GETs cached.
  if (event.request.method !== "GET") return;

  // RSC flight requests go straight to the network, uncached.
  if (isRscRequest(event.request, url)) return;

  // Network-first for the app shell; fall back to cache when offline. This
  // automatically picks up every new route the app adds (Launch Wizard, Batch,
  // Reel Ideas, Reel Teardown, etc.) on first visit.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches
            .open(VERSION)
            .then((c) => c.put(event.request, copy))
            .then(trimCache)
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((m) => {
          if (m) return m;
          // Only page navigations get an HTML fallback. Doing it for every
          // failed request means an API/JSON call that fails offline receives
          // HTML, and the caller's res.json() throws a confusing parse error
          // instead of a clean network error.
          // Navigations with no cached copy get a small offline page — never
          // another route's HTML.
          if (event.request.mode === "navigate") return offlineResponse();
          return Response.error();
        })
      )
  );
});
