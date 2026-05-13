"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, BugPlay } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [diagOpen, setDiagOpen] = useState(false);

  useEffect(() => {
    // Surface to console for devtools / launcher log capture. Never sent anywhere.
    console.error("[adforge:error-boundary]", error);
  }, [error]);

  function openGitHubIssue() {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "(no UA)";
    const url = typeof window !== "undefined" ? window.location.href : "(no URL)";
    const lines = [
      "## What were you doing?",
      "",
      "<!-- Describe what you clicked / typed right before this crashed. -->",
      "",
      "## Error",
      "",
      "```",
      `Message: ${error?.message ?? "(none)"}`,
      `Digest:  ${error?.digest ?? "(none)"}`,
      `Stack:`,
      (error?.stack ?? "(no stack)").split("\n").slice(0, 12).join("\n"),
      "```",
      "",
      "## Environment",
      "",
      "```",
      `URL: ${url}`,
      `Browser: ${ua}`,
      "```",
    ];
    const title = `Render error: ${(error?.message ?? "unknown").slice(0, 70)}`;
    const body = encodeURIComponent(lines.join("\n"));
    const gh = `https://github.com/IamRamgarhia/AdForge/issues/new?labels=bug&title=${encodeURIComponent(title)}&body=${body}`;
    window.open(gh, "_blank");
  }

  return (
    <div className="min-h-[60vh] grid place-items-center px-4 animate-fade-up">
      <div className="max-w-xl w-full border border-neg/30 bg-neg/[0.03] p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle size={22} className="text-neg shrink-0 mt-0.5" />
          <div>
            <h1 className="font-display italic text-2xl text-ink leading-tight">Something broke on this page.</h1>
            <p className="text-sm text-ink-muted mt-1">
              Your data is safe — every brand, ad, and campaign lives in your browser's IndexedDB and isn't touched
              by a render error. Try again, or jump back to the dashboard.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={reset} className="btn-primary">
            <RefreshCw size={12} />
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            <Home size={12} />
            Go to dashboard
          </Link>
          <button onClick={openGitHubIssue} className="btn-ghost">
            <BugPlay size={12} />
            Report this on GitHub
          </button>
        </div>

        <details className="mt-5 pt-4 border-t border-base-700" open={diagOpen} onToggle={(e) => setDiagOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-[11px] font-mono uppercase tracking-ui-wide text-ink-muted hover:text-ink transition list-none">
            {diagOpen ? "▼" : "▶"} technical details
          </summary>
          <div className="mt-3 space-y-2">
            <div className="text-[11px] font-mono text-ink-faint">Message</div>
            <pre className="text-[11px] text-neg font-mono whitespace-pre-wrap break-words border border-base-700 bg-base-900/40 p-2 rounded-sm">
              {error?.message ?? "(no message)"}
            </pre>
            {error?.digest ? (
              <>
                <div className="text-[11px] font-mono text-ink-faint">Digest</div>
                <pre className="text-[11px] text-ink font-mono border border-base-700 bg-base-900/40 p-2 rounded-sm">
                  {error.digest}
                </pre>
              </>
            ) : null}
            {error?.stack ? (
              <>
                <div className="text-[11px] font-mono text-ink-faint">Stack (truncated)</div>
                <pre className="text-[10px] text-ink-muted font-mono whitespace-pre-wrap break-words border border-base-700 bg-base-900/40 p-2 rounded-sm max-h-40 overflow-auto">
                  {error.stack.split("\n").slice(0, 12).join("\n")}
                </pre>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
