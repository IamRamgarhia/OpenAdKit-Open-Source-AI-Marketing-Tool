"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Throttled stream accumulator. Claude can stream tokens faster than React can paint.
 * We collect deltas in a ref and flush to state on requestAnimationFrame — one render per
 * frame at most, regardless of token rate. Eliminates the jitter you get from setState-per-token.
 */
export function useThrottledStream() {
  const [text, setText] = useState("");
  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const append = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!mountedRef.current) return;
      const flushed = bufferRef.current;
      setText(flushed);
    });
  }, []);

  const reset = useCallback(() => {
    bufferRef.current = "";
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setText("");
  }, []);

  // Synchronous read of the live buffer. `text` (state) lags behind by up to one
  // rAF flush and is stale inside the closure that kicked off the stream, so
  // callers needing the final accumulated text should read this instead.
  const getText = useCallback(() => bufferRef.current, []);

  return { text, append, reset, getText };
}
