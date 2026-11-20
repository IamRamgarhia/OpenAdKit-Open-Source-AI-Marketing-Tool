import { describe, it, expect, vi, afterEach } from "vitest";

async function load() {
  vi.resetModules();
  return import("@/lib/sync-endpoint");
}

describe("candidateSyncOrigins — build-time port env naming", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_OPENADKIT_SYNC_PORT over the legacy ADFORGE name", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPENADKIT_SYNC_PORT", "45001");
    vi.stubEnv("NEXT_PUBLIC_ADFORGE_SYNC_PORT", "45002");
    const { candidateSyncOrigins } = await load();
    expect(candidateSyncOrigins()[0]).toBe("http://127.0.0.1:45001");
    expect(candidateSyncOrigins()).not.toContain("http://127.0.0.1:45002");
  });

  it("falls back to NEXT_PUBLIC_ADFORGE_SYNC_PORT", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPENADKIT_SYNC_PORT", "");
    vi.stubEnv("NEXT_PUBLIC_ADFORGE_SYNC_PORT", "45002");
    const { candidateSyncOrigins } = await load();
    expect(candidateSyncOrigins()[0]).toBe("http://127.0.0.1:45002");
  });

  it("uses only the fallback ports when neither is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPENADKIT_SYNC_PORT", "");
    vi.stubEnv("NEXT_PUBLIC_ADFORGE_SYNC_PORT", "");
    const { candidateSyncOrigins } = await load();
    expect(candidateSyncOrigins()).toEqual(["http://127.0.0.1:3006", "http://127.0.0.1:41574"]);
  });
});
