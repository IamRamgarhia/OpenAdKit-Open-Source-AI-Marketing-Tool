/**
 * Web-side client for the local-sync sidecar (scripts/local-sync.cjs).
 *
 * Auto-detects the sidecar at http://localhost:3006. When available:
 *   - On app start, fetches data/snapshot.json and merges into IndexedDB + localStorage
 *   - On every brain/ad/campaign change, debounce-pushes the full snapshot back
 *
 * If the sidecar isn't running, this whole module no-ops silently — the app
 * still works the same way, just without folder-portable persistence.
 *
 * API keys are NOT synced by default (security). Toggle in Settings to include.
 */

import { isHostedMode } from "./env";

// 127.0.0.1 instead of "localhost" so IPv6-preferring systems (some Windows
// configs) don't resolve to ::1 while the sidecar listens on 127.0.0.1 only.
// Matches url-ingest.ts. (Audit finding #49.)
const SYNC_URL = "http://127.0.0.1:3006";
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
  try {
    const r = await fetch(`${SYNC_URL}/health`, { method: "GET", cache: "no-store" });
    if (r.ok) _available = true;
    return r.ok;
  } catch {
    return false;
  }
}

export function isSyncIncludingKeys(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(LS_INCLUDE_KEYS) === "1";
  } catch {
    return false;
  }
}
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
  prefs?: Record<string, string>;
  keys?: Record<string, string>; // only present if user opts in
}

function collectPrefs(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isBrowser()) return out;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k) continue;
      if (!k.startsWith("ados.")) continue;
      if (k.startsWith("ados.provider.") && k.endsWith(".key") && !isSyncIncludingKeys()) continue;
      if (k === "ados.jina_key" && !isSyncIncludingKeys()) continue;
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
    prefs: collectPrefs(),
  };
}

async function applySnapshot(snap: Snapshot): Promise<void> {
  if (!snap || typeof snap !== "object") return;
  if (snap.prefs && isBrowser()) {
    try {
      for (const [k, v] of Object.entries(snap.prefs)) {
        if (typeof v === "string") window.localStorage.setItem(k, v);
      }
    } catch {}
  }
  const { importAll, getBrain } = await import("./storage");
  await importAll(
    JSON.stringify({
      version: 1,
      brains: snap.brains ?? [],
      ads: snap.ads ?? [],
      campaigns: snap.campaigns ?? [],
      templates: snap.templates ?? [],
      checklist: snap.checklist ?? [],
      custom_items: snap.custom_items ?? [],
    })
  );
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
    const r = await fetch(`${SYNC_URL}/snapshot`, { method: "GET", cache: "no-store" });
    if (!r.ok) return { ok: false, merged: false, reason: `sidecar returned ${r.status}` };
    const snap = (await r.json()) as Snapshot;
    if (snap && (snap.brains?.length || snap.ads?.length || snap.campaigns?.length)) {
      await applySnapshot(snap);
      return { ok: true, merged: true };
    }
    return { ok: true, merged: false };
  } catch (e: any) {
    return { ok: false, merged: false, reason: e?.message ?? "unknown" };
  }
}

// In-flight guard so two tabs that both fire `ados:brains-changed` don't both
// build a stale snapshot from their local IndexedDB and overwrite each other.
// Web Locks API serializes the actual push across tabs in the same browser.
// (Audit finding #28.)
let _pushInFlight: Promise<{ ok: boolean; bytes?: number; reason?: string }> | null = null;

export async function pushSnapshotNow(): Promise<{ ok: boolean; bytes?: number; reason?: string }> {
  if (_pushInFlight) return _pushInFlight;
  const job = (async () => {
    const ok = await detectSync();
    if (!ok) return { ok: false, reason: "sync sidecar not running" };
    const runPush = async () => {
      try {
        const snap = await buildSnapshot();
        const body = JSON.stringify(snap);
        const r = await fetch(`${SYNC_URL}/snapshot`, {
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
    if (isBrowser() && (navigator as any).locks?.request) {
      return (navigator as any).locks.request("openadkit:snapshot-push", { mode: "exclusive" }, runPush);
    }
    return runPush();
  })();
  _pushInFlight = job;
  try { return await job; } finally { _pushInFlight = null; }
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
