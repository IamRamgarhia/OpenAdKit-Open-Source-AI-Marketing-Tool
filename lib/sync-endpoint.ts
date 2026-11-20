/**
 * Single source of truth for the local-sync sidecar's origin.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The sidecar port used to be hardcoded to 3006 in three separate places
 * (lib/local-sync.ts, lib/url-ingest.ts, public/sw.js) while
 * scripts/resolve-ports.cjs actively moved the sidecar to an OS-assigned or
 * hash-derived high-range port on every launch. Result: on a typical install
 * the browser was talking to a port nothing was listening on, so folder sync
 * silently never ran and URL ingest silently skipped its most reliable reader
 * and fell through to rate-limited third parties — while telling the user
 * "is the launcher running?" when it was.
 *
 * The port now flows one way:
 *   resolve-ports.cjs / local-sync.cjs
 *     -> .env.local (OPENADKIT_SYNC_PORT + NEXT_PUBLIC_OPENADKIT_SYNC_PORT,
 *        plus the legacy ADFORGE_* mirrors)
 *     -> Next inlines NEXT_PUBLIC_* at build time
 *     -> getSyncOrigin() here
 *     -> every browser-side caller
 *
 * `NEXT_PUBLIC_*` is inlined at BUILD time, so a port that shifts after the
 * build (a second install claiming the port, a user editing Settings) would
 * still be stale. To cover that we also probe a short candidate list once per
 * session and remember the origin that answered /health. The probe result is
 * cached in sessionStorage so it costs one request per tab, not one per call.
 */

import { isHostedMode } from "./env";

/** Port baked in at build time by Next from .env.local, when present.
 *  NEXT_PUBLIC_OPENADKIT_SYNC_PORT is canonical; the pre-rebrand
 *  NEXT_PUBLIC_ADFORGE_SYNC_PORT is still honoured as a fallback. Each name is
 *  referenced literally so Next can inline it. */
const BUILD_TIME_PORT =
  process.env.NEXT_PUBLIC_OPENADKIT_SYNC_PORT || process.env.NEXT_PUBLIC_ADFORGE_SYNC_PORT;

/** Historical/default ports worth probing when the build-time value is absent
 *  or wrong. 3006 is what the shell installers still write; 41574 is the
 *  documented high-range default used by start.sh / start.bat. */
const FALLBACK_PORTS = ["3006", "41574"];

const SESSION_KEY = "ados.sync_origin";

function originFor(port: string): string {
  // 127.0.0.1 rather than "localhost" so IPv6-preferring systems don't resolve
  // to ::1 while the sidecar listens on 127.0.0.1 only.
  return `http://127.0.0.1:${port}`;
}

/** Ordered, de-duplicated list of origins worth trying. `runtimePort` (from
 *  the web server's /api/runtime) is the authoritative value for this launch
 *  and goes first; the build-time port and historical defaults follow. */
export function candidateSyncOrigins(runtimePort?: string | number | null): string[] {
  const ports: string[] = [];
  if (runtimePort) ports.push(String(runtimePort));
  if (BUILD_TIME_PORT && !ports.includes(BUILD_TIME_PORT)) ports.push(BUILD_TIME_PORT);
  for (const p of FALLBACK_PORTS) if (!ports.includes(p)) ports.push(p);
  return ports.map(originFor);
}

function readCachedOrigin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function cacheOrigin(origin: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, origin);
  } catch {
    /* private mode — probing again each call is acceptable */
  }
}

/**
 * Best-known sidecar origin without doing any I/O. Use for building URLs when
 * you've already established the sidecar is reachable (or don't care).
 */
export function getSyncOrigin(): string {
  return readCachedOrigin() ?? candidateSyncOrigins()[0];
}

/**
 * Probe candidates and return the first origin whose /health answers, caching
 * the winner for the rest of the session. Returns null when no sidecar is
 * reachable (hosted mode, or the launcher isn't running).
 */
export async function resolveSyncOrigin(force = false): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (isHostedMode()) return null;
  if (!force) {
    const cached = readCachedOrigin();
    if (cached) return cached;
  }
  let runtimePort: number | null = null;
  try {
    const r = await fetch("/api/runtime", { cache: "no-store" });
    if (r.ok) runtimePort = (await r.json())?.sync_port ?? null;
  } catch {
    /* static hosting / older server — fall back to the build-time list */
  }
  for (const origin of candidateSyncOrigins(runtimePort)) {
    try {
      const res = await fetch(`${origin}/health`, { method: "GET", cache: "no-store" });
      if (!res.ok) continue;
      // Confirm it's actually an OpenAdKit sidecar and not some unrelated
      // service that happens to answer /health on that port.
      const body = await res.json().catch(() => null);
      if (!body || body.ok !== true) continue;
      cacheOrigin(origin);
      return origin;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Forget the cached origin — call after the user changes ports in Settings. */
export function clearSyncOriginCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
