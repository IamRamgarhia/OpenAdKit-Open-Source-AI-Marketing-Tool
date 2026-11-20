/**
 * Per-provider quota tracking. Most providers don't expose a "remaining quota"
 * endpoint, so we track requests locally against documented free-tier limits
 * from lib/provider-limits.ts. Two surfaces:
 *
 *   1. Soft tracking: every LLM call that reaches the provider (success or
 *      HTTP failure) logs a timestamp. We show
 *      "12 / 15 req this minute · resets in 24s" in the StatusBar.
 *
 *   2. Hard signal: when a 429 fires with a Retry-After header, we record
 *      blocked_until = now + retry-after-seconds. StatusBar shows a countdown
 *      until the user can retry.
 *
 * Stored entirely in localStorage. Cleared on the next successful call.
 */

const REQUEST_LOG_KEY = "ados.quota.requests";
const BLOCKED_KEY = "ados.quota.blocked";

interface RequestEntry {
  pid: string;
  ts: number; // ms
}

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

function readLog(): RequestEntry[] {
  const s = safeLocal();
  if (!s) return [];
  try {
    const raw = s.getItem(REQUEST_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Prune entries older than 25 hours so the log stays bounded.
    const cutoff = Date.now() - 25 * 3600 * 1000;
    return parsed.filter((e: any) => e && typeof e.pid === "string" && typeof e.ts === "number" && e.ts > cutoff);
  } catch {
    return [];
  }
}

function writeLog(entries: RequestEntry[]): void {
  const s = safeLocal();
  if (!s) return;
  try { s.setItem(REQUEST_LOG_KEY, JSON.stringify(entries)); } catch {}
}

/** Call this after every successful LLM request. Bumps the rolling counters
 *  and clears any blocked_until state since the request obviously got through. */
export function recordRequest(providerId: string | undefined | null): void {
  if (!providerId) return;
  const entries = readLog();
  entries.push({ pid: providerId, ts: Date.now() });
  writeLog(entries);
  // Successful request means we're no longer blocked.
  clearBlocked(providerId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ados:quota-changed"));
  }
}

/** Call this after a request that reached the provider but FAILED (HTTP error,
 *  429, truncated or refused completion, schema-retry that errored). Providers
 *  count these against RPM/RPD too, so leaving them out under-reported usage
 *  exactly when the user was closest to a limit. Unlike recordRequest it does
 *  NOT clear a blocked_until — a 429 is what sets that. */
export function recordFailedAttempt(providerId: string | undefined | null): void {
  if (!providerId) return;
  const entries = readLog();
  entries.push({ pid: providerId, ts: Date.now() });
  writeLog(entries);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ados:quota-changed"));
  }
}

/** Mark a provider as rate-limited for `seconds` from now. Called from the
 *  providers' readError when status === 429 + retry-after header. */
export function recordRateLimitHit(providerId: string | undefined | null, retryAfterSeconds: number): void {
  if (!providerId || !retryAfterSeconds || retryAfterSeconds <= 0) return;
  const s = safeLocal();
  if (!s) return;
  try {
    const blocked = readBlocked();
    blocked[providerId] = Date.now() + retryAfterSeconds * 1000;
    s.setItem(BLOCKED_KEY, JSON.stringify(blocked));
    window.dispatchEvent(new Event("ados:quota-changed"));
  } catch {}
}

function readBlocked(): Record<string, number> {
  const s = safeLocal();
  if (!s) return {};
  try {
    const raw = s.getItem(BLOCKED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    return {};
  }
}

function clearBlocked(providerId: string): void {
  const s = safeLocal();
  if (!s) return;
  try {
    const blocked = readBlocked();
    if (blocked[providerId]) {
      delete blocked[providerId];
      s.setItem(BLOCKED_KEY, JSON.stringify(blocked));
    }
  } catch {}
}

export interface QuotaSnapshot {
  /** Provider this snapshot is for. */
  providerId: string;
  /** Requests in the last 60 seconds. */
  minute_used: number;
  /** Requests since the start of the current UTC day. */
  day_used: number;
  /** When the oldest entry in the minute window expires (ms). When `now` reaches
   *  this, that one slot frees up. Used to display "resets in Xs". */
  minute_resets_in_seconds: number | null;
  /** Seconds until the next UTC midnight, when the daily (RPD) bucket resets. */
  day_resets_in_seconds: number | null;
  /** If non-null, we know a 429 was returned with a retry-after — the provider
   *  has explicitly told us to wait this many seconds. Higher-priority signal
   *  than the local counters. */
  blocked_for_seconds: number | null;
}

export function getQuotaSnapshot(providerId: string | undefined | null): QuotaSnapshot | null {
  if (!providerId) return null;
  const now = Date.now();
  const entries = readLog().filter((e) => e.pid === providerId);
  const minuteEntries = entries.filter((e) => now - e.ts < 60_000);
  // Provider RPD limits reset on the wall-clock UTC day boundary, not on a
  // rolling 24h window — count requests since the start of the current UTC day.
  const nowDate = new Date(now);
  const startOfUtcDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const nextUtcMidnight = startOfUtcDay + 24 * 3600 * 1000;
  const dayEntries = entries.filter((e) => e.ts >= startOfUtcDay);

  const minute_resets_in_seconds = minuteEntries.length
    ? Math.max(0, Math.ceil((60_000 - (now - Math.min(...minuteEntries.map((e) => e.ts)))) / 1000))
    : null;
  const day_resets_in_seconds = dayEntries.length
    ? Math.max(0, Math.ceil((nextUtcMidnight - now) / 1000))
    : null;

  const blocked = readBlocked();
  const until = blocked[providerId];
  const blocked_for_seconds = until && until > now ? Math.ceil((until - now) / 1000) : null;

  return {
    providerId,
    minute_used: minuteEntries.length,
    day_used: dayEntries.length,
    minute_resets_in_seconds,
    day_resets_in_seconds,
    blocked_for_seconds,
  };
}

/** Free-tier caps, re-exported from the single source of truth.
 *
 *  These used to be a second hardcoded copy here, justified by an import cycle
 *  that doesn't exist (provider-limits.ts imports nothing). The copies had
 *  drifted: this one still claimed Google allowed 1,500 requests/day, which a
 *  live 429 disproved (~20/day on gemini-3.6-flash). */
export { getProviderLimitCaps } from "./provider-limits";

/** Format a seconds count as "12s" / "3m" / "1h 22m". For countdown displays. */
export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.ceil(seconds % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}
