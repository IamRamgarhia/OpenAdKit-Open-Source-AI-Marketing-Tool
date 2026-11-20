/**
 * Snapshot merge semantics for the local-sync sidecar.
 *
 * Previously a pulled snapshot was bulkPut over every local row: a newer local
 * edit was reverted by an older snapshot, and hard-deleted rows came back on
 * every pull. Now rows merge by updated_at (fallback created_at) and hard
 * deletes are recorded as tombstones that travel with the snapshot.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// storage.db() refuses to run without a window (SSR guard).
(globalThis as any).window ??= globalThis;

type Storage = typeof import("@/lib/storage");
let S: Storage;

beforeAll(async () => {
  S = await import("@/lib/storage");
});

beforeEach(async () => {
  await S.wipeAll();
});

const DAY = 24 * 60 * 60 * 1000;

function ad(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    brand_id: "b1",
    platform: "meta",
    campaign_type: "awareness",
    title: `ad ${id}`,
    input: {},
    output_json: null,
    output_text: "",
    model_id: "m",
    usage_input_tokens: 0,
    usage_output_tokens: 0,
    cost_usd: 0,
    starred: false,
    status: "draft",
    notes: "",
    created_at: 1000,
    ...extra,
  } as any;
}

describe("mergeRows (pure)", () => {
  it("keeps the newer row by updated_at and falls back to created_at", () => {
    const local = [
      { id: "a", updated_at: 200, v: "local" },
      { id: "b", created_at: 100, v: "local" },
      { id: "c", updated_at: 50, v: "local" },
    ];
    const incoming = [
      { id: "a", updated_at: 100, v: "remote" }, // older → ignored
      { id: "b", created_at: 300, v: "remote" }, // newer via created_at → wins
      { id: "c", updated_at: 50, v: "remote" }, // tie → local kept
      { id: "d", updated_at: 1, v: "remote" }, // new → inserted
    ];
    const { put, del } = S.mergeRows(local, incoming, new Map());
    expect(put.map((r: any) => `${r.id}:${r.v}`).sort()).toEqual(["b:remote", "d:remote"]);
    expect(del).toEqual([]);
  });

  it("tombstones beat older rows (local and incoming) but not newer edits", () => {
    const local = [
      { id: "x", updated_at: 100 },
      { id: "y", updated_at: 900 },
    ];
    const incoming = [
      { id: "z", updated_at: 100 },
      { id: "w", updated_at: 900 },
    ];
    const tombs = new Map([
      ["x", 500],
      ["y", 500],
      ["z", 500],
      ["w", 500],
    ]);
    const { put, del } = S.mergeRows(local, incoming, tombs);
    expect(del).toEqual(["x"]);
    expect(put.map((r: any) => r.id)).toEqual(["w"]);
  });
});

describe("mergeSnapshot (Dexie)", () => {
  it("does not revert a newer local edit with an older snapshot row", async () => {
    await S.saveAd(ad("a1"));
    await S.updateAd("a1", { status: "winner" });
    const local = await S.getAd("a1");
    const stale = { ...ad("a1"), status: "draft", updated_at: (local as any).updated_at - 10_000 };
    await S.mergeSnapshot({ ads: [stale] });
    expect((await S.getAd("a1"))?.status).toBe("winner");
  });

  it("applies a newer snapshot row", async () => {
    await S.saveAd(ad("a1"));
    const newer = { ...ad("a1"), status: "live", updated_at: Date.now() + 60_000 };
    await S.mergeSnapshot({ ads: [newer] });
    expect((await S.getAd("a1"))?.status).toBe("live");
  });

  it("legacy rows without updated_at merge by created_at", async () => {
    await S.mergeSnapshot({ campaigns: [{ id: "c1", brand_id: "b1", name: "old", goal: "", status: "planning", created_at: 10 }] });
    await S.mergeSnapshot({ campaigns: [{ id: "c1", brand_id: "b1", name: "newer", goal: "", status: "planning", created_at: 20 }] });
    expect((await S.getCampaign("c1"))?.name).toBe("newer");
  });

  it("hard-deleted ads / templates / brains do not resurrect from the snapshot", async () => {
    await S.saveAd(ad("a1"));
    await S.saveTemplate({ id: "t1", name: "T", scope: "generate/meta", input: {}, created_at: 1000 });
    const snapshot = JSON.parse(await S.exportAll());
    expect(snapshot.ads).toHaveLength(1);
    expect(snapshot.templates).toHaveLength(1);

    await S.deleteAd("a1");
    await S.deleteTemplate("t1");
    await S.mergeSnapshot(snapshot); // the sidecar still has the pre-delete copy

    expect(await S.getAd("a1")).toBeUndefined();
    expect(await S.listAds({ include_deleted: true })).toHaveLength(0);
    expect(await S.listTemplates()).toHaveLength(0);
  });

  it("deletions propagate to another browser via tombstones in the snapshot", async () => {
    // Browser B has the row...
    await S.saveAd(ad("a1"));
    await S.saveTemplate({ id: "t1", name: "T", scope: "s", input: {}, created_at: 1000 });
    // ...browser A deleted it and pushed a snapshot carrying the tombstones.
    const now = Date.now() + 1000;
    await S.mergeSnapshot({
      ads: [],
      templates: [],
      tombstones: [
        { id: "ads:a1", table: "ads", row_id: "a1", deleted_at: now },
        { id: "templates:t1", table: "templates", row_id: "t1", deleted_at: now },
      ],
    });
    expect(await S.listAds({ include_deleted: true })).toHaveLength(0);
    expect(await S.listTemplates()).toHaveLength(0);
    // And B's next export carries the tombstones forward.
    const exp = JSON.parse(await S.exportAll());
    expect(exp.tombstones.map((t: any) => t.id).sort()).toEqual(["ads:a1", "templates:t1"]);
  });

  it("soft delete (Trash) propagates through updated_at", async () => {
    await S.saveAd(ad("a1"));
    const snap = JSON.parse(await S.exportAll());
    await new Promise((r) => setTimeout(r, 5));
    await S.softDeleteAd("a1");
    await S.mergeSnapshot(snap);
    expect(await S.getAd("a1")).toBeUndefined();
    expect(await S.listAds({ include_deleted: true })).toHaveLength(1);
  });

  it("prunes tombstones older than 90 days", async () => {
    const old = Date.now() - 91 * DAY;
    const fresh = Date.now() - 1 * DAY;
    await S.mergeSnapshot({
      tombstones: [
        { id: "ads:old", table: "ads", row_id: "old", deleted_at: old },
        { id: "ads:new", table: "ads", row_id: "new", deleted_at: fresh },
      ],
    });
    const exp = JSON.parse(await S.exportAll());
    expect(exp.tombstones.map((t: any) => t.id)).toEqual(["ads:new"]);
  });

  it("manual importAll restores rows and clears their tombstones", async () => {
    await S.saveAd(ad("a1"));
    const backup = await S.exportAll();
    await S.deleteAd("a1");
    await S.importAll(backup);
    expect(await S.getAd("a1")).toBeTruthy();
    const exp = JSON.parse(await S.exportAll());
    expect(exp.tombstones).toEqual([]);
    // ...and a later sync merge doesn't re-delete it.
    await S.mergeSnapshot(exp);
    expect(await S.getAd("a1")).toBeTruthy();
  });

  it("brain versions merge without exceeding the per-brand cap", async () => {
    const brain = { id: "b1", business_name: "Acme", name: "Acme", created_at: 1, updated_at: 1 } as any;
    const versions = Array.from({ length: 8 }, (_, i) => ({
      id: `v${i}`,
      brain_id: "b1",
      snapshot: brain,
      created_at: 100 + i,
      reason: "x",
    }));
    await S.mergeSnapshot({ brains: [brain], brain_versions: versions });
    const list = await S.listBrainVersions("b1");
    expect(list.length).toBe(S.MAX_BRAIN_VERSIONS);
    expect(list[0].id).toBe("v7");
  });
});
