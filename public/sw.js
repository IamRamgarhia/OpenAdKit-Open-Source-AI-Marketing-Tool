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

  // Network-first for the app shell; fall back to cache when offline. This
  // automatically picks up every new route the app adds (Launch Wizard, Batch,
  // Reel Ideas, Reel Teardown, etc.) on first visit.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((m) => {
          if (m) return m;
          // Only hand back the app shell for actual page navigations. Doing it
          // for every failed request means an API/JSON call that fails offline
          // receives HTML, and the caller's res.json() throws a confusing
          // parse error instead of a clean network error.
          if (event.request.mode === "navigate") return caches.match("/");
          return Response.error();
        })
      )
  );
});
