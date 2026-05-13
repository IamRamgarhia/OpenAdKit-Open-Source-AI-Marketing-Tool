/**
 * Skeleton primitives — used while Dexie reads resolve.
 *
 * We don't suspend on Dexie because it's local-fast (typically 20-80ms),
 * but that 80ms still flashes the empty-state UI before real data lands.
 * Skeletons keep the layout stable + signal "stuff is coming" without
 * the misleading "no data" copy.
 */
import { cn } from "@/lib/utils";

export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-base-800/60 animate-pulse-soft border border-base-700/50",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ width = "70%" }: { width?: string }) {
  return (
    <div
      className="h-3 bg-base-800/60 animate-pulse-soft rounded-sm"
      style={{ width }}
      aria-hidden="true"
    />
  );
}

/** Card-row skeleton used by /history and /campaigns. */
export function SkeletonRow() {
  return (
    <div className="border border-base-700/50 bg-base-900/30 p-3 space-y-2" aria-hidden="true">
      <div className="flex items-center gap-2">
        <div className="h-4 w-12 bg-base-800/60 animate-pulse-soft" />
        <div className="h-4 w-16 bg-base-800/60 animate-pulse-soft" />
        <div className="h-4 w-1/2 bg-base-800/60 animate-pulse-soft" />
      </div>
      <SkeletonText width="40%" />
    </div>
  );
}

/** Tile skeleton for dashboard-style grids. */
export function SkeletonTile() {
  return (
    <div className="border border-base-700/50 bg-base-900/30 p-4 space-y-3" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="h-4 w-4 bg-base-800/60 animate-pulse-soft" />
        <div className="h-3 w-3 bg-base-800/60 animate-pulse-soft" />
      </div>
      <div className="h-5 w-2/3 bg-base-800/60 animate-pulse-soft" />
      <SkeletonText width="90%" />
      <SkeletonText width="60%" />
    </div>
  );
}

/** Polite live-region announcement for screen readers while a section loads. */
export function LoadingAnnouncement({ what = "content" }: { what?: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      Loading {what}…
    </span>
  );
}
