import Dexie, { type Table } from "dexie";
import { normalizeBrandBrain, type BrandBrain } from "./brand-brain";

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
}

export interface GeneratorTemplate {
  id: string;
  name: string;
  scope: string; // e.g. "generate/google", "generate/meta"
  input: Record<string, unknown>;
  created_at: number;
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

class AdOSDB extends Dexie {
  brains!: Table<BrandBrain, string>;
  ads!: Table<GeneratedAd, string>;
  checklist!: Table<ChecklistState, string>;
  custom_items!: Table<CustomChecklistItem, string>;
  campaigns!: Table<Campaign, string>;
  templates!: Table<GeneratorTemplate, string>;

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

export async function saveBrain(brain: BrandBrain): Promise<void> {
  brain.updated_at = Date.now();
  await db().brains.put(brain);
}

export async function deleteBrain(id: string): Promise<void> {
  await db().brains.delete(id);
}

export async function listBrains(opts?: { include_deleted?: boolean }): Promise<BrandBrain[]> {
  const rows = await db().brains.toArray();
  return rows
    .filter((b: any) => opts?.include_deleted || !b.deleted_at)
    .map((b: any) => normalizeBrandBrain(b))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export async function getBrain(id: string): Promise<BrandBrain | undefined> {
  const row = await db().brains.get(id);
  return row ? normalizeBrandBrain(row) : undefined;
}

export async function saveAd(ad: GeneratedAd): Promise<void> {
  await db().ads.put(ad);
}

export async function listAds(filter?: { brand_id?: string; platform?: Platform; include_deleted?: boolean }): Promise<GeneratedAd[]> {
  let coll = db().ads.orderBy("created_at").reverse();
  const rows = await coll.toArray();
  return rows.filter((a) => {
    if (!filter?.include_deleted && a.deleted_at) return false;
    if (filter?.brand_id && a.brand_id !== filter.brand_id) return false;
    if (filter?.platform && a.platform !== filter.platform) return false;
    return true;
  });
}

export async function deleteAd(id: string): Promise<void> {
  // Hard delete — used by Trash view. For undo-able delete use softDeleteAd().
  await db().ads.delete(id);
}

export async function softDeleteAd(id: string): Promise<void> {
  await db().ads.update(id, { deleted_at: Date.now() });
}

export async function restoreAd(id: string): Promise<void> {
  await db().ads.update(id, { deleted_at: undefined });
}

export async function updateAd(id: string, patch: Partial<GeneratedAd>): Promise<void> {
  await db().ads.update(id, patch);
}

export async function softDeleteBrain(id: string): Promise<void> {
  await db().brains.update(id, { deleted_at: Date.now() });
}
export async function restoreBrain(id: string): Promise<void> {
  await db().brains.update(id, { deleted_at: undefined });
}

// --- Campaigns ---
export async function listCampaigns(brand_id?: string): Promise<Campaign[]> {
  const rows = await db().campaigns.toArray();
  return rows
    .filter((c) => !c.deleted_at)
    .filter((c) => !brand_id || c.brand_id === brand_id)
    .sort((a, b) => b.created_at - a.created_at);
}
export async function saveCampaign(c: Campaign): Promise<void> {
  await db().campaigns.put(c);
}
export async function deleteCampaign(id: string): Promise<void> {
  await db().campaigns.update(id, { deleted_at: Date.now() });
}
export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return db().campaigns.get(id);
}

// --- Performance ---
export async function logPerformance(ad_id: string, p: Partial<AdPerformance>): Promise<void> {
  const ad = await db().ads.get(ad_id);
  if (!ad) return;
  const merged: AdPerformance = { ...(ad.performance ?? { updated_at: 0 }), ...p, updated_at: Date.now() };
  await db().ads.update(ad_id, { performance: merged });
}

// --- Generator templates ---
export async function listTemplates(scope?: string): Promise<GeneratorTemplate[]> {
  const rows = await db().templates.toArray();
  return rows
    .filter((t) => !scope || t.scope === scope)
    .sort((a, b) => b.created_at - a.created_at);
}
export async function saveTemplate(t: GeneratorTemplate): Promise<void> {
  await db().templates.put(t);
}
export async function deleteTemplate(id: string): Promise<void> {
  await db().templates.delete(id);
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
  const data = JSON.parse(json);
  const brain: BrandBrain = data?.brain ?? data;
  if (!brain?.business_name) throw new Error("Invalid brain JSON");
  brain.id = brain.id || crypto.randomUUID();
  brain.created_at = brain.created_at || Date.now();
  brain.updated_at = Date.now();
  await db().brains.put(brain);
  return brain;
}

export async function exportAll(): Promise<string> {
  const [brains, ads, checklist, custom_items, campaigns, templates] = await Promise.all([
    db().brains.toArray(),
    db().ads.toArray(),
    db().checklist.toArray(),
    db().custom_items.toArray(),
    db().campaigns.toArray(),
    db().templates.toArray(),
  ]);
  return JSON.stringify(
    { version: 3, exported_at: Date.now(), brains, ads, checklist, custom_items, campaigns, templates },
    null,
    2
  );
}

export async function importAll(json: string): Promise<{ brains: number; ads: number; campaigns: number; templates: number }> {
  const data = JSON.parse(json);
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  await db().transaction(
    "rw",
    [db().brains, db().ads, db().checklist, db().custom_items, db().campaigns, db().templates],
    async () => {
      if (Array.isArray(data.brains)) await db().brains.bulkPut(data.brains);
      if (Array.isArray(data.ads)) await db().ads.bulkPut(data.ads);
      if (Array.isArray(data.checklist)) await db().checklist.bulkPut(data.checklist);
      if (Array.isArray(data.custom_items)) await db().custom_items.bulkPut(data.custom_items);
      if (Array.isArray(data.campaigns)) await db().campaigns.bulkPut(data.campaigns);
      if (Array.isArray(data.templates)) await db().templates.bulkPut(data.templates);
    }
  );
  return {
    brains: data.brains?.length ?? 0,
    ads: data.ads?.length ?? 0,
    campaigns: data.campaigns?.length ?? 0,
    templates: data.templates?.length ?? 0,
  };
}

export async function wipeAll(): Promise<void> {
  await db().delete();
  _db = null;
}
