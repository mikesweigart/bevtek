import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAIConfigured } from "@/lib/ai/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + dependency probe.
 *
 * Returns 200 with a status summary when everything is reachable, 503
 * when any critical dependency is down. Cheap enough to hit every 30s
 * from an uptime monitor (one SELECT 1 against Supabase + env checks).
 *
 * Never include sensitive data — this endpoint is public.
 */
type Check = { name: string; ok: boolean; ms: number; detail?: string };

async function timed<T>(name: string, fn: () => Promise<T>): Promise<Check> {
  const t0 = Date.now();
  try {
    await fn();
    return { name, ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      detail: (e as Error)?.message ?? "unknown",
    };
  }
}

export async function GET() {
  const checks: Check[] = [];

  // Supabase — cheapest possible read. We pick `stores` because it's
  // public-readable via RLS in most configurations; if it starts failing
  // here we know the DB is up but policies are off.
  checks.push(
    await timed("supabase", async () => {
      const supabase = await createClient();
      const { error } = await supabase
        .from("stores")
        .select("id", { head: true, count: "exact" })
        .limit(1);
      if (error) throw new Error(error.message);
    }),
  );

  // Anthropic — we don't actually call the API (would cost money on a
  // health check). Just report whether the key is configured. Real
  // outages surface in the [claude.call] structured logs.
  checks.push({
    name: "anthropic",
    ok: isAIConfigured(),
    ms: 0,
    detail: isAIConfigured() ? undefined : "ANTHROPIC_API_KEY not set",
  });

  // Upstash rate limiter — fail-open by design; we report it as
  // degraded (not down) when unconfigured so uptime monitors aren't
  // noisy about a deliberate soft-off.
  checks.push({
    name: "rate-limit",
    ok: true,
    ms: 0,
    detail:
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? "configured"
        : "disabled (fail-open)",
  });

  const allCritical = checks.filter((c) => c.name === "supabase");
  const ok = allCritical.every((c) => c.ok);
  const body = {
    ok,
    ranAt: new Date().toISOString(),
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    checks,
  };
  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
