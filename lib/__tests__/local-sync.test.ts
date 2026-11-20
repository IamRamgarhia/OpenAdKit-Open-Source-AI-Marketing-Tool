/**
 * lib/local-sync.ts — what goes into / comes out of the snapshot's prefs bag,
 * and push coalescing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const storageMock = vi.hoisted(() => ({
  exportAll: vi.fn(async () => JSON.stringify({ brains: [], ads: [], tombstones: [] })),
  mergeSnapshot: vi.fn(async () => ({ written: 0, deleted: 0 })),
  getBrain: vi.fn(async () => undefined),
}));
vi.mock("@/lib/storage", () => storageMock);
vi.mock("@/lib/sync-endpoint", () => ({
  resolveSyncOrigin: async () => "http://127.0.0.1:45555",
  getSyncOrigin: () => "http://127.0.0.1:45555",
}));
vi.mock("@/lib/env", () => ({ isHostedMode: () => false }));

class MemStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

let ls: MemStorage;

beforeEach(() => {
  vi.resetModules();
  ls = new MemStorage();
  vi.stubGlobal("window", {
    localStorage: ls,
    sessionStorage: new MemStorage(),
    dispatchEvent: () => true,
    addEventListener: () => {},
    location: { hostname: "127.0.0.1" },
  });
  // Keep pushes in-process (no Web Locks) so the fake fetch fully controls timing.
  vi.stubGlobal("navigator", {});
  storageMock.mergeSnapshot.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SECRET_PREFS: Record<string, string> = {
  "ados.vault.salt": "c2FsdA==",
  "ados.vault.check": "chk",
  "ados.vault.enabled": "1",
  "ados.provider.anthropic.key": "sk-ant-secret",
  "ados.provider.openai.key": "sk-secret",
  "ados.jina_key": "jina-secret",
  "ados.api_key": "legacy-secret",
  "ados.quota.requests": "[1,2,3]",
  "ados.quota.blocked": "{}",
  "ados.sync_last_at": "123",
  "ados.sync_include_keys": "1",
  "ados.sync_origin": "http://127.0.0.1:1",
};
const SAFE_PREFS: Record<string, string> = {
  "ados.currency": "EUR",
  "ados.default_language": "de",
  "ados.provider.openai.model": "gpt-x",
  "ados.active_provider": "openai",
  "ados.total_input_tokens": "42",
};

describe("isSyncablePrefKey", () => {
  it("excludes vault, API keys, quota and sync bookkeeping; keeps ordinary prefs", async () => {
    const { isSyncablePrefKey } = await import("@/lib/local-sync");
    for (const k of Object.keys(SECRET_PREFS)) expect(isSyncablePrefKey(k), k).toBe(false);
    for (const k of Object.keys(SAFE_PREFS)) expect(isSyncablePrefKey(k), k).toBe(true);
    expect(isSyncablePrefKey("other.app.key")).toBe(false);
  });
});

describe("pushSnapshotNow — snapshot contents", () => {
  it("never writes API keys / vault / quota / sync_* to the snapshot, even with key-sync opted in", async () => {
    for (const [k, v] of Object.entries({ ...SECRET_PREFS, ...SAFE_PREFS })) ls.setItem(k, v);
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return new Response("{}", { status: 200 });
      })
    );
    const { pushSnapshotNow } = await import("@/lib/local-sync");
    const r = await pushSnapshotNow();
    expect(r.ok).toBe(true);
    const snap = JSON.parse(bodies[0]);
    expect(snap.prefs).toEqual(SAFE_PREFS);
    expect(snap.keys).toBeUndefined();
    expect(snap.tombstones).toEqual([]);
    for (const secret of ["sk-ant-secret", "sk-secret", "jina-secret", "legacy-secret", "c2FsdA=="]) {
      expect(bodies[0]).not.toContain(secret);
    }
  });
});

describe("pullSnapshot — applying prefs", () => {
  it("ignores vault/key/quota/sync entries in an incoming snapshot (no clobbering this browser's vault)", async () => {
    ls.setItem("ados.vault.salt", "MINE");
    ls.setItem("ados.provider.openai.key", "my-encrypted-key");
    const snapshot = {
      version: 1,
      exported_at: Date.now() + 10_000,
      brains: [{ id: "b1" }],
      prefs: { ...SECRET_PREFS, "ados.currency": "JPY" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 }))
    );
    const { pullSnapshot } = await import("@/lib/local-sync");
    const r = await pullSnapshot();
    expect(r).toMatchObject({ ok: true, merged: true });
    expect(ls.getItem("ados.vault.salt")).toBe("MINE");
    expect(ls.getItem("ados.provider.openai.key")).toBe("my-encrypted-key");
    expect(ls.getItem("ados.vault.enabled")).toBeNull();
    expect(ls.getItem("ados.quota.requests")).toBeNull();
    expect(ls.getItem("ados.sync_include_keys")).toBeNull();
    expect(ls.getItem("ados.currency")).toBe("JPY");
    // Rows go through the timestamp-aware merge, not a blind overwrite.
    expect(storageMock.mergeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("a snapshot carrying only tombstones is still merged", async () => {
    const snapshot = {
      version: 1,
      exported_at: 1,
      brains: [],
      tombstones: [{ id: "ads:a", table: "ads", row_id: "a", deleted_at: 5 }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 }))
    );
    const { pullSnapshot } = await import("@/lib/local-sync");
    const r = await pullSnapshot();
    expect(r.merged).toBe(true);
    expect(storageMock.mergeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ tombstones: snapshot.tombstones })
    );
  });
});

describe("pushSnapshotNow — coalescing", () => {
  it("a change during an in-flight push triggers exactly one follow-up push", async () => {
    let version = 0;
    storageMock.exportAll.mockImplementation(async () => JSON.stringify({ brains: [{ id: "b", v: version }] }));
    const pending: ((r: Response) => void)[] = [];
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((resolve) => {
            bodies.push(String(init?.body ?? ""));
            pending.push(resolve);
          })
      )
    );
    const { pushSnapshotNow } = await import("@/lib/local-sync");

    const first = pushSnapshotNow();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    // Data changes while push #1 is on the wire; two more callers ask to push.
    version = 1;
    const second = pushSnapshotNow();
    const third = pushSnapshotNow();
    pending[0](new Response("{}", { status: 200 }));

    // Exactly one follow-up push, built from the NEW data.
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(JSON.parse(bodies[1]).brains[0].v).toBe(1);
    pending[1](new Response("{}", { status: 200 }));

    const results = await Promise.all([first, second, third]);
    for (const r of results) expect(r.ok).toBe(true);
    expect(bodies).toHaveLength(2);

    // Idle again: a later push starts fresh.
    const fourth = pushSnapshotNow();
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending[2](new Response("{}", { status: 200 }));
    await expect(fourth).resolves.toMatchObject({ ok: true });
  });

  it("no follow-up push when nothing changed during the push", async () => {
    const calls = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", calls);
    const { pushSnapshotNow } = await import("@/lib/local-sync");
    await pushSnapshotNow();
    expect(calls).toHaveBeenCalledTimes(1);
  });
});
