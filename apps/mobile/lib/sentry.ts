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

// ---------------------------------------------------------------------------
// PII scrubbing — keep emails / phones / DOB / tokens out of Sentry.
// ---------------------------------------------------------------------------
// Mirror of apps/web/lib/sentry/scrub.ts, inlined here because mobile
// doesn't set up path aliases into the web package. Keep these two in
// sync when extending the key list.
const SENSITIVE_KEY_RE =
  /(email|phone|mobile|dob|date[-_]?of[-_]?birth|birthdate|password|pass?wd|pwd|secret|token|session|api[-_]?key|authorization|cookie|ssn|card[-_]?number|cvc|cvv|address|zip|postal[-_]?code|first[-_]?name|last[-_]?name|full[-_]?name)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/g;
const SCRUBBED = "[scrubbed]";

function scrubString(s: string): string {
  if (!s) return s;
  let out = s.replace(EMAIL_RE, "[email]");
  out = out.replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[phone]" : m));
  return out;
}

function scrubValue(v: unknown, depth = 0): unknown {
  if (depth > 8 || v == null) return v;
  if (typeof v === "string") return scrubString(v);
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? SCRUBBED : scrubValue(val, depth + 1);
    }
    return out;
  }
  return v;
}

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
    // Don't send device IPs / cookies / default PII fields.
    sendDefaultPii: false,
    // Redact emails/phones/DOB/tokens before events leave the device.
    beforeSend(event) {
      try {
        if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
        if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
        if (event.tags) {
          for (const [k, v] of Object.entries(event.tags)) {
            if (SENSITIVE_KEY_RE.test(k)) event.tags[k] = SCRUBBED;
            else if (typeof v === "string") event.tags[k] = scrubString(v);
          }
        }
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
          delete event.user.username;
        }
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = scrubString(ex.value);
          }
        }
        if (typeof event.message === "string") {
          event.message = scrubString(event.message);
        }
      } catch {
        /* fail-open */
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      try {
        if (breadcrumb.message) breadcrumb.message = scrubString(breadcrumb.message);
        if (breadcrumb.data) breadcrumb.data = scrubValue(breadcrumb.data) as Record<string, unknown>;
      } catch {
        /* fail-open */
      }
      return breadcrumb;
    },
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

/**
 * Identify the signed-in user so errors cluster by person. We send ONLY
 * the opaque UUID — no email, no phone, no username. Staff debugging in
 * Sentry get a shape ("user abc123 hit this crash 3 times") without the
 * PII that would show up in support tickets, screen shares, or breach
 * disclosures.
 */
export function setSentryUser(user: { id: string } | null) {
  if (!initialized) return;
  try {
    Sentry.setUser(user ? { id: user.id } : null);
  } catch {
    // swallow
  }
}
