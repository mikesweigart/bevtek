// Next.js instrumentation hook.
//
// Called once at server startup per runtime. We use it to wire Sentry
// into both the Node and Edge runtimes. See:
//   node_modules/next/dist/docs/01-app/02-guides/instrumentation.md
//   node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
//
// Both configs are DSN-gated — if no DSN is present, the imports run
// but Sentry.init() is skipped, so there's no cost to leaving this file
// here in envs without Sentry configured.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next 15+ exposes uncaught server errors here. Forward to Sentry with
// the request + route context so stack traces land in the right project.
export const onRequestError = Sentry.captureRequestError;
