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

describe("candidateSyncOrigins — runtime port from /api/runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("puts the runtime port first, ahead of the build-time port", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPENADKIT_SYNC_PORT", "45001");
    const { candidateSyncOrigins } = await load();
    const list = candidateSyncOrigins(46010);
    expect(list[0]).toBe("http://127.0.0.1:46010");
    expect(list[1]).toBe("http://127.0.0.1:45001");
  });

  it("does not duplicate a runtime port equal to the build-time port", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPENADKIT_SYNC_PORT", "45001");
    const { candidateSyncOrigins } = await load();
    const list = candidateSyncOrigins("45001");
    expect(list.filter((o) => o.endsWith(":45001"))).toHaveLength(1);
  });
});

describe("GET /api/runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports the sidecar port from the server environment", async () => {
    vi.stubEnv("OPENADKIT_SYNC_PORT", "47002");
    vi.resetModules();
    const { GET } = await import("@/app/api/runtime/route");
    const body = await GET().json();
    expect(body).toMatchObject({ sync_port: 47002 });
  });

  it("returns null for a missing or malformed port", async () => {
    vi.stubEnv("OPENADKIT_SYNC_PORT", "not-a-port");
    vi.stubEnv("ADFORGE_SYNC_PORT", "");
    vi.resetModules();
    const { GET } = await import("@/app/api/runtime/route");
    expect(await GET().json()).toMatchObject({ sync_port: null });
  });
});

describe("GET /api/runtime — MCP config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports the install's node + MCP script when the sidecar provides them", async () => {
    vi.stubEnv("OPENADKIT_MCP_SCRIPT", "C:/Programs/OpenAdKit/app/mcp/openadkit-mcp.mjs");
    vi.stubEnv("OPENADKIT_NODE", "C:/Programs/OpenAdKit/node/node.exe");
    vi.resetModules();
    const { GET } = await import("@/app/api/runtime/route");
    expect((await GET().json()).mcp).toEqual({
      command: "C:/Programs/OpenAdKit/node/node.exe",
      args: ["C:/Programs/OpenAdKit/app/mcp/openadkit-mcp.mjs"],
    });
  });

  it("returns mcp: null when not available (e.g. hosted)", async () => {
    vi.stubEnv("OPENADKIT_MCP_SCRIPT", "");
    vi.resetModules();
    const { GET } = await import("@/app/api/runtime/route");
    expect((await GET().json()).mcp).toBeNull();
  });
});
