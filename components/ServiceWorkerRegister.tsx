"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Was there already a controller when this page loaded? If not, this is a
    // FIRST install — sw.js calls skipWaiting() + clients.claim(), so
    // `controllerchange` fires almost immediately. The old code claimed to
    // guard against that case but didn't, so every user's first production
    // page load did a full reload for no reason.
    const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);

    const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(buildId)}`).catch(() => {});

    // When a NEW sw takes over an already-controlled page (i.e. after a
    // deploy), reload so the shell HTML matches the new chunk URLs. Without
    // this, users on the stale cached shell may see broken UI references for
    // a session. (Audit finding #55.)
    let reloaded = false;
    const onControllerChange = () => {
      if (!hadControllerAtLoad) return; // first install — nothing stale to fix
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
