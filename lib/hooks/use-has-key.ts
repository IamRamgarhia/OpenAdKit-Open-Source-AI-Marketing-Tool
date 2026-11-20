"use client";

import { useSyncExternalStore } from "react";
import { hasAnyKeyConfigured } from "@/lib/settings";

/**
 * Subscribe to a set of window events (plus cross-tab `storage`). Shared by
 * the useSyncExternalStore-based hooks below — reading localStorage through
 * an external-store subscription instead of `useEffect(() => setX(read()))`
 * avoids the extra render pass and is hydration-safe: the server snapshot is
 * used for the hydration render, then React re-renders with the client value.
 */
export function subscribeWindowEvents(events: string[]) {
  return (onChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    const all = ["storage", ...events];
    for (const e of all) window.addEventListener(e, onChange);
    return () => {
      for (const e of all) window.removeEventListener(e, onChange);
    };
  };
}

const subscribeKeys = subscribeWindowEvents(["ados:provider-changed", "ados:vault-changed"]);

/**
 * True once ANY provider key is stored in this browser. Server render (and
 * the hydration pass) see `false`.
 *
 * "Has a key" is the single onboarding signal: a user who imported a backup
 * or pasted a key in Settings is onboarded, even if they never clicked
 * through /setup.
 */
export function useHasAnyKey(): boolean {
  return useSyncExternalStore(subscribeKeys, hasAnyKeyConfigured, () => false);
}

/** Same as useHasAnyKey but distinguishes "not known yet" (server/hydration) from "no key". */
export function useHasAnyKeyStatus(): "unknown" | "yes" | "no" {
  return useSyncExternalStore(
    subscribeKeys,
    () => (hasAnyKeyConfigured() ? "yes" : "no"),
    () => "unknown" as const
  );
}
