"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useHasAnyKey } from "@/lib/hooks/use-has-key";

/**
 * Gate a single AI action (not the whole page). Static content stays public
 * and crawlable; only the button that would spend tokens asks for a key.
 */
export function RequireKeyAction({
  children,
  what = "this AI feature",
}: {
  children: React.ReactNode;
  what?: string;
}) {
  const hasKey = useHasAnyKey();
  const path = usePathname();
  if (hasKey) return <>{children}</>;
  return (
    <div className="border border-live/40 bg-live/5 px-3 py-2.5 text-[12px] text-ink-muted space-y-2" data-testid="require-key">
      <p>
        Add a free or paid AI provider key to use {what}. Everything else on this page works without one.
      </p>
      <Link href={`/setup?next=${encodeURIComponent(path || "/")}`} className="btn-primary w-full">
        <KeyRound size={12} /> Add an AI key
      </Link>
    </div>
  );
}
