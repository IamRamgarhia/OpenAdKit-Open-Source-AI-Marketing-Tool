"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Plug } from "lucide-react";
import { REPO_URL } from "@/lib/repo";

interface McpInfo {
  command: string;
  args: string[];
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-ink-muted">{label}</span>
        <button
          type="button"
          className="text-[11px] text-live hover:underline inline-flex items-center gap-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              /* select by hand */
            }
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="text-[10px] font-mono text-ink bg-base-950 border border-base-700 p-2 overflow-x-auto whitespace-pre">{text}</pre>
    </div>
  );
}

const quote = (s: string) => (/\s/.test(s) ? `"${s}"` : s);

/**
 * Settings → "Use OpenAdKit in Claude Desktop, Claude Code or Cursor".
 * Shows ready-to-paste MCP config with this install's exact paths
 * (from /api/runtime), or how to get the server when running from source.
 */
export function McpConnectPanel() {
  const [mcp, setMcp] = useState<McpInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runtime", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setMcp(j?.mcp ?? null);
      })
      .catch(() => {
        if (!cancelled) setMcp(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const desktop = mcp ? JSON.stringify({ mcpServers: { openadkit: { command: mcp.command, args: mcp.args } } }, null, 2) : "";
  const code = mcp ? `claude mcp add openadkit -- ${quote(mcp.command)} ${mcp.args.map(quote).join(" ")}` : "";

  return (
    <section className="card space-y-4" aria-labelledby="mcp-heading">
      <div className="flex items-center gap-2">
        <Plug size={14} className="text-live" />
        <h2 id="mcp-heading" className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">
          use openadkit in claude desktop · claude code · cursor (mcp)
        </h2>
      </div>
      <p className="text-xs text-ink-muted leading-relaxed max-w-3xl">
        OpenAdKit&apos;s 30 generators and optimizers can run inside any MCP app. Without an AI key the assistant writes
        the copy itself using OpenAdKit&apos;s prompts and your saved clients; add a key to the config&apos;s{" "}
        <code className="font-mono">env</code> (e.g. <code className="font-mono">GEMINI_API_KEY</code>) to have OpenAdKit
        generate and validate it.
      </p>
      {mcp === undefined ? (
        <p className="text-xs text-ink-subtle">Checking this install…</p>
      ) : mcp ? (
        <div className="space-y-3">
          <CopyBlock label="Claude Desktop → Settings → Developer → Edit Config (claude_desktop_config.json) · Cursor: .cursor/mcp.json" text={desktop} />
          <CopyBlock label="Claude Code (terminal)" text={code} />
          <p className="text-[11px] text-ink-subtle">
            The Windows installer can add this to Claude Desktop for you (“Connect to Claude Desktop”). Restart Claude
            Desktop after changing its config.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          The MCP server ships with the desktop installers. Running from source? Build it with{" "}
          <code className="font-mono">npm run build:mcp</code> and point your MCP app at{" "}
          <code className="font-mono">mcp/dist/openadkit-mcp.mjs</code>.{" "}
          <a href={`${REPO_URL}/blob/main/docs/MCP.md`} target="_blank" rel="noreferrer" className="text-live hover:underline inline-flex items-center gap-1">
            Setup guide <ExternalLink size={10} />
          </a>
        </p>
      )}
    </section>
  );
}
