/**
 * Runtime facts the browser can't know at build time.
 *
 * - sync_port: the sidecar's port is chosen when OpenAdKit launches (and
 *   differs per install), but prebuilt release bundles are compiled in CI, so
 *   the NEXT_PUBLIC_* port inlined at build time can't be right for everyone.
 * - mcp: the exact node + script paths of this install's MCP server, so the
 *   Settings page can show copy-paste config for Claude Desktop / Code / Cursor.
 *
 * All values come from the environment the sidecar starts the web server
 * with, read at request time.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const raw = process.env.OPENADKIT_SYNC_PORT || process.env.ADFORGE_SYNC_PORT || "";
  const port = /^\d{2,5}$/.test(raw) ? Number(raw) : null;
  const script = process.env.OPENADKIT_MCP_SCRIPT || "";
  const node = process.env.OPENADKIT_NODE || "";
  return Response.json(
    {
      sync_port: port,
      mcp: script && node ? { command: node, args: [script] } : null,
      packaged: process.env.OPENADKIT_PACKAGED || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
