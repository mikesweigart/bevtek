// Sentry — server-side init (Node runtime).
//
// Wired via instrumentation.ts → register(). Fully DSN-gated: if
// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is unset, init() is never called
// and @sentry/nextjs no-ops transparently. This keeps local dev and
// untouched forks from paying any runtime cost until Sentry is
// deliberately turned on by adding the DSN to Vercel env vars.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentryBreadcrumb } from "@/lib/sentry/scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Default to prod — Vercel sets NODE_ENV=production for prod builds,
    // "development" locally, and "preview" for preview deploys. That's
    // enough triage until we add release tracking.
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    // 10% transaction sampling keeps performance data useful without
    // flooding quota. Errors are always captured.
    tracesSampleRate: 0.1,
    // Cut the noisy ones — Vercel cold starts + healthchecks are not bugs.
    ignoreErrors: [
      "NEXT_NOT_FOUND",
      "NEXT_REDIRECT",
    ],
    // Release = git sha when Vercel exposes it. Makes stack traces from
    // a specific deploy findable in the Sentry UI.
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // Default PII scrubbing at the SDK level — strips IP, cookies, and
    // the "request body" capture when we don't explicitly pass one.
    sendDefaultPii: false,
    // Custom scrubbers: redact email / phone / DOB / tokens even in
    // places the SDK doesn't know about (extras, tags, error messages).
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
}
