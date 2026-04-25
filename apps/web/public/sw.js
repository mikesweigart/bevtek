// BevTek service worker — Phase A.
//
// Intentionally minimal: this file exists so browsers consider the app
// installable (Chrome on Android requires a registered SW). It does NOT
// cache any responses — every fetch goes to the network.
//
// Why: caching the merchant portal offline is risky during this
// pre-launch phase. Stale UI bundled with newer server actions is a
// silent footgun (e.g. team page cached against a now-renamed RPC).
// Phase B will swap this file for a Serwist-generated SW with a
// curated runtime-cache config (static assets only, no HTML/API).
//
// Until then, this SW does three things:
//   1. Install — skipWaiting so a new version takes over immediately
//      on the next page load instead of waiting for every tab to
//      close (default behaviour).
//   2. Activate — clients.claim so the freshly-installed SW controls
//      pages that were already open at the moment it activated, plus
//      a `version` log so we can confirm in DevTools which SW build
//      is live.
//   3. Fetch — pass-through. Defining the listener even as a no-op is
//      what some browsers (Chromium variants) check for when scoring
//      installability.

const SW_VERSION = "bevtek-pwa-phase-a-2026-04-24";

self.addEventListener("install", () => {
  // Replace the previous SW immediately. Safe here because we don't
  // cache anything, so there's no in-flight cache that "belongs" to
  // the old worker.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Take control of any open tabs so the next navigation in those
      // tabs is governed by this SW (matters when we add caching later).
      await self.clients.claim();
      // Eagerly evict any caches an earlier SW build may have created.
      // Belt-and-braces: this build doesn't create caches, but if a
      // future Serwist build leaves stale ones we'll clean them on next
      // activation.
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      console.log("[bevtek-sw] active:", SW_VERSION);
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Pass-through. Network handles everything. Defining the listener
  // (even as a no-op) is what Chromium scores for installability.
});
