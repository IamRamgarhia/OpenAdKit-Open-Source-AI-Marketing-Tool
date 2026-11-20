import Dexie, { type Table } from "dexie";
import { normalizeBrandBrain, type BrandBrain } from "./brand-brain";
import {
  normalizeAd,
  normalizeCampaign,
  normalizeTemplate,
  normalizeChecklistState,
  normalizeCustomItem,
} from "./normalize";

export type Platform =
  | "google"
  | "meta"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "twitter"
  | "display";

export interface GeneratedAd {
  id: string;
  brand_id: string;
  platform: Platform;
  campaign_type: string;
  title: string;
  input: Record<string, unknown>;
  output_json: unknown;
  output_text: string;
  model_id: string;
  usage_input_tokens: number;
  usage_output_tokens: number;
  cost_usd: number;
  starred: boolean;
  status: "draft" | "testing" | "live" | "paused" | "winner" | "loser";
  notes: string;
  created_at: number;
  campaign_id?: string;
  performance?: AdPerformance;
  deleted_at?: number;
  /**
   * The exact user-turn prompt that produced this output.
   *
   * Stored so History can re-run the same generation against a different
   * model/provider and diff the results — otherwise "regenerate" would have to
   * reconstruct the prompt from `input`, which means every generator's builder
   * would need to be importable from the history page.
   *
   * The SYSTEM prompt is deliberately NOT stored: it's derived from the brand
   * brain (2-4 KB per ad if persisted) and rebuilding it at regenerate time
   * picks up any brand edits made since. Absent on ads generated before this
   * field existed — the UI degrades to "not available" for those.
   */
  prompt?: string;
  /** Provider that produced this output, for display alongside model_id. */
  provider_id?: string;
  /** Output budget used for this generation, so Regenerate doesn't truncate. */
  max_tokens?: number;
  /** True when the run included a screenshot (Regenerate can't re-send it). */
  has_image?: boolean;
  /** Last local modification (ms). Drives last-write-wins sync merge. */
  updated_at?: number;
}

export interface AdPerformance {
  live_started_at?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spend_usd?: number;
  revenue_usd?: number;
  updated_at: number;
}

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  goal: string;
  status: "planning" | "live" | "paused" | "done";
  created_at: number;
  notes?: string;
  deleted_at?: number;
  /** Last local modification (ms). Drives last-write-wins sync merge. */
  updated_at?: number;
}

export interface GeneratorTemplate {
  id: string;
  name: string;
  scope: string; // e.g. "generate/google", "generate/meta"
  input: Record<string, unknown>;
  created_at: number;
  updated_at?: number;
}

export interface ChecklistState {
  id: string;
  scope: "daily" | "weekly" | "monthly";
  item_key: string;
  checked: boolean;
  last_completed: number | null;
  streak: number;
}

export interface CustomChecklistItem {
  id: string;
  scope: "daily" | "weekly" | "monthly";
  text: string;
  section: string;
  created_at: number;
}

/**
 * Point-in-time snapshot of a brand brain, written on every save.
 *
 * Brains were overwritten in place with no history, so a re-extraction that
 * came back worse than the original — very easy to trigger, since the whole
 * onboarding flow is "paste a URL and let the model infer" — was unrecoverable.
 * We keep the last MAX_BRAIN_VERSIONS snapshots per brand and let the user
 * restore any of them.
 */
export interface BrainVersion {
  id: string;
  brain_id: string;
  /** Full brain as it existed BEFORE the save that created this version. */
  snapshot: BrandBrain;
  created_at: number;
  /** Short human label, e.g. "before re-extract from URL". */
  reason: string;
}

/** Tables whose hard deletes are recorded as tombstones for sync. */
export type SyncTable = "brains" | "ads" | "campaigns" | "templates" | "custom_items" | "checklist";

/**
 * Record of a HARD delete, so the local-sync merge can tell "deleted here" from
 * "never seen here". Without it a pulled snapshot (which still contains the
 * row) silently resurrected every hard-deleted ad/template/brain. Tombstones
 * ride along in the snapshot so deletions propagate to other browsers, and are
 * pruned after TOMBSTONE_TTL_MS. Soft deletes (Trash, `deleted_at` on the row)
 * don't need one: they are ordinary row edits merged by updated_at.
 */
export interface Tombstone {
  /** `${table}:${row_id}` */
  id: string;
  table: SyncTable;
  row_id: string;
  deleted_at: number;
}

/** Tombstones older than this are dropped. A device that hasn't synced in
 *  longer than this can resurrect a deleted row — an accepted trade-off
 *  against unbounded growth. */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** How many snapshots to retain per brand. Enough to undo a bad extraction
 *  run without letting IndexedDB grow unbounded for heavy agency users. */
export const MAX_BRAIN_VERSIONS = 5;

// Defensive readers for every table live in lib/normalize.ts (dependency-free
// so they stay unit-testable without Dexie). Re-exported here because callers
// think of them as part of the storage surface.
export {
  normalizeAd,
  normalizeCampaign,
  normalizeTemplate,
  normalizeChecklistState,
  normalizeCustomItem,
} from "./normalize";

class AdOSDB extends Dexie {
  brains!: Table<BrandBrain, string>;
  ads!: Table<GeneratedAd, string>;
  checklist!: Table<ChecklistState, string>;
  custom_items!: Table<CustomChecklistItem, string>;
  campaigns!: Table<Campaign, string>;
  templates!: Table<GeneratorTemplate, string>;
  brain_versions!: Table<BrainVersion, string>;
  tombstones!: Table<Tombstone, string>;

  constructor() {
    super("ados");
    this.version(1).stores({
      brains: "id, name, business_name, updated_at",
      ads: "id, brand_id, platform, campaign_type, created_at, starred, status",
      checklist: "id, scope, item_key",
    });
    this.version(2).stores({
      brains: "id, name, business_name, updated_at",
      ads: "id, brand_id, platform, campaign_type, created_at, starred, status",
      checklist: "id, scope, item_key",
      custom_items: "id, scope, section, created_at",
    });
    this.version(3).stores({
      brains: "id, name, business_name, updated_at, deleted_at",
      ads: "id, brand_id, platform, campaign_type, created_at, starred, status, campaign_id, deleted_at",
      checklist: "id, scope, item_key",
      custom_items: "id, scope, section, created_at",
      campaigns: "id, brand_id, status, created_at, deleted_at",
      templates: "id, scope, created_at",
    });
    this.version(4).stores({
      brains: "id, name, business_name, updated_at, deleted_at",
      ads: "id, brand_id, platform, campaign_type, created_at, starred, status, campaign_id, deleted_at",
      checklist: "id, scope, item_key",
      custom_items: "id, scope, section, created_at",
      campaigns: "id, brand_id, status, created_at, deleted_at",
      templates: "id, scope, created_at",
      // Compound-friendly index: we always query by brand, newest first.
      brain_versions: "id, brain_id, created_at",
    });
    // v5: hard-delete tombstones for sync (see Tombstone). Additive — no
    // upgrade function needed.
    this.version(5).stores({
      brains: "id, name, business_name, updated_at, deleted_at",
      ads: "id, brand_id, platform, campaign_type, created_at, starred, status, campaign_id, deleted_at",
      checklist: "id, scope, item_key",
      custom_items: "id, scope, section, created_at",
      campaigns: "id, brand_id, status, created_at, deleted_at",
      templates: "id, scope, created_at",
      brain_versions: "id, brain_id, created_at",
      tombstones: "id, table, deleted_at",
    });
  }
}

let _db: AdOSDB | null = null;
export function db(): AdOSDB {
  if (typeof window === "undefined") {
    throw new Error("db() called on the server — wrap in a browser-only effect.");
  }
  if (!_db) _db = new AdOSDB();
  return _db;
}

export async function saveBrain(brain: BrandBrain, opts?: { reason?: string; skipVersion?: boolean }): Promise<void> {
  // Snapshot the PREVIOUS state before overwriting, so a bad re-extraction is
  // recoverable. Skipped for brand-new brains (nothing to snapshot) and for
  // callers that opt out (e.g. the autosave-on-every-keystroke path, which
  // would otherwise fill the history with noise).
  if (!opts?.skipVersion) {
    try {
      const prev = await db().brains.get(brain.id);
      if (prev) await pushBrainVersion(prev, opts?.reason ?? "before edit");
    } catch {
      // Versioning is best-effort — never block the actual save.
    }
  }
  brain.updated_at = Date.now();
  await db().brains.put(brain);
}

/** Write a snapshot and trim the per-brand history to MAX_BRAIN_VERSIONS. */
export async function pushBrainVersion(snapshot: BrandBrain, reason: string): Promise<void> {
  const row: BrainVersion = {
    id: crypto.randomUUID(),
    brain_id: snapshot.id,
    snapshot: normalizeBrandBrain(snapshot),
    created_at: Date.now(),
    reason: reason.slice(0, 120),
  };
  await db().transaction("rw", db().brain_versions, async () => {
    await db().brain_versions.put(row);
    const all = await db().brain_versions.where("brain_id").equals(snapshot.id).toArray();
    const stale = all
      .sort((a, b) => b.created_at - a.created_at)
      .slice(MAX_BRAIN_VERSIONS)
      .map((v) => v.id);
    if (stale.length) await db().brain_versions.bulkDelete(stale);
  });
}

/** Newest-first version history for one brand. */
export async function listBrainVersions(brain_id: string): Promise<BrainVersion[]> {
  const rows = await db().brain_versions.where("brain_id").equals(brain_id).toArray();
  return rows
    .map((v) => ({ ...v, snapshot: normalizeBrandBrain(v.snapshot) }))
    .sort((a, b) => b.created_at - a.created_at);
}

/**
 * Restore a snapshot over the live brain. The CURRENT state is itself
 * snapshotted first, so restoring is undoable too — otherwise "restore" would
 * be exactly as destructive as the problem it solves.
 */
export async function restoreBrainVersion(version_id: string): Promise<BrandBrain | null> {
  const version = await db().brain_versions.get(version_id);
  if (!version) return null;
  const restored = normalizeBrandBrain(version.snapshot);
  await saveBrain(restored, { reason: "before restoring an earlier version" });
  return restored;
}

/** Hard-delete a row and leave a tombstone so sync doesn't resurrect it. */
async function hardDelete(table: SyncTable, id: string): Promise<void> {
  const d = db();
  await d.transaction("rw", [d.table(table), d.tombstones], async () => {
    await d.table(table).delete(id);
    await d.tombstones.put({ id: `${table}:${id}`, table, row_id: id, deleted_at: Date.now() });
  });
}

/** Delete a custom checklist item (tombstoned so sync can't resurrect it)
 *  and the checked-state rows keyed by it. */
export async function deleteCustomItem(id: string): Promise<void> {
  await hardDelete("custom_items", id);
  await db().checklist.where("item_key").equals(id).delete();
}

export async function deleteBrain(id: string): Promise<void> {
  await hardDelete("brains", id);
}

export async function listBrains(opts?: { include_deleted?: boolean }): Promise<BrandBrain[]> {
  const rows = await db().brains.toArray();
  return rows
    .filter((b: any) => opts?.include_deleted || !b.deleted_at)
    .map((b: any) => normalizeBrandBrain(b))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export async function getBrain(id: string): Promise<BrandBrain | undefined> {
  // Match listBrains semantics: soft-deleted rows must not appear as live.
  // Multi-tab race + snapshot restore can introduce records with deleted_at
  // set; without this filter, callers that look up via getActiveBrainId()
  // would run tools against a "dead" brain. (Audit HIGH-2.)
  const row = await db().brains.get(id);
  if (!row || (row as any).deleted_at) return undefined;
  return normalizeBrandBrain(row);
}

export async function saveAd(ad: GeneratedAd): Promise<void> {
  await db().ads.put({ ...ad, updated_at: Date.now() });
}

export async function listAds(filter?: { brand_id?: string; platform?: Platform; include_deleted?: boolean }): Promise<GeneratedAd[]> {
  let coll = db().ads.orderBy("created_at").reverse();
  const rows = await coll.toArray();
  return rows
    .filter((a) => {
      if (!filter?.include_deleted && a.deleted_at) return false;
      if (filter?.brand_id && a.brand_id !== filter.brand_id) return false;
      if (filter?.platform && a.platform !== filter.platform) return false;
      return true;
    })
    // Normalize on read so a malformed row from an old import can never reach
    // a render site that does `.toFixed()` / `.toLocaleString()` on it.
    .map((a) => normalizeAd(a));
}

export async function getAd(id: string): Promise<GeneratedAd | undefined> {
  const row = await db().ads.get(id);
  if (!row || (row as any).deleted_at) return undefined;
  return normalizeAd(row);
}

export async function deleteAd(id: string): Promise<void> {
  // Hard delete — used by Trash view. For undo-able delete use softDeleteAd().
  await hardDelete("ads", id);
}

// Every mutation stamps updated_at: the sync merge keeps whichever copy of a
// row was modified last, so an unstamped edit would lose to any older copy.
export async function softDeleteAd(id: string): Promise<void> {
  const now = Date.now();
  await db().ads.update(id, { deleted_at: now, updated_at: now });
}

export async function restoreAd(id: string): Promise<void> {
  await db().ads.update(id, { deleted_at: undefined, updated_at: Date.now() });
}

export async function updateAd(id: string, patch: Partial<GeneratedAd>): Promise<void> {
  await db().ads.update(id, { ...patch, updated_at: Date.now() });
}

export async function softDeleteBrain(id: string): Promise<void> {
  const now = Date.now();
  await db().brains.update(id, { deleted_at: now, updated_at: now });
}
export async function restoreBrain(id: string): Promise<void> {
  await db().brains.update(id, { deleted_at: undefined, updated_at: Date.now() });
}

// --- Campaigns ---
export async function listCampaigns(brand_id?: string): Promise<Campaign[]> {
  const rows = await db().campaigns.toArray();
  return rows
    .filter((c) => !c.deleted_at)
    .filter((c) => !brand_id || c.brand_id === brand_id)
    .map((c) => normalizeCampaign(c))
    .sort((a, b) => b.created_at - a.created_at);
}
export async function saveCampaign(c: Campaign): Promise<void> {
  await db().campaigns.put({ ...c, updated_at: Date.now() });
}
export async function deleteCampaign(id: string): Promise<void> {
  const now = Date.now();
  await db().campaigns.update(id, { deleted_at: now, updated_at: now });
}
export async function getCampaign(id: string): Promise<Campaign | undefined> {
  // listCampaigns filters deleted_at; getCampaign was returning soft-deleted rows.
  // Callers that operate on the returned campaign by ID would happily display
  // or generate against deleted data. (Audit finding #27.)
  const row = await db().campaigns.get(id);
  if (!row || row.deleted_at) return undefined;
  return normalizeCampaign(row);
}

// --- Performance ---
export async function logPerformance(ad_id: string, p: Partial<AdPerformance>): Promise<void> {
  // Read-merge-update must be atomic — concurrent calls would otherwise read the
  // same base row and clobber each other's partial performance updates.
  await db().transaction("rw", db().ads, async () => {
    const ad = await db().ads.get(ad_id);
    if (!ad) return;
    const merged: AdPerformance = { ...(ad.performance ?? { updated_at: 0 }), ...p, updated_at: Date.now() };
    await db().ads.update(ad_id, { performance: merged, updated_at: Date.now() });
  });
}

// --- Generator templates ---
export async function listTemplates(scope?: string): Promise<GeneratorTemplate[]> {
  const rows = await db().templates.toArray();
  return rows
    .filter((t) => !scope || t.scope === scope)
    .map((t) => normalizeTemplate(t))
    .sort((a, b) => b.created_at - a.created_at);
}
export async function saveTemplate(t: GeneratorTemplate): Promise<void> {
  await db().templates.put({ ...t, updated_at: Date.now() });
}
export async function deleteTemplate(id: string): Promise<void> {
  await hardDelete("templates", id);
}

// --- Winning angles (performance-aware) ---
export async function winningAnglesForBrand(brand_id: string): Promise<{ angle: string; wins: number }[]> {
  const ads = await listAds({ brand_id });
  const counts: Record<string, number> = {};
  for (const a of ads) {
    if (a.status === "winner" || a.starred) {
      const angles = extractAnglesFromOutput(a.output_text);
      for (const ang of angles) counts[ang] = (counts[ang] ?? 0) + 1;
    }
    // Performance-based: ROAS > 2× or CTR > 2%
    const p = a.performance;
    if (p && p.spend_usd && p.revenue_usd && p.revenue_usd / Math.max(1, p.spend_usd) >= 2) {
      const angles = extractAnglesFromOutput(a.output_text);
      for (const ang of angles) counts[ang] = (counts[ang] ?? 0) + 2;
    }
  }
  return Object.entries(counts)
    .map(([angle, wins]) => ({ angle, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 8);
}

function extractAnglesFromOutput(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /"angle"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

export async function exportBrain(id: string): Promise<string> {
  const brain = await getBrain(id);
  if (!brain) throw new Error("Brain not found");
  return JSON.stringify({ version: 1, type: "brand_brain", brain }, null, 2);
}

export async function importBrain(json: string): Promise<BrandBrain> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Invalid brain JSON");
  }
  const raw = data?.brain ?? data;
  if (!raw?.business_name) throw new Error("Invalid brain JSON");
  // Normalize first so any old-schema brain gets every field (favicon_url, website_url,
  // pending_user_input, ...) backfilled before write. (Audit finding #3.)
  const brain = normalizeBrandBrain(raw);
  brain.id = brain.id || crypto.randomUUID();
  brain.created_at = brain.created_at || Date.now();
  // Route through saveBrain so an import that lands on an EXISTING brand id
  // snapshots the current version first — importing a stale export over a
  // brain you've since improved is otherwise unrecoverable.
  await saveBrain(brain, { reason: "before importing a brain file" });
  return brain;
}

export async function exportAll(): Promise<string> {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const [brains, ads, checklist, custom_items, campaigns, templates, brain_versions, allTombstones] = await Promise.all([
    db().brains.toArray(),
    db().ads.toArray(),
    db().checklist.toArray(),
    db().custom_items.toArray(),
    db().campaigns.toArray(),
    db().templates.toArray(),
    db().brain_versions.toArray(),
    db().tombstones.toArray(),
  ]);
  const tombstones = allTombstones.filter((t) => t.deleted_at >= cutoff);
  return JSON.stringify(
    { version: 5, exported_at: Date.now(), brains, ads, checklist, custom_items, campaigns, templates, brain_versions, tombstones },
    null,
    2
  );
}

export async function importAll(json: string): Promise<{ brains: number; ads: number; campaigns: number; templates: number }> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Invalid backup file");
  }
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  await db().transaction(
    "rw",
    [db().brains, db().ads, db().checklist, db().custom_items, db().campaigns, db().templates, db().brain_versions, db().tombstones],
    async () => {
      // An explicit restore wins over earlier deletes: drop the tombstones of
      // every row being restored, or the next sync merge would delete them again.
      const restoredTombs: string[] = [];
      for (const t of SYNC_TABLES) {
        const rows = data[t];
        if (!Array.isArray(rows)) continue;
        for (const r of rows) if (r && typeof r.id === "string") restoredTombs.push(`${t}:${r.id}`);
      }
      if (restoredTombs.length) await db().tombstones.bulkDelete(restoredTombs);
      // EVERY table is normalized on import — a backup is arbitrary
      // user-supplied JSON. Previously only brains were, so an ad row missing
      // cost_usd/usage_* crashed /history and the dashboard on render.
      if (Array.isArray(data.brains)) await db().brains.bulkPut(data.brains.map((b: any) => normalizeBrandBrain(b)));
      if (Array.isArray(data.ads)) await db().ads.bulkPut(data.ads.map((a: any) => normalizeAd(a)));
      if (Array.isArray(data.checklist)) await db().checklist.bulkPut(data.checklist.map((c: any) => normalizeChecklistState(c)));
      if (Array.isArray(data.custom_items)) await db().custom_items.bulkPut(data.custom_items.map((c: any) => normalizeCustomItem(c)));
      if (Array.isArray(data.campaigns)) await db().campaigns.bulkPut(data.campaigns.map((c: any) => normalizeCampaign(c)));
      if (Array.isArray(data.templates)) await db().templates.bulkPut(data.templates.map((t: any) => normalizeTemplate(t)));
      if (Array.isArray(data.brain_versions)) {
        await db().brain_versions.bulkPut(
          data.brain_versions
            .filter((v: any) => v && typeof v.brain_id === "string" && v.snapshot)
            .map((v: any) => ({
              id: typeof v.id === "string" && v.id ? v.id : crypto.randomUUID(),
              brain_id: v.brain_id,
              snapshot: normalizeBrandBrain(v.snapshot),
              created_at: Number.isFinite(Number(v.created_at)) ? Number(v.created_at) : Date.now(),
              reason: typeof v.reason === "string" ? v.reason : "imported",
            }))
        );
      }
    }
  );
  return {
    brains: data.brains?.length ?? 0,
    ads: data.ads?.length ?? 0,
    campaigns: data.campaigns?.length ?? 0,
    templates: data.templates?.length ?? 0,
  };
}

// --- Local-sync merge --------------------------------------------------------

const SYNC_TABLES: SyncTable[] = ["brains", "ads", "campaigns", "templates", "custom_items", "checklist"];

function finitePositive(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Modification time used for last-write-wins: updated_at, else created_at
 *  (rows written before updated_at existed), else last_completed (checklist). */
export function rowTimestamp(row: unknown): number {
  const r = (row ?? {}) as Record<string, unknown>;
  return finitePositive(r.updated_at) ?? finitePositive(r.created_at) ?? finitePositive(r.last_completed) ?? 0;
}

/**
 * Pure per-table merge. Returns the incoming rows to write and the local ids
 * to delete.
 *  - An incoming row is written only if it's new here or strictly newer than
 *    the local copy (ties keep local, so an un-stamped legacy row never
 *    reverts a local edit).
 *  - A tombstone suppresses any row (local or incoming) not modified after
 *    the delete; a row edited after the delete survives.
 */
export function mergeRows(
  local: { id: string }[],
  incoming: unknown[],
  tombstones: Map<string, number>
): { put: any[]; del: string[] } {
  const localById = new Map(local.map((r) => [r.id, r]));
  const put: any[] = [];
  const seen = new Set<string>();
  for (const raw of incoming) {
    const row = raw as Record<string, unknown> | null;
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const ts = rowTimestamp(row);
    const tomb = tombstones.get(row.id);
    if (tomb !== undefined && tomb >= ts) continue;
    const mine = localById.get(row.id);
    if (!mine || ts > rowTimestamp(mine)) put.push(row);
  }
  const del: string[] = [];
  for (const [id, deletedAt] of tombstones) {
    const mine = localById.get(id);
    if (mine && rowTimestamp(mine) <= deletedAt) del.push(id);
  }
  return { put, del };
}

function normalizeForTable(table: SyncTable, raw: any): any {
  let out: any;
  switch (table) {
    case "brains":
      out = normalizeBrandBrain(raw);
      // normalizeBrandBrain defaults a missing updated_at to "now", which would
      // make an old legacy row look brand new — use its real age instead.
      out.updated_at = finitePositive(raw?.updated_at) ?? rowTimestamp(raw);
      return out;
    case "ads":
      out = normalizeAd(raw);
      break;
    case "campaigns":
      out = normalizeCampaign(raw);
      break;
    case "templates":
      out = normalizeTemplate(raw);
      break;
    case "custom_items":
      out = normalizeCustomItem(raw);
      break;
    case "checklist":
      out = normalizeChecklistState(raw);
      break;
  }
  // The normalizers predate updated_at and drop it; carry it through.
  const u = finitePositive(raw?.updated_at);
  if (u !== null) out.updated_at = u;
  return out;
}

function parseTombstones(v: unknown): Tombstone[] {
  if (!Array.isArray(v)) return [];
  const out: Tombstone[] = [];
  for (const t of v) {
    if (!t || typeof t !== "object") continue;
    const table = (t as any).table;
    const row_id = (t as any).row_id;
    const deleted_at = finitePositive((t as any).deleted_at);
    if (!SYNC_TABLES.includes(table) || typeof row_id !== "string" || !row_id || deleted_at === null) continue;
    out.push({ id: `${table}:${row_id}`, table, row_id, deleted_at });
  }
  return out;
}

export interface MergeInput {
  brains?: unknown[];
  ads?: unknown[];
  campaigns?: unknown[];
  templates?: unknown[];
  custom_items?: unknown[];
  checklist?: unknown[];
  brain_versions?: unknown[];
  tombstones?: unknown[];
}

/**
 * Merge a sidecar snapshot into IndexedDB without losing local work.
 * Used by lib/local-sync.ts on pull (importAll() stays the explicit
 * "restore this backup" path, which overwrites).
 */
export async function mergeSnapshot(data: MergeInput): Promise<{ written: number; deleted: number }> {
  if (!data || typeof data !== "object") return { written: 0, deleted: 0 };
  const d = db();
  const now = Date.now();
  const cutoff = now - TOMBSTONE_TTL_MS;
  let written = 0;
  let deleted = 0;
  await d.transaction(
    "rw",
    [d.brains, d.ads, d.checklist, d.custom_items, d.campaigns, d.templates, d.brain_versions, d.tombstones],
    async () => {
      // 1. Union local + incoming tombstones (newest delete wins), drop expired.
      const tombs = new Map<string, Tombstone>();
      for (const t of [...(await d.tombstones.toArray()), ...parseTombstones(data.tombstones)]) {
        const prev = tombs.get(t.id);
        if (!prev || t.deleted_at > prev.deleted_at) tombs.set(t.id, t);
      }
      const expired: string[] = [];
      for (const [id, t] of tombs) {
        if (t.deleted_at < cutoff) {
          expired.push(id);
          tombs.delete(id);
        }
      }

      // 2. Per-table row merge.
      const revived = new Set<string>();
      for (const table of SYNC_TABLES) {
        const tableTombs = new Map<string, number>();
        for (const t of tombs.values()) if (t.table === table) tableTombs.set(t.row_id, t.deleted_at);
        const incoming = Array.isArray(data[table]) ? (data[table] as unknown[]) : [];
        if (!incoming.length && !tableTombs.size) continue;
        const local = (await d.table(table).toArray()) as { id: string }[];
        const { put, del } = mergeRows(local, incoming, tableTombs);
        if (put.length) {
          await d.table(table).bulkPut(put.map((r) => normalizeForTable(table, r)));
          for (const r of put) if (tableTombs.has(r.id)) revived.add(`${table}:${r.id}`);
        }
        if (del.length) await d.table(table).bulkDelete(del);
        written += put.length;
        deleted += del.length;
      }

      // 3. Persist the merged tombstone set (so deletions keep propagating).
      if (expired.length || revived.size) await d.tombstones.bulkDelete([...expired, ...revived]);
      const keep = [...tombs.values()].filter((t) => !revived.has(t.id));
      if (keep.length) await d.tombstones.bulkPut(keep);

      // 4. Brain versions are immutable: add unknown ones, then re-apply the
      //    per-brand cap (otherwise trimmed versions come back on every pull).
      if (Array.isArray(data.brain_versions)) {
        const have = new Set((await d.brain_versions.toArray()).map((v) => v.id));
        const fresh: BrainVersion[] = (data.brain_versions as any[])
          .filter(
            (v) =>
              v && typeof v.id === "string" && v.id && !have.has(v.id) && typeof v.brain_id === "string" && v.snapshot
          )
          .map((v) => ({
            id: v.id as string,
            brain_id: v.brain_id as string,
            snapshot: normalizeBrandBrain(v.snapshot),
            created_at: Number.isFinite(Number(v.created_at)) ? Number(v.created_at) : now,
            reason: typeof v.reason === "string" ? v.reason : "synced",
          }));
        if (fresh.length) {
          await d.brain_versions.bulkPut(fresh);
          for (const brainId of new Set(fresh.map((v) => v.brain_id))) {
            const all = await d.brain_versions.where("brain_id").equals(brainId).toArray();
            const stale = all
              .sort((a, b) => b.created_at - a.created_at)
              .slice(MAX_BRAIN_VERSIONS)
              .map((v) => v.id);
            if (stale.length) await d.brain_versions.bulkDelete(stale);
          }
        }
      }
    }
  );
  return { written, deleted };
}

export async function wipeAll(): Promise<void> {
  await db().delete();
  _db = null;
}
