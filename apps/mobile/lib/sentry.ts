// Sentry — mobile init. DSN-gated via EXPO_PUBLIC_SENTRY_DSN so the
// module is safe to import on a build with no DSN configured (local
// dev, fresh clones, the first TestFlight build before you've set up
// Sentry in EAS).
//
// Important gotcha: @sentry/react-native brings native modules. Just
// installing the package is enough — BUT Sentry only starts capturing
// errors in a build that was compiled AFTER the install. Expo Go will
// not show native crashes; only a development-build or EAS Build will.
// See docs.expo.dev/guides/using-sentry.
//
// Usage: call initSentry() exactly once at the top of App.tsx. Use the
// wrapReport/reportError helpers from anywhere else — they no-op when
// Sentry isn't initialized, so components don't need to know whether
// the user has a DSN configured.

import * as Sentry from "@sentry/react-native";
import appJson from "../app.json";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Environment split so production crashes don't drown in
    // development noise. EAS sets EXPO_PUBLIC_ENV at build time
    // (configure in eas.json when you're ready).
    environment: process.env.EXPO_PUBLIC_ENV ?? "development",
    release: `bevtek-mobile@${appJson.expo.version}`,
    // Errors are always captured; sample perf at 10% to keep quota
    // sane. Turn up later if you want per-screen latency insight.
    tracesSampleRate: 0.1,
    // Breadcrumbs include network requests by default — our Supabase
    // calls don't carry passwords in URLs, so this is safe.
    enableAutoSessionTracking: true,
  });
  initialized = true;
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  // Always log to the JS console so developers see it in Metro even
  // when Sentry is off. Then forward to Sentry if it's live.
  // eslint-disable-next-line no-console
  console.error("[reportError]", err, context ?? {});
  if (!initialized) return;
  try {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setExtras(context);
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  } catch {
    // swallow — telemetry must never throw into our UI
  }
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    Sentry.addBreadcrumb({
      message,
      data,
      level: "info",
    });
  } catch {
    // swallow
  }
}

/** Identify the signed-in user so tickets/errors cluster by person. */
export function setSentryUser(user: { id: string; email?: string | null } | null) {
  if (!initialized) return;
  try {
    Sentry.setUser(user ? { id: user.id, email: user.email ?? undefined } : null);
  } catch {
    // swallow
  }
}
