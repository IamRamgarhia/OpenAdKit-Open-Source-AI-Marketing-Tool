"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    // When a new SW takes over (skipWaiting + claim fires after a deploy),
    // reload the page so the shell HTML matches the new chunk URLs. Without
    // this, users on the stale cached shell may see broken UI references for
    // a session. (Audit finding #55.) Guarded against the first install on a
    // fresh visit, where there was no previous controller.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
