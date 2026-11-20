"use client";

import { useEffect, useState, useRef } from "react";
import { Undo2, X } from "lucide-react";

interface UndoEvent {
  message: string;
  undo: () => void | Promise<void>;
  timeoutMs?: number;
}

declare global {
  interface WindowEventMap {
    "ados:undo": CustomEvent<UndoEvent>;
  }
}

export function showUndoToast(detail: UndoEvent) {
  window.dispatchEvent(new CustomEvent("ados:undo", { detail }));
}

interface QueuedUndo extends UndoEvent {
  id: number;
}

export function UndoToast() {
  // Queue of pending undo events. A rapid double-delete used to silently drop
  // the first one because we only held a single slot. Now the second event
  // joins the queue and surfaces when the first dismisses / times out.
  // (Audit finding #43.)
  const [queue, setQueue] = useState<QueuedUndo[]>([]);
  const nextId = useRef(0);
  const evt = queue[0] ?? null;

  useEffect(() => {
    const onUndo = (e: CustomEvent<UndoEvent>) => {
      const id = ++nextId.current;
      setQueue((q) => [...q, { ...e.detail, id }]);
    };
    window.addEventListener("ados:undo", onUndo);
    return () => window.removeEventListener("ados:undo", onUndo);
  }, []);

  if (!evt) return null;
  const dismiss = (id: number) => setQueue((q) => q.filter((x) => x.id !== id));
  // key= remounts the toast per event, so its countdown starts fresh without
  // resetting state from an effect.
  return <UndoToastItem key={evt.id} evt={evt} onDone={() => dismiss(evt.id)} />;
}

function UndoToastItem({ evt, onDone }: { evt: QueuedUndo; onDone: () => void }) {
  const total = evt.timeoutMs ?? 7000;
  const [remaining, setRemaining] = useState(total);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 100));
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining <= 0) onDoneRef.current();
  }, [remaining]);

  const pct = (remaining / total) * 100;

  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 min-w-[320px] max-w-md">
      <div className="border border-base-600 bg-base-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-sm text-ink flex-1">{evt.message}</span>
          <button
            onClick={async () => {
              try {
                await evt.undo();
              } catch (err) {
                console.error("Undo failed", err);
              } finally {
                onDone();
              }
            }}
            className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-live hover:bg-live/10 px-2 py-1"
          >
            <Undo2 size={12} /> Undo
          </button>
          <button onClick={onDone} className="text-ink-faint hover:text-ink" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
        <div className="h-0.5 bg-live transition-all duration-100" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
