"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false during SSR and the hydration render, true afterwards.
 *
 * Lets a component mount a browser-only subtree whose useState initializers
 * read localStorage directly (lazy initializers), without a hydration
 * mismatch and without the `useEffect(() => setX(readStorage()))` pattern
 * that renders everything twice.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
