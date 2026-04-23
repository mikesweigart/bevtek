// Nightly KORONA sync cron.
//
// Pulls `/products` for every store with an enabled `store_integrations`
// row where provider='korona', and upserts into `inventory`. Runs at 04:00
// UTC (see vercel.json) — staggered from the 03:15 retention sweep so the
// two don't compete for a cold Supabase connection.
//
// Auth mirrors other cron routes: Vercel's `x-vercel-cron` header OR a
// Bearer `CRON_SECRET` for manual triggering. Never exposes unauthenticated.
//
// Scheduling choice — serial, not parallel:
//   We call `syncKoronaProducts(storeId)` one at a time. KORONA's API has
//   unpublished rate limits and we'd rather be a good citizen (and easier
//   to debug when one store's sync misbehaves) than shave a few minutes
//   by running N stores in parallel. With N < 50 stores and ~1s/page,
//   serial completes in well under the Vercel cron function timeout.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { syncKoronaProducts } from "@/lib/korona/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pro plan allows longer — up to 300s. Default 10s would time out on
// multi-store pulls. Revisit if we breach 300s (switch to per-store
// trigger + queue).
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization") ?? "";
  const bearerMatch = secret && bearer === `Bearer ${secret}`;
  return isVercelCron || !!bearerMatch;
}

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function enabledKoronaStores(): Promise<string[]> {
  const client = svc();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("store_integrations")
      .select("store_id")
      .eq("provider", "korona")
      .eq("enabled", true);
    if (error || !data) return [];
    return (data as Array<{ store_id: string }>).map((r) => r.store_id);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const storeIds = await enabledKoronaStores();

  const results: Array<{
    storeId: string;
    ok: boolean;
    status?: "ok" | "partial" | "failed";
    counters: unknown;
    error?: string;
  }> = [];

  for (const storeId of storeIds) {
    const r = await syncKoronaProducts(storeId);
    if (r.ok) {
      results.push({
        storeId,
        ok: true,
        status: r.status,
        counters: r.counters,
      });
    } else {
      results.push({
        storeId,
        ok: false,
        status: "failed",
        counters: r.counters,
        error: r.error,
      });
      Sentry.captureMessage("korona-sync store failed", {
        level: "warning",
        tags: { integration: "korona", cron: "korona-sync" },
        extra: { storeId, error: r.error, counters: r.counters },
      });
    }
  }

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    ranAt: new Date().toISOString(),
    elapsed_ms: Date.now() - started,
    stores_total: storeIds.length,
    stores_ok: results.filter((r) => r.ok).length,
    stores_failed: results.filter((r) => !r.ok).length,
    results,
  });
}

export const POST = GET;
