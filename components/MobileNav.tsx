"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_GROUPS } from "@/components/nav-config";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav-active";

export function MobileNav() {
  return (
    <Suspense fallback={<MobileNavView search="" />}>
      <MobileNavWithSearch />
    </Suspense>
  );
}

function MobileNavWithSearch() {
  const params = useSearchParams();
  return <MobileNavView search={params?.toString() ?? ""} />;
}

function MobileNavView({ search }: { search: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Close the drawer whenever the location changes (adjust-state-on-render
  // instead of an effect, so a navigation doesn't cost an extra render pass).
  const locationKey = `${path ?? ""}?${search}`;
  const [closedFor, setClosedFor] = useState(locationKey);
  if (closedFor !== locationKey) {
    setClosedFor(locationKey);
    setOpen(false);
  }

  useEffect(() => {
    // The app shell pins the page to one viewport, so <body> no longer scrolls —
    // the scroll region is #main-scroll. Locking only body would leave the
    // content scrolling behind the open drawer.
    const scroller = document.getElementById("main-scroll");
    const lock = (on: boolean) => {
      const v = on ? "hidden" : "";
      document.body.style.overflow = v;
      if (scroller) scroller.style.overflow = on ? "hidden" : "";
    };
    if (open) {
      lock(true);
      // Move focus into the dialog so keyboard users land inside instead of
      // being stranded on the now-hidden hamburger trigger.
      closeRef.current?.focus();
      // Capture the trigger node NOW. Reading triggerRef.current inside the
      // cleanup would read whatever it points at when the effect tears down —
      // by then React may have unmounted or replaced that node, so focus would
      // go nowhere and keyboard users would be dumped back at the page root.
      const trigger = triggerRef.current;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => {
        lock(false);
        window.removeEventListener("keydown", onKey);
        // Return focus to the trigger when the drawer closes.
        trigger?.focus();
      };
    }
    lock(false);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 h-11 w-11 grid place-items-center border border-base-600 bg-base-900/90 backdrop-blur-sm"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
      >
        <Menu size={18} />
      </button>

      {open ? (
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="md:hidden fixed inset-0 z-50 bg-base-950/95 backdrop-blur-sm overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-base-600 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-7 w-7 bg-live grid place-items-center text-base-950 font-bold font-display italic">A</div>
              <div className="font-display italic text-lg text-ink">OpenAdKit</div>
            </Link>
            <button
              ref={closeRef}
              onClick={() => setOpen(false)}
              className="h-11 w-11 grid place-items-center border border-base-600"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          <nav className="p-3 pb-12 space-y-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 px-2">
                  {g.title}
                </div>
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = isNavItemActive(path, search, item);
                    // Carry the platform pre-selection, same as the desktop
                    // Sidebar — dropping it landed mobile users on a blank form.
                    const href = item.query ? `${item.href}?${item.query}` : item.href;
                    return (
                      <Link
                        key={`${item.href}?${item.query ?? ""}`}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 text-[15px] border-l-2",
                          active
                            ? "bg-base-800/80 text-ink border-live font-medium"
                            : "text-ink-muted border-transparent"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
