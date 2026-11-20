/**
 * Idle (inactivity) timeout for streaming calls.
 *
 * The launch wizard used a fixed 90s wall-clock timer per phase, which killed
 * healthy long streams (a 6.5k-token content calendar on a slow free tier can
 * legitimately stream for minutes). An idle timeout only fires when NO data
 * has arrived for `ms` — call bump() on every delta.
 */
export interface IdleTimeout {
  signal: AbortSignal;
  /** Reset the countdown — call on every received chunk. */
  bump(): void;
  /** Stop the timer (call in finally). */
  clear(): void;
  /** True once the timer fired. */
  readonly timedOut: boolean;
}

export function createIdleTimeout(ms: number, message = `No response for ${Math.round(ms / 1000)}s`): IdleTimeout {
  const ctl = new AbortController();
  let fired = false;
  let cleared = false;
  let id: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (id) clearTimeout(id);
    if (cleared || fired) return;
    id = setTimeout(() => {
      fired = true;
      ctl.abort(new Error(message));
    }, ms);
  };
  arm();
  return {
    signal: ctl.signal,
    bump: arm,
    clear() {
      cleared = true;
      if (id) clearTimeout(id);
      id = null;
    },
    get timedOut() {
      return fired;
    },
  };
}

/** Combine signals; the first to abort wins (AbortSignal.any where available). */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === "function") return anyFn(signals);
  const ctl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctl.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => ctl.abort(s.reason), { once: true });
  }
  return ctl.signal;
}
