import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security headers applied to every response. These are the cheap,
// high-ROI ones — no CSP yet because Next.js inline scripts + Vercel's
// preview toolbar + Sentry tunnel make CSP a non-trivial tuning
// exercise. Add CSP once we've confirmed nothing breaks.
const SECURITY_HEADERS = [
  // Reduce referrer leakage on outbound links (privacy + minor SEO).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Prevent MIME-type sniffing attacks.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow framing by third parties (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Drop legacy XSS-auditor (modern browsers ignore; IE hint).
  { key: "X-XSS-Protection", value: "0" },
  // Lock down powerful browser APIs we don't use. Explicitly allow
  // microphone for the voice surfaces (Gabby voice chat, Retell IVR).
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "geolocation=()",
      "microphone=(self)",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  // HSTS: Vercel already enforces HTTPS, but an explicit header means
  // the browser caches the "always HTTPS" decision for 2 years.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bulk inventory imports can carry many thousands of rows.
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

// Sentry build-time wrapper. It:
//   - uploads source maps when SENTRY_AUTH_TOKEN is set (prod Vercel),
//   - rewrites client-side requests to /monitoring → Sentry to sidestep
//     ad-blockers that blackhole sentry.io directly.
//
// When SENTRY_AUTH_TOKEN isn't set (local dev, forks, first deploy
// before you've configured Sentry), it no-ops the upload step. The
// runtime SDK init is separately DSN-gated in sentry.*.config.ts, so
// the whole stack is safe to ship un-configured.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: false,
});
