// Nightly retention sweeper.
//
// Runs as a Vercel Cron (see vercel.json). Deletes stale rows from tables
// whose retention policy is short and whose long-tail value is near zero.
// Keeping these trimmed matters for GDPR Art. 5(1)(e) ("data minimization"),
// for SOC 2 retention controls, and for raw Postgres performance — the
// webhook_events idempotency index is hotter when it's smaller.
//
// Retention choices:
//   - webhook_events:  30 days. Idempotency guarantees expire when the
//       provider stops retrying (Stripe: 3 days, Retell: hours, Sendblue:
//       hours). 30 days is belt-and-suspenders for late investigation.
//   - audit_events:    365 days. SOC 2 Type II evidence window is 12 months.
//       We keep exactly that and no longer, so a legal request can't reach
//       into data we aren't obligated to retain.
//
// Auth: Vercel Cron pings this route with a `x-vercel-cron` signature that
// we don't have a convenient way to verify, so we also accept a Bearer
// `CRON_SECRET` — set it in Vercel env + in the cron trigger headers. Any
// request missing BOTH is rejected. (Stripe-style dual-auth.)
//
// Fail mode: we count and return. Never throw — a failed sweep should not
// page anyone at 03:00. Sentry captures the exception for morning review.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
// Cron routes are inherently dynamic — disable caching explicitly so a
// stale response can't be served to the scheduler.
export const dynamic = "force-dynamic";

const WEBHOOK_RETENTION_DAYS = 30;
const AUDIT_RETENTION_DAYS = 365;

function authorized(req: Request): boolean {
  // Vercel Cron includes this header on scheduled invocations.
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;
  // Manual trigger: curl -H "Authorization: Bearer $CRON_SECRET" ...
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

async function sweep(
  client: ReturnType<typeof svc>,
  table: "webhook_events" | "audit_events",
  column: "received_at" | "created_at",
  olderThanDays: number,
): Promise<{ table: string; deleted: number; error?: string }> {
  if (!client) return { table, deleted: 0, error: "service-client-unavailable" };
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  try {
    // `select('id', { count: 'exact', head: true })` with a delete isn't
    // supported; we use delete().lt().select() which returns deleted rows.
    // On large sweeps this could be slow — if the table grows, replace
    // with a SQL RPC that does the delete in a single statement.
    const { error, count } = await client
      .from(table)
      .delete({ count: "exact" })
      .lt(column, cutoff.toISOString());
    if (error) {
      Sentry.captureException(error, {
        tags: { cron: "retention", table },
      });
      return { table, deleted: 0, error: error.message };
    }
    return { table, deleted: count ?? 0 };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { cron: "retention", table },
    });
    return { table, deleted: 0, error: (e as Error).message };
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const client = svc();
  const started = Date.now();
  const results = await Promise.all([
    sweep(client, "webhook_events", "received_at", WEBHOOK_RETENTION_DAYS),
    sweep(client, "audit_events", "created_at", AUDIT_RETENTION_DAYS),
  ]);
  return NextResponse.json({
    ok: results.every((r) => !r.error),
    ranAt: new Date().toISOString(),
    elapsed_ms: Date.now() - started,
    results,
  });
}

// POST is an alias so manual `curl -X POST` triggers work without needing
// a body. Same auth requirement.
export const POST = GET;
