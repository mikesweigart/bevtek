import type { MetadataRoute } from "next";

/**
 * BevTek merchant portal manifest. Phase A of PWA work — covers the
 * staff-facing app (the surface that lands on /dashboard after login).
 *
 * Why these choices:
 * - `start_url: "/dashboard"` so opening from the home screen drops the
 *   owner straight into the app rather than the marketing landing page.
 *   The middleware will redirect to /login if their session has expired.
 * - `scope: "/"` keeps the PWA "in-app" feel everywhere on the domain,
 *   which matters because we link out to onboarding, settings, billing,
 *   /trainer, etc. — all of which are part of the merchant experience.
 * - `display_override: ["standalone"]` is a forward-compatible hint;
 *   browsers fall through to the legacy `display` value if they don't
 *   recognise it. Phase B may bump to "window-controls-overlay" on
 *   desktop installs.
 * - Icons live as Route Handlers under /icons/* so we can iterate on
 *   the artwork in code (no binary churn in git). Each entry pins a
 *   `sizes` and `purpose` so Chrome's installability checks pass.
 *
 * Note: we deliberately omit a separate `<slug>` shopper manifest at
 * this stage — that's Phase B. The current setup gets ONE installable
 * BevTek app that works for staff today, which is what we need for
 * device beta-testing before App Store submission.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BevTek",
    short_name: "BevTek",
    description:
      "Megan + Gabby — the AI platform for beverage retail. Your portal for inventory, training, and AI receptionist calls.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#ffffff",
    // Brand gold — same token used in globals.css (--color-gold).
    theme_color: "#c8984e",
    categories: ["business", "productivity", "shopping"],
    lang: "en-US",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
