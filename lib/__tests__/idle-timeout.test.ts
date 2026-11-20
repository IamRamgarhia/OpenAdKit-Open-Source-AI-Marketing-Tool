import { describe, it, expect, vi, afterEach } from "vitest";
import { createIdleTimeout, anySignal } from "../idle-timeout";

afterEach(() => vi.useRealTimers());

describe("createIdleTimeout", () => {
  it("fires after `ms` of silence", () => {
    vi.useFakeTimers();
    const t = createIdleTimeout(1000);
    vi.advanceTimersByTime(999);
    expect(t.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(t.signal.aborted).toBe(true);
    expect(t.timedOut).toBe(true);
  });

  it("a stream that keeps delivering is never killed, however long it runs", () => {
    vi.useFakeTimers();
    const t = createIdleTimeout(1000);
    for (let i = 0; i < 300; i++) {
      vi.advanceTimersByTime(900);
      t.bump();
    }
    // 270s of wall clock, still alive.
    expect(t.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(t.signal.aborted).toBe(true);
  });

  it("clear() prevents firing", () => {
    vi.useFakeTimers();
    const t = createIdleTimeout(1000);
    t.clear();
    t.bump();
    vi.advanceTimersByTime(5000);
    expect(t.signal.aborted).toBe(false);
  });
});

describe("anySignal", () => {
  it("aborts when any input aborts", () => {
    const a = new AbortController();
    const b = new AbortController();
    const s = anySignal([a.signal, b.signal]);
    expect(s.aborted).toBe(false);
    b.abort();
    expect(s.aborted).toBe(true);
  });
});
