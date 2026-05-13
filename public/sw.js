// AdForge service worker — offline shell only.
// We DO NOT cache or proxy LLM provider / ingest API calls — those always go
// live so stale responses never leak.
const VERSION = "adforge-v2";
const SHELL = ["/", "/setup", "/manifest.webmanifest"];

// Any GET request whose hostname includes one of these strings is left
// untouched by the service worker (no cache read, no cache write).
const NEVER_INTERCEPT_HOSTS = [
  // LLM providers (vision + text)
  "anthropic.com",
  "openai.com",
  "googleapis.com",        // Gemini lives at generativelanguage.googleapis.com
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

  // Never cache the local launcher sidecar — it's stateful, ports change.
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    // Allow same-origin app shell caching; skip sidecar API endpoints.
    if (url.port === "3006" || url.pathname.startsWith("/status") || url.pathname.startsWith("/snapshot") || url.pathname.startsWith("/diagnostics")) {
      return;
    }
  }

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
      .catch(() => caches.match(event.request).then((m) => m || caches.match("/")))
  );
});
