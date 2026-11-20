/**
 * Web-side client for the local-sync sidecar (scripts/local-sync.cjs).
 *
 * Auto-detects the sidecar via lib/sync-endpoint.ts, which resolves the port
 * the launcher actually chose instead of assuming 3006. When available:
 *   - On app start, fetches the snapshot and MERGES it into IndexedDB (per-row
 *     last-write-wins on updated_at, hard deletes via tombstones — see
 *     mergeSnapshot() in lib/storage.ts) + a filtered set of localStorage prefs
 *   - On every brain/ad/campaign change, debounce-pushes the full snapshot back
 *
 * If the sidecar isn't running, this whole module no-ops silently — the app
 * still works the same way, just without folder-portable persistence.
 *
 * API keys, the key-vault's salt/check, quota counters and sync bookkeeping are
 * NEVER written to (or read from) the snapshot — see isSyncablePrefKey().
 */

import { isHostedMode } from "./env";
import { resolveSyncOrigin, getSyncOrigin } from "./sync-endpoint";

const SYNC_DEBOUNCE_MS = 1500;
const LS_INCLUDE_KEYS = "ados.sync_include_keys";
const LS_LAST_SYNC = "ados.sync_last_at";

let _available: boolean | null = null;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _booted = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export async function detectSync(): Promise<boolean> {
  if (!isBrowser()) return false;
  // Only cache a POSITIVE probe. A failed probe must not pin `false` forever —
  // a sidecar started after page load should still be detectable on re-probe.
  if (_available === true) return true;
  const origin = await resolveSyncOrigin();
  if (origin) _available = true;
  return Boolean(origin);
}

/**
 * @deprecated API keys are never synced any more (see isSyncablePrefKey); the
 * flag is kept only so the existing Settings toggle doesn't break. It has no
 * effect on what is written to the snapshot.
 */
export function isSyncIncludingKeys(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(LS_INCLUDE_KEYS) === "1";
  } catch {
    return false;
  }
}
/** @deprecated See isSyncIncludingKeys — no effect on the snapshot. */
export function setSyncIncludeKeys(v: boolean): void {
  if (!isBrowser()) return;
  try {
    if (v) window.localStorage.setItem(LS_INCLUDE_KEYS, "1");
    else window.localStorage.removeItem(LS_INCLUDE_KEYS);
  } catch {}
}

export function getLastSyncAt(): number {
  if (!isBrowser()) return 0;
  try {
    return Number(window.localStorage.getItem(LS_LAST_SYNC) || 0);
  } catch {
    return 0;
  }
}

interface Snapshot {
  version: 1;
  exported_at: number;
  brains?: unknown[];
  ads?: unknown[];
  campaigns?: unknown[];
  templates?: unknown[];
  checklist?: unknown[];
  custom_items?: unknown[];
  brain_versions?: unknown[];
  tombstones?: unknown[];
  prefs?: Record<string, string>;
}

/**
 * Which localStorage entries may travel in the snapshot (in either direction).
 *
 * Excluded, always:
 *  - ados.vault.*  — per-browser key-vault salt / verifier / enabled flag.
 *                    Syncing these into a second browser replaced its salt,
 *                    making every key it had encrypted undecryptable.
 *  - API keys      — ados.provider.<id>.key, ados.jina_key, legacy
 *                    ados.api_key, and anything else named like a
 *                    key/secret/token/password. The snapshot is a plain JSON
 *                    file on disk; keys never go there, opt-in or not.
 *  - ados.quota.*  — per-browser rate-limit bookkeeping.
 *  - ados.sync_*   — this module's own per-browser state.
 */
export function isSyncablePrefKey(k: string): boolean {
  if (!k.startsWith("ados.")) return false;
  if (k.startsWith("ados.vault.")) return false;
  if (k.startsWith("ados.quota.")) return false;
  if (k.startsWith("ados.sync_")) return false;
  if (/^ados\.provider\..+\.key$/.test(k)) return false;
  if (k === "ados.jina_key" || k === "ados.api_key") return false;
  if (/(^|[._])(api_?key|key|secret|token|password)$/i.test(k)) return false;
  return true;
}

function collectPrefs(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isBrowser()) return out;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !isSyncablePrefKey(k)) continue;
      out[k] = ls.getItem(k) ?? "";
    }
  } catch {}
  return out;
}

async function buildSnapshot(): Promise<Snapshot> {
  const { exportAll } = await import("./storage");
  const json = await exportAll();
  const parsed = JSON.parse(json);
  return {
    version: 1,
    exported_at: Date.now(),
    brains: parsed.brains,
    ads: parsed.ads,
    campaigns: parsed.campaigns,
    templates: parsed.templates,
    checklist: parsed.checklist,
    custom_items: parsed.custom_items,
    brain_versions: parsed.brain_versions,
    tombstones: parsed.tombstones ?? [],
    prefs: collectPrefs(),
  };
}

async function applySnapshot(snap: Snapshot): Promise<void> {
  if (!snap || typeof snap !== "object") return;
  // Preferences are restored ONLY when the snapshot is newer than our last
  // successful push. Previously every pref was overwritten on every page load,
  // unconditionally — so changing your model (or budget, language, tone) and
  // navigating within the 1.5s push debounce silently reverted it, and two open
  // tabs could fight over settings indefinitely. Data (brains/ads) still merges
  // every time; only the small last-write-wins prefs bag is gated.
  const snapshotAt = Number(snap.exported_at) || 0;
  const lastLocalPush = getLastSyncAt();
  const snapshotIsNewer = snapshotAt > lastLocalPush;
  if (snap.prefs && isBrowser() && snapshotIsNewer) {
    try {
      for (const [k, v] of Object.entries(snap.prefs)) {
        // Same filter on the way IN: a snapshot written by an older version
        // may still carry vault salts / keys / quota state.
        if (typeof v === "string" && isSyncablePrefKey(k)) window.localStorage.setItem(k, v);
      }
    } catch {}
  }
  // Per-row merge (newer updated_at wins, tombstones suppress deleted rows).
  // This used to be importAll(), i.e. a blind bulkPut: an older snapshot
  // reverted newer local edits and resurrected hard-deleted rows on every pull.
  const { mergeSnapshot, getBrain } = await import("./storage");
  await mergeSnapshot({
    brains: snap.brains ?? [],
    ads: snap.ads ?? [],
    campaigns: snap.campaigns ?? [],
    templates: snap.templates ?? [],
    checklist: snap.checklist ?? [],
    custom_items: snap.custom_items ?? [],
    brain_versions: snap.brain_versions ?? [],
    tombstones: snap.tombstones ?? [],
  });
  // Reconcile active brain: if the snapshot restored an active_brain ID that points
  // at a now-deleted brain, clear it so downstream tools don't run with null context. (Audit finding #4.)
  if (isBrowser()) {
    try {
      const activeId = window.localStorage.getItem("ados.active_brain");
      if (activeId) {
        const exists = await getBrain(activeId);
        if (!exists) window.localStorage.removeItem("ados.active_brain");
      }
    } catch {}
  }
  window.dispatchEvent(new Event("ados:brains-changed"));
}

export async function pullSnapshot(): Promise<{ ok: boolean; merged: boolean; bytes?: number; reason?: string }> {
  const ok = await detectSync();
  if (!ok) return { ok: false, merged: false, reason: "sync sidecar not running" };
  try {
    const r = await fetch(`${getSyncOrigin()}/snapshot`, { method: "GET", cache: "no-store" });
    if (!r.ok) return { ok: false, merged: false, reason: `sidecar returned ${r.status}` };
    const snap = (await r.json()) as Snapshot;
    const SYNCED_ARRAYS = [
      "brains", "ads", "campaigns", "templates", "checklist", "custom_items", "brain_versions", "tombstones",
    ] as const;
    const hasData =
      !!snap && typeof snap === "object" && SYNCED_ARRAYS.some((k) => Array.isArray(snap[k]) && snap[k]!.length > 0);
    if (hasData) {
      await applySnapshot(snap);
      return { ok: true, merged: true };
    }
    return { ok: true, merged: false };
  } catch (e: any) {
    return { ok: false, merged: false, reason: e?.message ?? "unknown" };
  }
}

type PushResult = { ok: boolean; bytes?: number; reason?: string };

// In-flight guard so two tabs that both fire `ados:brains-changed` don't both
// build a stale snapshot from their local IndexedDB and overwrite each other.
// Web Locks API serializes the actual push across tabs in the same browser.
// (Audit finding #28.)
//
// Coalescing: a push requested while one is in flight used to just get the
// in-flight promise back — but that push's snapshot was built BEFORE the new
// change, so the change sat unsynced until the next debounce/5-minute tick.
// Now such a request marks the state dirty and the running job performs one
// more push (built from fresh data) before resolving. Any number of requests
// during one push collapse into a single follow-up.
let _pushInFlight: Promise<PushResult> | null = null;
let _pushDirty = false;

async function pushOnce(): Promise<PushResult> {
  const ok = await detectSync();
  if (!ok) return { ok: false, reason: "sync sidecar not running" };
  const runPush = async (): Promise<PushResult> => {
    try {
      const snap = await buildSnapshot();
      const body = JSON.stringify(snap);
      const r = await fetch(`${getSyncOrigin()}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!r.ok) return { ok: false, reason: `sidecar returned ${r.status}` };
      if (isBrowser()) {
        try {
          window.localStorage.setItem(LS_LAST_SYNC, String(Date.now()));
        } catch {}
      }
      return { ok: true, bytes: body.length };
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? "unknown" };
    }
  };
  // Use the cross-tab lock when available so concurrent pushes from two tabs
  // serialize on the sidecar. Falls back to in-tab guard on older browsers.
  if (isBrowser() && (navigator as any)?.locks?.request) {
    return (navigator as any).locks.request("openadkit:snapshot-push", { mode: "exclusive" }, runPush);
  }
  return runPush();
}

export function pushSnapshotNow(): Promise<PushResult> {
  if (_pushInFlight) {
    // Resolves after the follow-up push that includes the caller's change.
    _pushDirty = true;
    return _pushInFlight;
  }
  const job = (async () => {
    try {
      let result: PushResult;
      do {
        _pushDirty = false;
        result = await pushOnce();
        // Stop on failure: the periodic/debounced push will retry, and looping
        // against a dead sidecar would just spin.
      } while (_pushDirty && result.ok);
      return result;
    } finally {
      // Cleared synchronously with the final dirty check, so there's no gap in
      // which a new request could attach to a job that has already finished.
      _pushInFlight = null;
      _pushDirty = false;
    }
  })();
  _pushInFlight = job;
  return job;
}

export function debouncedPush(): void {
  if (!isBrowser()) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushSnapshotNow().catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Called once on app startup. Pulls latest snapshot, then installs listeners
 * that auto-push on every brand/ad change.
 */
export async function bootLocalSync(): Promise<{ enabled: boolean; pulled: boolean; reason?: string }> {
  if (_booted || !isBrowser()) return { enabled: _booted, pulled: false };
  // In hosted mode, skip the network probe + interval timer entirely. The
  // sidecar can't exist when the app is served from a non-loopback origin,
  // so probing it is pure waste (~1 failed fetch per page load).
  if (isHostedMode()) return { enabled: false, pulled: false, reason: "hosted mode (no sidecar)" };
  // Set synchronously BEFORE the first await so a second concurrent
  // bootLocalSync() sees `_booted` and bails — otherwise the check-then-act gap
  // lets both calls install duplicate listeners + intervals.
  _booted = true;
  const ok = await detectSync();
  if (!ok) {
    return { enabled: false, pulled: false, reason: "sync sidecar not running" };
  }
  const pull = await pullSnapshot();
  // Push on any state change
  const onChange = () => debouncedPush();
  window.addEventListener("ados:brains-changed", onChange);
  window.addEventListener("ados:usage", onChange);
  // Periodic safety push every 5 min in case events miss
  setInterval(() => debouncedPush(), 5 * 60 * 1000);
  return { enabled: true, pulled: pull.merged ?? false };
}
