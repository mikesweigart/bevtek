import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bulk inventory imports can carry many thousands of rows.
      bodySizeLimit: "25mb",
    },
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
