/**
 * Runtime facts the browser can't know at build time.
 *
 * The sidecar's port is chosen when OpenAdKit launches (and differs per
 * install), but prebuilt release bundles are compiled in CI — so the
 * NEXT_PUBLIC_* port inlined at build time can't be right for everyone.
 * The web server is started by the sidecar with OPENADKIT_SYNC_PORT in its
 * environment; this route reports it, read at request time.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const raw = process.env.OPENADKIT_SYNC_PORT || process.env.ADFORGE_SYNC_PORT || "";
  const port = /^\d{2,5}$/.test(raw) ? Number(raw) : null;
  return Response.json(
    { sync_port: port },
    { headers: { "Cache-Control": "no-store" } },
  );
}
