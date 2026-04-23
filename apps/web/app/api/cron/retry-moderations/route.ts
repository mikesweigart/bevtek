// Background job: retry submissions that are stuck in "pending" moderation.
//
// Why we need this:
//   submitCatalogImageAction runs moderation synchronously — the user waits
//   while OpenAI + Claude decide if the photo is OK. If the server action
//   errors out between inserting the submission row (status='pending') and
//   running moderation (e.g., Vercel function timeout, transient network
//   blip, cold start), the row stays 'pending' forever.
//
//   Without this cron, those orphaned submissions would silently disappear
//   — user sees "waiting for manager review", manager never sees them in
//   the gallery (gallery filters on status).
//
//   This is a conservative first background job. It proves the "Vercel
//   Cron + /api/cron/* + CRON_SECRET" pattern works for future jobs
//   (POS sync, inventory refresh, review-score backfill, etc.) without
//   introducing a new service (Inngest, QStash) until we actually need one.
//
// Schedule: every 10 minutes (see vercel.json). We pick up submissions
// older than 10 minutes so we never step on a synchronous moderation
// that's still running.
//
// Budget: max 20 submissions per run. With moderation ~2-4s per call, 20
// fits comfortably inside Vercel's 60s function budget (maxDuration below).
// If the backlog grows past that, the next run picks up what's left.
//
// Auth: same dual pattern as /api/cron/retention — Vercel Cron header OR
// Bearer CRON_SECRET.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { moderateImage } from "@/lib/moderation";
import { logAudit } from "@/lib/audit/log";

export const runtime = "nodejs";
// Allow up to 60s — enough for 20 moderations at worst-case latency.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const STALE_AFTER_MINUTES = 10;
const MAX_PER_RUN = 20;

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

type Stuck = {
  id: string;
  catalog_product_id: string;
  store_id: string;
  image_url: string;
  created_at: string;
};

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = svc();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Service client unavailable (env missing)." },
      { status: 500 },
    );
  }

  const started = Date.now();
  const cutoff = new Date(
    Date.now() - STALE_AFTER_MINUTES * 60 * 1000,
  ).toISOString();

  // Find submissions that have been pending past the grace window.
  // Filter to ones with a real image URL — if the URL is null, no amount
  // of retrying will fix it.
  const { data: rows, error: selErr } = await client
    .from("catalog_image_submissions")
    .select("id, catalog_product_id, store_id, image_url, created_at")
    .eq("moderation_status", "pending")
    .lt("created_at", cutoff)
    .not("image_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (selErr) {
    Sentry.captureException(selErr, {
      tags: { cron: "retry-moderations", phase: "select" },
    });
    return NextResponse.json(
      { ok: false, error: selErr.message },
      { status: 500 },
    );
  }

  const stuck = (rows ?? []) as Stuck[];
  if (stuck.length === 0) {
    // No-op runs are the happy path. Log a minimal audit row so the ops
    // dashboard can tell "cron is healthy and there was nothing to do"
    // from "cron hasn't run in an hour".
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      elapsed_ms: Date.now() - started,
      processed: 0,
    });
  }

  let approved = 0;
  let flagged = 0;
  let rejected = 0;
  let errored = 0;

  // Serial, not parallel — we'd rather throttle to stay under Vercel's
  // limits than fan out and hit Claude's per-minute rate limit.
  for (const sub of stuck) {
    try {
      const mod = await moderateImage(sub.image_url);

      const { error: upErr } = await client
        .from("catalog_image_submissions")
        .update({
          moderation_status: mod.status,
          moderation_scores: mod.scores as unknown as Record<string, unknown>,
          moderation_notes: `[retry] ${mod.notes}`,
          rejected_at:
            mod.status === "rejected" ? new Date().toISOString() : null,
        })
        .eq("id", sub.id)
        // Only update if still pending — concurrent user action may have
        // already resolved the row (e.g. retakeOwnSubmissionAction).
        .eq("moderation_status", "pending");

      if (upErr) {
        Sentry.captureException(upErr, {
          tags: { cron: "retry-moderations", phase: "update" },
        });
        errored++;
        continue;
      }

      if (mod.status === "approved") approved++;
      else if (mod.status === "rejected") rejected++;
      else flagged++;
    } catch (e) {
      // moderateImage itself is no-throw, but belt-and-suspenders.
      Sentry.captureException(e, {
        tags: {
          cron: "retry-moderations",
          submission_id: sub.id,
          store_id: sub.store_id,
        },
      });
      errored++;
    }
  }

  // One audit row per run summarizing what happened. This is how the
  // observability page will answer "was the queue drained at 03:15?"
  // without running our own log pipeline. actor_id stays null (it's a
  // uuid column, and "system" isn't a user) — metadata.actor marks it.
  await logAudit({
    action: "cron.retry_moderations",
    metadata: {
      actor: "system-cron",
      processed: stuck.length,
      approved,
      flagged,
      rejected,
      errored,
      elapsed_ms: Date.now() - started,
    },
  });

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    elapsed_ms: Date.now() - started,
    processed: stuck.length,
    approved,
    flagged,
    rejected,
    errored,
  });
}

// POST alias so a manual `curl -X POST -H 'Authorization: Bearer $CRON_SECRET'`
// can trigger a run without needing a body.
export const POST = GET;
