// Sentry — browser init. Next 16 auto-registers this file on the client.
// DSN-gated via NEXT_PUBLIC_SENTRY_DSN (the public prefix is required
// for browser code).

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentryBreadcrumb } from "@/lib/sentry/scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.NODE_ENV ??
      "unknown",
    // Lower sample rate in the browser — we care about errors, and
    // replay/performance add bandwidth per session. Turn up later if
    // the sampled view is too sparse.
    tracesSampleRate: 0.05,
    // Session replay is OFF by default. Turn on only when you've
    // reviewed the PII implications (we do show shopper emails in the
    // admin UI) — it can be enabled here when ready.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      // Chromium extensions injecting into pages — not our bug.
      /ResizeObserver loop/i,
      /chrome-extension/i,
      // iOS Safari non-standard error we can't do anything about.
      "Non-Error promise rejection captured",
    ],
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    // Browser-side PII scrubbing: the browser always captures the URL
    // and some request context. Strip emails / phone / tokens before
    // anything leaves the user's machine.
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
}

// Required by @sentry/nextjs so client-side navigations show up as
// individual transactions in the Sentry UI.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
