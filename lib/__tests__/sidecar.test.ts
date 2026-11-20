/**
 * scripts/local-sync.cjs — pure helpers (required with no side effects) plus
 * an integration test that spawns the real sidecar and talks HTTP to it.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import * as ts from "@/lib/server/url-helpers";

const require = createRequire(import.meta.url);
const SIDECAR = path.resolve(import.meta.dirname, "../../scripts/local-sync.cjs");
const sc = require(SIDECAR);

// ---------------------------------------------------------------------------
// SSRF guard parity
// ---------------------------------------------------------------------------
describe("sidecar isPrivateOrLoopbackHost — aligned with lib/server/url-helpers.ts", () => {
  const blocked = [
    "", "localhost", "127.0.0.1", "127.255.0.1", "10.1.2.3", "192.168.0.1", "172.16.0.1", "172.31.255.255",
    "169.254.169.254", "0.0.0.0",
    // previously missing from the sidecar:
    "100.64.0.1", "100.127.255.254", "198.18.0.1", "198.19.255.255", "192.0.0.8",
    "224.0.0.1", "255.255.255.255",
    "::1", "[::1]", "::", "fe80::1", "[fe80::1]", "febf::1", "fc00::1", "fd12:3456::1", "[fd00::1]", "ff02::1",
    "::ffff:127.0.0.1", "[::ffff:127.0.0.1]", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:10.0.0.1",
    "::ffff:6440:1", // 100.64.0.1 mapped
  ];
  const allowed = [
    "example.com", "8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.255.255", "100.128.0.1",
    "198.17.0.1", "198.20.0.1", "192.0.1.1", "2606:4700::1111", "[2606:4700::1111]", "::ffff:8.8.8.8",
    "fe7f::1", "fec0::1".replace("fec0", "2001"),
  ];

  it.each(blocked)("blocks %s", (h) => {
    expect(sc.isPrivateOrLoopbackHost(h)).toBe(true);
    expect(ts.isPrivateOrLoopbackHost(h)).toBe(true);
  });
  it.each(allowed)("allows %s", (h) => {
    expect(sc.isPrivateOrLoopbackHost(h)).toBe(false);
    expect(ts.isPrivateOrLoopbackHost(h)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HTML helpers parity + linear time
// ---------------------------------------------------------------------------
describe("sidecar stripHtml / extractMetadata", () => {
  const samples = [
    '<p>visible</p><script>alert(1)</script><p>also</p>',
    "<head><title>x</title></head><body><p>hello</p></body>",
    "<style>p{color:red}</style><p>hello</p><noscript>js off</noscript>",
    "<p>Tom &amp; Jerry &lt;3 &quot;cats&quot; &#39;x&#39;&nbsp;y</p>",
    "<header>Brand</header>a<SCRIPT>x</SCRIPT>b<script>tail",
    "x <> y a<b<c>d",
  ];
  it.each(samples)("matches the TS implementation on %s", (html) => {
    expect(sc.stripHtml(html)).toBe(ts.stripHtml(html));
  });

  it("matches TS extractMetadata on a realistic page", () => {
    const html = `<html><head><title> Acme </title>
      <meta name="description" content="Desc"><meta property=og:title content=OG>
      <link rel="apple-touch-icon" href="/a.png"><link rel="icon" href="/f.ico">
      <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
      </head><body><a href="https://facebook.com/acme">fb</a><a href="https://x.com/acme">x</a></body></html>`;
    const a = sc.extractMetadata(html, "https://acme.test/");
    expect(a).toEqual(ts.extractMetadata(html, "https://acme.test/"));
    expect(a.title).toBe("Acme");
    expect(a.favicon).toBe("https://acme.test/f.ico");
    expect(a.json_ld).toHaveLength(1);
    expect(a.social_links.twitter).toBe("https://x.com/acme");
  });

  it("500 KB of repeated '<script' (and other unclosed tags) finishes < 200ms", () => {
    for (const unit of ["<script", "<", "<head", "<style"]) {
      const evil = unit.repeat(Math.ceil(500_000 / unit.length));
      const t0 = performance.now();
      sc.stripHtml(evil);
      expect(performance.now() - t0).toBeLessThan(200);
    }
    for (const unit of ["<meta ", "<a href=x ", '<script type="application/ld+json">']) {
      const evil = unit.repeat(Math.ceil(500_000 / unit.length));
      const t0 = performance.now();
      sc.extractMetadata(evil, "https://e.test/");
      expect(performance.now() - t0).toBeLessThan(500);
    }
  });
});

// ---------------------------------------------------------------------------
// fetchRemote: pinned DNS, redirect draining, too-many-redirects
// ---------------------------------------------------------------------------
interface FakeReply {
  status: number;
  location?: string;
  body?: string;
}

function fakeTransport(replies: (opts: any) => FakeReply) {
  const calls: { protocol: string; opts: any; resume: ReturnType<typeof vi.fn> }[] = [];
  const request = (protocol: string, opts: any, onResponse: (r: any) => void) => {
    const req: any = new EventEmitter();
    req.setTimeout = () => req;
    req.destroy = () => {};
    req.end = () => {
      const reply = replies(opts);
      const res: any = new EventEmitter();
      res.statusCode = reply.status;
      res.headers = reply.location ? { location: reply.location } : {};
      res.resume = vi.fn();
      res.setEncoding = () => {};
      res.destroy = () => {};
      calls.push({ protocol, opts, resume: res.resume });
      setImmediate(() => {
        onResponse(res);
        if (reply.status < 300 || reply.status >= 400) {
          setImmediate(() => {
            if (reply.body) res.emit("data", reply.body);
            res.emit("end");
          });
        }
      });
    };
    return req;
  };
  return { request, calls };
}

const publicResolve = async () => [{ address: "93.184.216.34", family: 4 }];

describe("sidecar fetchRemote", () => {
  it("returns the body of a 200", async () => {
    const t = fakeTransport(() => ({ status: 200, body: "<p>hi</p>" }));
    await expect(sc.fetchRemote("https://example.com/", { request: t.request, resolve: publicResolve })).resolves.toBe(
      "<p>hi</p>"
    );
  });

  it("pins the validated address: the request's lookup never re-resolves", async () => {
    const t = fakeTransport(() => ({ status: 200, body: "ok" }));
    const resolve = vi.fn(publicResolve);
    await sc.fetchRemote("http://example.com/path?q=1", { request: t.request, resolve });
    expect(resolve).toHaveBeenCalledTimes(1);
    const { opts } = t.calls[0];
    expect(opts.path).toBe("/path?q=1");
    expect(opts.headers.Host).toBe("example.com");
    expect(typeof opts.lookup).toBe("function");
    const got = await new Promise<any[]>((r) => opts.lookup("example.com", {}, (...a: any[]) => r(a)));
    expect(got).toEqual([null, "93.184.216.34", 4]);
    const all = await new Promise<any[]>((r) => opts.lookup("example.com", { all: true }, (...a: any[]) => r(a)));
    expect(all[1]).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects a host that resolves to a private address (before connecting)", async () => {
    const t = fakeTransport(() => ({ status: 200, body: "secret" }));
    await expect(
      sc.fetchRemote("http://rebind.test/", {
        request: t.request,
        resolve: async () => [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }],
      })
    ).rejects.toThrow(/private/i);
    expect(t.calls).toHaveLength(0);
  });

  it("pinnedLookup drops private addresses and errors if none remain", async () => {
    const lk = sc.pinnedLookup([{ address: "169.254.169.254", family: 4 }]);
    const r = await new Promise<any[]>((res) => lk("x", {}, (...a: any[]) => res(a)));
    expect(r[0]).toBeInstanceOf(Error);
  });

  it("drains redirect bodies (resume) and follows up to 5 hops", async () => {
    let n = 0;
    const t = fakeTransport(() => (++n <= 5 ? { status: 302, location: `/hop${n}` } : { status: 200, body: "final" }));
    await expect(sc.fetchRemote("https://example.com/", { request: t.request, resolve: publicResolve })).resolves.toBe(
      "final"
    );
    expect(t.calls).toHaveLength(6);
    for (const c of t.calls.slice(0, 5)) expect(c.resume).toHaveBeenCalled();
  });

  it("errors explicitly on too many redirects instead of returning the 3xx body", async () => {
    const t = fakeTransport(() => ({ status: 301, location: "/again", body: "<html>moved</html>" }));
    await expect(sc.fetchRemote("https://example.com/", { request: t.request, resolve: publicResolve })).rejects.toThrow(
      /too many redirects/i
    );
    expect(t.calls).toHaveLength(6);
    for (const c of t.calls) expect(c.resume).toHaveBeenCalled();
  });

  it("re-validates every redirect target (no redirect to private hosts)", async () => {
    const t = fakeTransport(() => ({ status: 302, location: "http://169.254.169.254/latest/meta-data" }));
    await expect(sc.fetchRemote("https://example.com/", { request: t.request, resolve: publicResolve })).rejects.toThrow(
      /private/i
    );
  });

  it("errors on non-2xx and drains the body", async () => {
    const t = fakeTransport(() => ({ status: 500, body: "boom" }));
    await expect(sc.fetchRemote("https://example.com/", { request: t.request, resolve: publicResolve })).rejects.toThrow(
      /HTTP 500/
    );
    expect(t.calls[0].resume).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Env precedence + Host/Origin guards (pure)
// ---------------------------------------------------------------------------
describe("sidecar env + guards", () => {
  it("OPENADKIT_* takes precedence over ADFORGE_*", () => {
    const keep = { ...process.env };
    try {
      process.env.ADFORGE_DATA_DIR = "/legacy";
      expect(sc.resolveUserDataDir()).toBe("/legacy");
      process.env.OPENADKIT_DATA_DIR = "/new";
      expect(sc.resolveUserDataDir()).toBe("/new");
      expect(sc.envFirst("OPENADKIT_DATA_DIR", "ADFORGE_DATA_DIR")).toBe("/new");
      process.env.OPENADKIT_DATA_DIR = "";
      expect(sc.envFirst("OPENADKIT_DATA_DIR", "ADFORGE_DATA_DIR")).toBe("/legacy");
    } finally {
      process.env = keep;
    }
  });

  it("isAllowedHost accepts loopback names only", () => {
    expect(sc.isAllowedHost("127.0.0.1:1234")).toBe(true);
    expect(sc.isAllowedHost("localhost:1234")).toBe(true);
    expect(sc.isAllowedHost("[::1]:1234")).toBe(true);
    expect(sc.isAllowedHost("evil.com:1234")).toBe(false);
    expect(sc.isAllowedHost("127.0.0.1.evil.com")).toBe(false);
    expect(sc.isAllowedHost(undefined)).toBe(false);
  });

  it("isAllowedOrigin rejects foreign origins", () => {
    expect(sc.isAllowedOrigin("http://evil.com")).toBe(false);
    expect(sc.isAllowedOrigin(`http://127.0.0.1:${sc.PORT}`)).toBe(true);
    expect(sc.isAllowedOrigin("http://127.0.0.1:3000")).toBe(false);
    expect(sc.isAllowedOrigin("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: spawn the real sidecar
// ---------------------------------------------------------------------------
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function rawRequest(
  port: number,
  opts: { method?: string; path: string; headers?: Record<string, string>; body?: string }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method: opts.method ?? "GET", path: opts.path, headers: opts.headers },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

describe("sidecar integration (real HTTP)", () => {
  let child: ChildProcess;
  let port: number;
  let dataDir: string;
  let exited: Promise<number | null>;

  beforeAll(async () => {
    port = await freePort();
    const decoyPort = await freePort();
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "oak-sidecar-"));
    child = spawn(process.execPath, [SIDECAR], {
      env: {
        ...process.env,
        // OPENADKIT_* must win over the legacy name: if precedence were wrong
        // the sidecar would bind decoyPort and every request below would fail.
        OPENADKIT_SYNC_PORT: String(port),
        ADFORGE_SYNC_PORT: String(decoyPort),
        ADFORGE_DATA_DIR: dataDir,
        ADFORGE_NO_AUTOSTART: "1",
      },
      stdio: "pipe",
    });
    exited = new Promise((r) => child.once("exit", (code) => r(code)));
    const deadline = Date.now() + 15_000;
    for (;;) {
      try {
        const r = await rawRequest(port, { path: "/health", headers: { Host: `127.0.0.1:${port}` } });
        if (r.status === 200) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error("sidecar did not start");
      await new Promise((r) => setTimeout(r, 100));
    }
  }, 20_000);

  afterAll(async () => {
    if (child && child.exitCode === null) child.kill();
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  const host = () => ({ Host: `127.0.0.1:${port}` });

  it("rejects a foreign Host header (DNS rebinding guard)", async () => {
    const r = await rawRequest(port, { path: "/snapshot", headers: { Host: `evil.com:${port}` } });
    expect(r.status).toBe(403);
  });

  it("rejects a cross-origin POST", async () => {
    const r = await rawRequest(port, {
      method: "POST",
      path: "/snapshot",
      headers: { ...host(), Origin: "http://evil.com", "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, brains: ["pwned"] }),
    });
    expect(r.status).toBe(403);
  });

  it("snapshot write/read roundtrip (same-origin POST, then GET)", async () => {
    const snap = { version: 1, exported_at: 123, brains: [{ id: "b1", name: "Acme" }], tombstones: [] };
    const w = await rawRequest(port, {
      method: "POST",
      path: "/snapshot",
      headers: { ...host(), Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json" },
      body: JSON.stringify(snap),
    });
    expect(w.status).toBe(200);
    const r = await rawRequest(port, { path: "/snapshot", headers: host() });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toEqual(snap);
    expect(fs.existsSync(path.join(dataDir, "snapshot.json"))).toBe(true);
  });

  it("rejects invalid JSON snapshots", async () => {
    const r = await rawRequest(port, { method: "POST", path: "/snapshot", headers: host(), body: "{nope" });
    expect(r.status).toBe(400);
  });

  it("/ingest refuses loopback targets", async () => {
    const r = await rawRequest(port, {
      path: `/ingest?url=${encodeURIComponent("http://127.0.0.1:1/")}`,
      headers: host(),
    });
    expect(r.status).toBe(400);
  });

  it("/quit from a foreign origin is blocked; same-origin /quit exits", async () => {
    const blocked = await rawRequest(port, {
      method: "POST",
      path: "/quit",
      headers: { ...host(), Origin: "http://localhost:3000" },
    });
    expect(blocked.status).toBe(403);
    const r = await rawRequest(port, { method: "POST", path: "/quit", headers: host() });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, bye: true });
    await expect(exited).resolves.toBe(0);
  }, 15_000);
});

describe("configuredWebPort — explicit PORT wins", () => {
  const saved = process.env.PORT;
  afterEach(() => {
    if (saved === undefined) delete process.env.PORT;
    else process.env.PORT = saved;
  });

  it("uses PORT from the environment over .env.local / the default", () => {
    // Packaged apps (Windows host, install.sh launcher) have no .env.local and
    // pass the port they picked; it must not be replaced by the 41573 default.
    process.env.PORT = "45123";
    expect(sc.configuredWebPort()).toBe(45123);
  });

  it("falls back to a valid port when PORT is unset or invalid", () => {
    process.env.PORT = "not-a-port";
    const p = sc.configuredWebPort();
    expect(Number.isInteger(p) && p >= 1 && p <= 65535).toBe(true);
  });
});
