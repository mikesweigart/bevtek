// Sentry — edge runtime init. Most of our API routes are `nodejs`, but
// proxy / middleware runs on edge. Keep this minimal; edge has tight
// size limits. Same DSN gate as the server config.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    tracesSampleRate: 0.05,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
