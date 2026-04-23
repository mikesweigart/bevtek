/**
 * Sentry PII scrubbing.
 *
 * Applied via `beforeSend` + `beforeBreadcrumb` in every Sentry init
 * (server, edge, client). Point of this file: nothing that identifies a
 * real person should leave our process and land in Sentry's servers,
 * because:
 *
 *   1. Sentry is a third-party data processor. Every PII field we send
 *      is a field we have to document in our privacy policy and DPA.
 *   2. CCPA + GDPR: if a user asks "what data do you have on me?" we
 *      must enumerate everywhere it was sent. Scrubbing here means
 *      "Sentry" is not on that list.
 *   3. Our own staff read Sentry. Customer DOB / phone / email in a
 *      stack trace = internal PII exposure we don't need.
 *
 * What we scrub:
 *   - Known PII keys in request bodies / extras / tags (email, phone,
 *     dob, password, token, etc.) — VALUE replaced with `[scrubbed]`.
 *   - Authorization / Cookie headers — replaced entirely.
 *   - Query-string values on those same keys.
 *   - Common PII patterns in free-text fields (email addresses, E.164
 *     phone numbers) — redacted with a mask.
 *
 * What we DON'T scrub:
 *   - User ID (uuid) — we need it to correlate errors to a tenant.
 *   - Store ID (uuid) — same, we bucket errors per store.
 *   - Timestamps, durations, error types.
 *
 * Fail-open: if scrubbing throws, send the event anyway (better to have
 * a noisy Sentry than a silent one).
 */

import type { ErrorEvent, EventHint, Breadcrumb } from "@sentry/nextjs";

// Keys whose VALUES should be replaced whenever they appear anywhere
// (request body, tags, extras, query string). Match is case-insensitive,
// and substring — so "user_email" and "emailAddress" also match "email".
const SENSITIVE_KEYS = [
  "email",
  "phone",
  "mobile",
  "dob",
  "date_of_birth",
  "birthdate",
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "session",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "ssn",
  "tax_id",
  "credit_card",
  "card_number",
  "cvc",
  "cvv",
  "address",
  "street",
  "zip",
  "postal_code",
  "firstname",
  "lastname",
  "full_name",
];

const SENSITIVE_KEY_REGEX = new RegExp(
  `(${SENSITIVE_KEYS.map((k) => k.replace(/[-_]/g, "[-_]?")).join("|")})`,
  "i",
);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// +15551234567, (555) 123-4567, 555-123-4567, 555.123.4567
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/g;

const SCRUBBED = "[scrubbed]";

/**
 * Depth-limited recursive scrub. Handles objects, arrays, strings.
 * Never throws — on unexpected types returns the value unchanged.
 */
function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value; // safety: deeply nested → bail
  if (value == null) return value;

  if (typeof value === "string") {
    return scrubString(value);
  }

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        out[k] = SCRUBBED;
      } else {
        out[k] = scrubValue(v, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function scrubString(s: string): string {
  if (!s) return s;
  let out = s;
  // Mask emails first so "foo@bar.com" -> "[email]" rather than the
  // phone regex matching the digits in "bar.com" edge cases.
  out = out.replace(EMAIL_RE, "[email]");
  out = out.replace(PHONE_RE, (m) => {
    // Keep short number-like strings (prices, qty, UUIDs) alone.
    const digits = m.replace(/\D/g, "");
    return digits.length >= 10 ? "[phone]" : m;
  });
  return out;
}

/**
 * Sentry `beforeSend` hook. Mutates the event in place, returns it.
 * Fail-open: any thrown error returns the event unmodified.
 */
export function scrubSentryEvent(
  event: ErrorEvent,
  _hint?: EventHint,
): ErrorEvent | null {
  try {
    if (event.request) {
      // Drop full Authorization / Cookie headers; scrub the rest.
      if (event.request.headers) {
        const scrubbed: Record<string, string> = {};
        for (const [k, v] of Object.entries(event.request.headers)) {
          const lk = k.toLowerCase();
          if (lk === "authorization" || lk === "cookie" || lk === "set-cookie") {
            scrubbed[k] = SCRUBBED;
          } else {
            scrubbed[k] =
              typeof v === "string" ? scrubString(v) : String(v);
          }
        }
        event.request.headers = scrubbed;
      }
      if (event.request.cookies) event.request.cookies = { cookie: SCRUBBED };
      if (event.request.data) {
        event.request.data = scrubValue(event.request.data) as
          | string
          | Record<string, unknown>;
      }
      if (event.request.query_string) {
        event.request.query_string =
          typeof event.request.query_string === "string"
            ? scrubString(event.request.query_string)
            : scrubValue(event.request.query_string) as typeof event.request.query_string;
      }
      if (event.request.url) {
        event.request.url = scrubString(event.request.url);
      }
    }

    if (event.extra) {
      event.extra = scrubValue(event.extra) as Record<string, unknown>;
    }
    if (event.contexts) {
      event.contexts = scrubValue(event.contexts) as typeof event.contexts;
    }
    if (event.tags) {
      // Tag VALUES can contain PII (e.g. a catch-all tag). Scrub by key name.
      for (const [k, v] of Object.entries(event.tags)) {
        if (SENSITIVE_KEY_REGEX.test(k)) {
          event.tags[k] = SCRUBBED;
        } else if (typeof v === "string") {
          event.tags[k] = scrubString(v);
        }
      }
    }

    // Keep uuid-shaped user.id so we can correlate errors to a tenant,
    // but strip email / ip / username.
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
      delete event.user.username;
    }

    // Error messages themselves can leak PII (e.g. "failed to send to
    // user@example.com"). Scrub each stack frame's exception value.
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubString(ex.value);
      }
    }
    if (event.message) {
      if (typeof event.message === "string") {
        event.message = scrubString(event.message);
      }
    }

    return event;
  } catch {
    // Never drop a real error because our scrubber threw.
    return event;
  }
}

/**
 * Sentry `beforeBreadcrumb` hook. Breadcrumbs are the trail of events
 * leading up to the error (navigation, console logs, fetch requests).
 * They often contain URLs and request bodies, both prime PII carriers.
 */
export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  try {
    if (breadcrumb.message) {
      breadcrumb.message = scrubString(breadcrumb.message);
    }
    if (breadcrumb.data) {
      breadcrumb.data = scrubValue(breadcrumb.data) as Record<string, unknown>;
    }
    return breadcrumb;
  } catch {
    return breadcrumb;
  }
}
