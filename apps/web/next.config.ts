import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security headers applied to every response. Two-header CSP approach:
//   1. Content-Security-Policy (enforced) — ONLY the directives that are
//      safe to lock down today because they almost never need inline/unsafe
//      exceptions (object-src, base-uri, form-action, frame-ancestors).
//   2. Content-Security-Policy-Report-Only — stricter script/style policy in
//      observation mode. Violations get logged but don't block loads, so we
//      can watch Sentry for a week, tune the allowlist, then promote.
//
// TODO: promote to a single enforced CSP with strict-dynamic + nonces once
// we've stopped seeing false-positive reports from vercel.live, Sentry
// tunnel, and any hydration-scripts we haven't enumerated yet.
const CSP_ENFORCED = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // Harmless on Vercel (always HTTPS) but covers dev / local-preview edges.
  "upgrade-insecure-requests",
].join("; ");

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' for hydration bootstrap; 'unsafe-eval' is
  // required by the Vercel preview toolbar and a couple of our chart libs.
  // We'll migrate to strict-dynamic + nonces when we revisit CSP.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel.live https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase (REST + realtime), Sentry tunnel & direct, Anthropic, OpenAI,
  // Vercel live preview websocket.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://api.anthropic.com https://api.openai.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src 'self' https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

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
  // CSP enforced: only the "can't break anything" directives.
  { key: "Content-Security-Policy", value: CSP_ENFORCED },
  // CSP observation: stricter policy, violations logged but not blocked.
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
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
  async redirects() {
    // /photo-mode → /update-inventory (2026-04-23 rename). Permanent (308)
    // because the old path is gone for good; stale bookmarks, Slack links,
    // and dashboard screenshots all land on the new surface. Kept in config
    // rather than middleware so it runs before the filesystem check and
    // there's no cost to the common case of direct /update-inventory hits.
    return [
      {
        source: "/photo-mode",
        destination: "/update-inventory",
        permanent: true,
      },
      {
        source: "/photo-mode/:path*",
        destination: "/update-inventory/:path*",
        permanent: true,
      },
    ];
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
