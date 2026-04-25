/**
 * Rate limiting — cheap, per-route, fail-open.
 *
 * Backed by Upstash Redis + sliding-window counters. The goal isn't
 * fine-grained fairness; it's preventing a single bad actor (or a looping
 * bug) from racking up $200 of Claude calls in an hour.
 *
 * Design choices:
 *   - Fail OPEN. If Upstash is down or env vars are missing, requests
 *     pass through. Degrading public Gabby because our limiter is
 *     broken is worse than the cost exposure.
 *   - Key by (route, identifier). Identifier = auth user id when known,
 *     falls back to X-Forwarded-For (Vercel), falls back to a constant
 *     (i.e. all anonymous clients share a bucket — still a global cap).
 *   - Limits are expressed per minute AND per day. A shopper might
 *     legitimately send 10 messages in a minute; nobody legitimately
 *     sends 5000 in a day.
 *
 * To activate in prod:
 *   1. Create an Upstash Redis database (free tier is fine).
 *   2. Paste UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN into
 *      Vercel env vars for production.
 *   3. Redeploy. No code change needed.
 *
 * Until you do that, the module logs "rate-limit disabled" once on cold
 * start and every check returns `{ success: true }`.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let warned = false;
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      // eslint-disable-next-line no-console
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL / _TOKEN not set — rate limiting is disabled (fail-open).",
      );
      warned = true;
    }
    return null;
  }
  return new Redis({ url, token });
}

type LimiterName =
  | "gabby-chat"
  | "assist-message"
  | "assist-create"
  | "gabby-recommend"
  | "support-ticket"
  | "photo-submit"
  | "inventory-enrich"
  | "stripe-checkout"
  | "account-export"
  | "sms-send";

const CONFIG: Record<LimiterName, { perMinute: number; perDay: number }> = {
  // Public shopper-facing Gabby. A chatty shopper in a store might do
  // 20 turns in 5 minutes; 30/min is plenty. Daily cap is where cost
  // protection kicks in.
  "gabby-chat":       { perMinute: 30,  perDay: 500 },
  // Customer continuation of a staff-initiated handoff. Same shape.
  "assist-message":   { perMinute: 30,  perDay: 500 },
  // Employees creating handoff sessions. Rarer than shopper chat.
  "assist-create":    { perMinute: 10,  perDay: 200 },
  // Guided recommend flow — one call per "finish the wizard" action.
  "gabby-recommend":  { perMinute: 20,  perDay: 300 },
  // Report-a-problem tickets. Abuse here = our own ticket queue, but
  // still worth bounding.
  "support-ticket":   { perMinute: 5,   perDay: 30 },
  // Catalog photo upload → moderation (OpenAI + Claude Haiku cost). A
  // diligent staffer shooting a shelf of 200 products could legitimately
  // do 60-80/min; 90/min is a comfortable ceiling. Daily cap keeps a
  // possessed client bot from clearing the free-tier moderation quota.
  "photo-submit":     { perMinute: 90,  perDay: 2000 },
  // Manual inventory enrichment (OpenFoodFacts + Claude). Each call hits
  // external APIs, so we want this tight — it's a debug/tooling endpoint,
  // not a production write path.
  "inventory-enrich": { perMinute: 10,  perDay: 200 },
  // Stripe Checkout session creation. Stripe's API is itself rate-limited,
  // but we don't want a malicious client creating sessions in a loop to
  // enumerate stolen cards (Apple 5.1.1 / PCI consideration).
  "stripe-checkout":  { perMinute: 5,   perDay: 50 },
  // GDPR data export. Expensive to compute (multi-table scan) and a vector
  // for scraping a user's full history repeatedly. Users rarely need more
  // than 1-2 exports ever.
  "account-export":   { perMinute: 2,   perDay: 10 },
  // Outbound SMS via Sendblue. Each message costs real money (~$0.01-0.02
  // per send after A2P approval). Per-user cap means a compromised staff
  // account can't drain the SMS budget overnight. Per-minute cap is
  // generous enough for legitimate bursts (e.g. notifying a queue of
  // hold-pickup customers after restock). Bucket is per-user, not
  // per-store, so 5 staff members = 5x the ceiling naturally.
  "sms-send":         { perMinute: 20,  perDay: 200 },
};

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: LimiterName, window: "1 m" | "1 d"): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${name}:${window}`;
  const existing = limiters.get(key);
  if (existing) return existing;
  const cfg = CONFIG[name];
  const limit = window === "1 m" ? cfg.perMinute : cfg.perDay;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix: `bevtek:${name}`,
  });
  limiters.set(key, rl);
  return rl;
}

/**
 * Extract a stable identifier from the request. Prefers an explicit
 * identifier (e.g. user id), then the X-Forwarded-For first hop, then a
 * shared "anon" bucket as a last resort.
 */
export function identifyRequest(req: Request, explicit?: string | null): string {
  if (explicit) return `u:${explicit}`;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return `ip:${xff.split(",")[0].trim()}`;
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return `ip:${cf}`;
  return "anon";
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
  /** Which window blocked, if any — for the error response. */
  window?: "1 m" | "1 d";
};

/**
 * Check both the per-minute and per-day limits. Returns the FIRST one
 * that fails so the error message can tell the user which window they
 * hit. When rate limiting is disabled, always returns success.
 */
export async function checkRate(
  name: LimiterName,
  identifier: string,
): Promise<RateLimitResult> {
  const mRl = getLimiter(name, "1 m");
  if (!mRl) return { success: true, remaining: Infinity, reset: 0 };

  const perMin = await mRl.limit(identifier);
  if (!perMin.success) {
    return {
      success: false,
      remaining: perMin.remaining,
      reset: perMin.reset,
      window: "1 m",
    };
  }
  const dRl = getLimiter(name, "1 d");
  if (!dRl) return { success: true, remaining: perMin.remaining, reset: perMin.reset };

  const perDay = await dRl.limit(identifier);
  return {
    success: perDay.success,
    remaining: Math.min(perMin.remaining, perDay.remaining),
    reset: perDay.success ? perMin.reset : perDay.reset,
    window: perDay.success ? undefined : "1 d",
  };
}

/**
 * Convenience: build the standard 429 response with Retry-After.
 */
export function rateLimitResponse(res: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  const body = {
    error:
      res.window === "1 d"
        ? "Daily request limit reached. Try again tomorrow."
        : "Too many requests — slow down a moment and try again.",
    retryAfter,
  };
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Remaining": String(res.remaining),
    },
  });
}

// ---------------------------------------------------------------------------
// Server-action variant
// ---------------------------------------------------------------------------
// Server Actions don't receive a `Request` object the way route handlers do,
// so we read headers via next/headers and compose the identifier ourselves.
// Callers pass the authenticated userId when they have one (strongly
// preferred — an IP-based bucket is the last resort because a store's
// public Wi-Fi can shove 50 shoppers behind one NAT).

import { headers } from "next/headers";

/**
 * Server-action-friendly rate-limit check. Returns the same shape as
 * `checkRate`. Prefers `userId` as the identifier; falls back to the
 * request's X-Forwarded-For / cf-connecting-ip; falls back to "anon".
 */
export async function checkRateForServerAction(
  name: LimiterName,
  userId: string | null,
): Promise<RateLimitResult> {
  let identifier: string;
  if (userId) {
    identifier = `u:${userId}`;
  } else {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const cf = h.get("cf-connecting-ip");
    if (xff) identifier = `ip:${xff.split(",")[0].trim()}`;
    else if (cf) identifier = `ip:${cf}`;
    else identifier = "anon";
  }
  return checkRate(name, identifier);
}
