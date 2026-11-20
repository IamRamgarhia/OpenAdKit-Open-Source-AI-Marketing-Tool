"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpCircle, Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { isHostedMode } from "@/lib/env";
import { resolveSyncOrigin } from "@/lib/sync-endpoint";

/** Result of the sidecar's GET /release/check. */
export interface ReleaseCheck {
  status: "available" | "up_to_date" | "network_error";
  update_available?: boolean;
  current: string;
  latest?: string;
  release_url?: string;
  install_kind?: "windows" | "unix" | "git" | "other";
  can_apply?: boolean;
  command?: string | null;
  reason?: string;
}

const KEY_ENABLED = "ados.update_check"; // "off" disables
const KEY_AT = "ados.update_checked_at";
const KEY_LAST = "ados.update_last";
const KEY_DISMISSED = "ados.update_dismissed";
const DAY = 24 * 60 * 60 * 1000;

function ls(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export function updateChecksEnabled(): boolean {
  return typeof window === "undefined" ? true : ls(KEY_ENABLED) !== "off";
}
export function setUpdateChecksEnabled(on: boolean) {
  lsSet(KEY_ENABLED, on ? "on" : "off");
}

/** Ask the sidecar for the latest release (no caching). */
export async function checkForUpdate(): Promise<ReleaseCheck | null> {
  const origin = await resolveSyncOrigin();
  if (!origin) return null;
  const res = await fetch(`${origin}/release/check`, { cache: "no-store" });
  if (!res.ok) return null;
  const r = (await res.json()) as ReleaseCheck;
  lsSet(KEY_AT, String(Date.now()));
  lsSet(KEY_LAST, JSON.stringify(r));
  return r;
}

/**
 * "OpenAdKit vX is available" card. Checks GitHub (through the local
 * sidecar) at most once a day; Settings → "Check for updates" turns it off
 * or forces a check (event "ados:update-check").
 */
export function UpdateNotice() {
  const [info, setInfo] = useState<ReleaseCheck | null>(null);
  const [phase, setPhase] = useState<"idle" | "applying" | "installing" | "error">("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const show = useCallback((r: ReleaseCheck | null, force = false) => {
    if (!r?.update_available || !r.latest) return;
    if (!force && ls(KEY_DISMISSED) === r.latest) return;
    setInfo(r);
  }, []);

  useEffect(() => {
    if (isHostedMode()) return;
    let cancelled = false;
    const run = async (force: boolean) => {
      if (!force && !updateChecksEnabled()) return;
      const last = Number(ls(KEY_AT) || 0);
      if (!force && Date.now() - last < DAY) {
        try {
          const cached = JSON.parse(ls(KEY_LAST) || "null") as ReleaseCheck | null;
          if (!cancelled) show(cached);
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        const r = await checkForUpdate();
        if (!cancelled) show(r, force);
      } catch {
        /* offline — try again tomorrow */
      }
    };
    const t = setTimeout(() => void run(false), 4000);
    const onForce = () => void run(true);
    window.addEventListener("ados:update-check", onForce);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener("ados:update-check", onForce);
    };
  }, [show]);

  if (!info) return null;

  const apply = async () => {
    setPhase("applying");
    setError("");
    try {
      const origin = await resolveSyncOrigin();
      if (!origin) throw new Error("The OpenAdKit background service isn't reachable.");
      const res = await fetch(`${origin}/release/apply`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || `Update failed (HTTP ${res.status}).`);
      setPhase("installing");
    } catch (e) {
      setPhase("error");
      setError((e as Error).message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.command || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* command is visible to copy by hand */
    }
  };

  const dismiss = () => {
    if (info.latest) lsSet(KEY_DISMISSED, info.latest);
    setInfo(null);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 bottom-14 right-4 w-[min(360px,calc(100vw-2rem))] border border-live/50 bg-base-900/95 backdrop-blur p-4 shadow-2xl animate-fade-up"
    >
      <div className="flex items-start gap-2">
        <ArrowUpCircle size={16} className="text-live mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink font-medium">OpenAdKit {info.latest} is available</div>
          <div className="text-[11px] text-ink-muted mt-0.5">You have {info.current}. Your data is kept when you update.</div>
        </div>
        {phase === "idle" || phase === "error" ? (
          <button type="button" onClick={dismiss} aria-label="Remind me later" className="text-ink-subtle hover:text-ink">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {phase === "installing" ? (
        <p className="text-xs text-pos mt-3">Installing… OpenAdKit will close and reopen in a moment.</p>
      ) : info.can_apply ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={apply} disabled={phase === "applying"} className="btn-primary">
            {phase === "applying" ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
            {phase === "applying" ? "Downloading & verifying…" : "Update now"}
          </button>
          {info.release_url ? (
            <a href={info.release_url} target="_blank" rel="noreferrer" className="btn-ghost">
              What's new <ExternalLink size={10} />
            </a>
          ) : null}
        </div>
      ) : info.command ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-ink-muted">Paste this in Terminal to update:</p>
          <code className="block text-[10px] font-mono text-ink bg-base-950 border border-base-700 p-2 break-all">{info.command}</code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="btn-primary">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy command"}
            </button>
            {info.release_url ? (
              <a href={info.release_url} target="_blank" rel="noreferrer" className="btn-ghost">
                What's new <ExternalLink size={10} />
              </a>
            ) : null}
          </div>
        </div>
      ) : info.release_url ? (
        <div className="mt-3">
          <a href={info.release_url} target="_blank" rel="noreferrer" className="btn-primary">
            See the release <ExternalLink size={10} />
          </a>
        </div>
      ) : null}

      {phase === "error" ? <p className="text-xs text-neg mt-2">{error}</p> : null}
    </div>
  );
}
