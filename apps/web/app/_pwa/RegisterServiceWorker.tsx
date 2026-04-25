"use client";

import { useEffect } from "react";

/**
 * Mounts once at the root layout. Registers /sw.js the moment the
 * browser is idle (after first paint) so service-worker setup never
 * blocks the initial render.
 *
 * Why a separate component instead of inline in layout.tsx?
 * - layout.tsx stays a Server Component (it sets metadata + reads
 *   server-only env). This client component is the smallest possible
 *   "use client" island we can carve out.
 * - Lets us keep registration logic colocated with the SW concern —
 *   future things like push-notification subscription requests will
 *   land in this folder.
 *
 * Intentionally swallows registration errors to a console.warn — if
 * the SW fails to register the app still works perfectly, just isn't
 * installable. We don't want a transient failure to throw and break
 * the dashboard.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Don't register the merchant-portal SW (scope=/) on shopper pages.
    // /s/[slug] gets its own per-store PWA branding via a different
    // manifest, and a future per-shopper SW (Phase C) will need to
    // own its own scope. Letting the root SW take over /s/* would
    // bind the shopper PWA to merchant-side caching rules.
    if (window.location.pathname.startsWith("/s/")) return;

    // Defer registration until after first paint so we don't compete
    // for the main thread during hydration. `requestIdleCallback`
    // isn't in Safari, so fall back to a small setTimeout.
    const ric =
      "requestIdleCallback" in window
        ? (cb: () => void) =>
            (window as typeof window & {
              requestIdleCallback: (cb: () => void) => number;
            }).requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 1);

    ric(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => {
          // Non-fatal: the app works fine without a SW, you just don't
          // get the "Add to Home Screen" install prompt. Log so we can
          // notice in dev / Sentry-breadcrumb territory.
          console.warn("[bevtek-sw] registration failed:", err);
        });
    });
  }, []);

  return null;
}
