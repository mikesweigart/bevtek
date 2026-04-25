import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAIConfigured } from "@/lib/ai/claude";
import { isSendblueConfigured } from "@/lib/sms/sendblue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deep readiness probe.
//
// Contrast with /api/health (liveness):
//   - /api/health is hit every 30s by uptime monitors. Must be fast,
//     cheap, public. Just answers "can this container serve traffic?"
//   - /api/health/readiness is hit on-demand during deploy or when an
//     operator is triaging an issue. Answers "are all the moving parts
//     of the stack actually configured and reachable?" Protected by a
//     shared secret so we can report env-var presence safely.
//
// AUTH
//   Shared secret via `x-health-secret` header OR `?secret=` query. Set
//   HEALTH_READINESS_SECRET in env. When unset we reject ALL requests
//   (401) — leaking "what vendors are we integrated with and which are
//   misconfigured" publicly is a gift to attackers.
//
// CHECKS
//   Env-level: Supabase, Anthropic, Retell, Sendblue, Korona (global
//   pieces), Upstash rate limit, Sentry DSN, Stripe.
//   Store-level: counts of stores total, stores missing each per-store
//   config (retell_phone_number, sendblue_number, sendblue_webhook_secret,
//   store_integrations/korona). These are the migrations-already-applied
//   indicators — a new tenant shows up as "1 store, missing X Y Z."
//
// SUPABASE CONNECTION
//   We use the SERVICE-ROLE client here, not the SSR cookie client. The
//   readiness probe is server-to-server (no user session), and we want
//   to see data regardless of RLS — a bad RLS policy that hides stores
//   from SSR should show up as "0 stores visible" vs. the service-role
//   count, which is a useful signal.

type Check = {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
  /** Non-critical checks don't fail the overall probe. */
  critical?: boolean;
};

async function timed(
  name: string,
  fn: () => Promise<string | undefined>,
  opts: { critical?: boolean } = {},
): Promise<Check> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - t0, detail, critical: opts.critical };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      detail: (e as Error)?.message ?? "unknown",
      critical: opts.critical,
    };
  }
}

function envOk(
  name: string,
  keys: string[],
  opts: { critical?: boolean } = {},
): Check {
  const missing = keys.filter((k) => !process.env[k]);
  return {
    name,
    ok: missing.length === 0,
    ms: 0,
    detail: missing.length === 0 ? "configured" : `missing: ${missing.join(", ")}`,
    critical: opts.critical,
  };
}

export async function GET(req: NextRequest) {
  // 1. Auth — reject anything without the shared secret. Fail closed if
  // the secret is unset (operator misconfiguration is worse than a 401).
  const expected = process.env.HEALTH_READINESS_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "HEALTH_READINESS_SECRET not set" },
      { status: 401 },
    );
  }
  const provided =
    req.headers.get("x-health-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    null;
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const checks: Check[] = [];

  // 2. Supabase — actual round-trip. Use service role to sidestep RLS so
  // a broken policy shows up distinctly from a broken connection.
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let storeCount = 0;

  checks.push(
    await timed(
      "supabase",
      async () => {
        if (!supaUrl || !supaKey) throw new Error("service role env missing");
        const svc = createServiceClient(supaUrl, supaKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { count, error } = await svc
          .from("stores")
          .select("id", { head: true, count: "exact" });
        if (error) throw new Error(error.message);
        storeCount = count ?? 0;
        return `${storeCount} stores`;
      },
      { critical: true },
    ),
  );

  // 3. Also hit Supabase via the SSR/cookie client — differences here
  // hint at RLS misconfiguration.
  checks.push(
    await timed("supabase-rls", async () => {
      const ssr = await createClient();
      const { error } = await ssr
        .from("stores")
        .select("id", { head: true })
        .limit(1);
      if (error) throw new Error(error.message);
      return "anonymous read OK";
    }),
  );

  // 4. Env-level vendor config. None of these are dependency calls —
  // they only report whether the env vars are populated. Actually
  // calling each vendor on every readiness probe costs money and
  // introduces flakiness from their rate limits / timeouts.
  checks.push({
    name: "anthropic",
    ok: isAIConfigured(),
    ms: 0,
    detail: isAIConfigured() ? "configured" : "ANTHROPIC_API_KEY not set",
    critical: true,
  });
  checks.push(envOk("retell-tool", ["RETELL_TOOL_SECRET"], { critical: true }));
  checks.push({
    name: "sendblue",
    ok: isSendblueConfigured(),
    ms: 0,
    detail: isSendblueConfigured()
      ? "configured"
      : "SENDBLUE_API_KEY_ID / _SECRET_KEY not set",
  });
  checks.push(envOk("stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]));
  checks.push(envOk("sentry", ["SENTRY_DSN"]));
  checks.push({
    name: "rate-limit",
    ok: true,
    ms: 0,
    detail:
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? "configured"
        : "disabled (fail-open)",
  });

  // 5. Per-store configuration audit. Run with service role so RLS doesn't
  // hide rows. These aren't ok/fail — they're counts that give the
  // operator a "here's what's left to provision per tenant" view.
  let perStore: Record<string, number | string> = {};
  if (supaUrl && supaKey) {
    try {
      const svc = createServiceClient(supaUrl, supaKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const [retell, sendblueNum, sendblueSecret, korona] = await Promise.all([
        svc
          .from("stores")
          .select("id", { head: true, count: "exact" })
          .is("retell_phone_number", null),
        svc
          .from("stores")
          .select("id", { head: true, count: "exact" })
          .is("sendblue_number", null),
        svc
          .from("stores")
          .select("id", { head: true, count: "exact" })
          .is("sendblue_webhook_secret", null),
        svc
          .from("store_integrations")
          .select("store_id", { head: true, count: "exact" })
          .eq("provider", "korona")
          .eq("enabled", true),
      ]);

      perStore = {
        stores_total: storeCount,
        missing_retell_phone_number: retell.count ?? 0,
        missing_sendblue_number: sendblueNum.count ?? 0,
        missing_sendblue_webhook_secret: sendblueSecret.count ?? 0,
        korona_enabled: korona.count ?? 0,
      };
    } catch (e) {
      perStore = { error: (e as Error)?.message ?? "unknown" };
    }
  }

  // 6. Overall ok = every CRITICAL check passes. Non-critical checks are
  // informational — a missing Stripe key is fine in dev, worth flagging
  // in prod, but shouldn't fail a deployment health gate.
  const ok = checks.filter((c) => c.critical).every((c) => c.ok);

  return NextResponse.json(
    {
      ok,
      ranAt: new Date().toISOString(),
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      checks,
      per_store: perStore,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
