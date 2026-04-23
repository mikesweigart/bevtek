// KORONA → BevTek inventory sync.
//
// Flow per store:
//   1. Open a `pos_sync_runs` row (status=running) so the dashboard shows
//      "sync in progress" even if the process crashes before finishing.
//   2. Read KORONA config from `store_integrations`. Missing config → we
//      mark the run `skipped` (status=ok, metadata.reason='no-config').
//   3. Paginate `/products`, upserting each to `inventory` by (store_id, sku).
//   4. Close the run with the final counts.
//
// Upsert strategy:
//   - Match by (store_id, sku) — the existing unique index on
//     `inventory`. If the product has no `number` (SKU), we skip it rather
//     than create a null-SKU row (would collide with other null-SKU rows
//     because Postgres treats NULL != NULL in unique indexes, producing
//     duplicates over time).
//   - We NEVER touch `stock_qty` from products sync — product data doesn't
//     include stock. A future `/inventories` sync updates stock separately.
//   - We preserve existing `cost`, `description`, `tasting_notes`,
//     `is_active` because operators/Megan enrich those post-import; we
//     only write the columns that come straight from KORONA.
//   - We stash the full raw product under `metadata.korona.raw` so we can
//     re-map new fields later without a re-pull.

import { createClient as createServiceClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  createKoronaClient,
  getKoronaConfig,
  KoronaApiError,
  type KoronaProduct,
} from "./client";

// Safety: a runaway loop is more costly than an incomplete sync. 1000 pages
// × 100 products/page = 100k products, which is ~14× the biggest store we
// expect. If we ever hit this, something is wrong — bail and audit-log.
const MAX_PAGES = 1000;
const PAGE_SIZE = 100;

export type SyncCounters = {
  rows_scanned: number;
  rows_upserted: number;
  rows_skipped: number;
  rows_failed: number;
};

export type SyncResult =
  | { ok: true; runId: string | null; counters: SyncCounters; status: "ok" | "partial" }
  | { ok: false; runId: string | null; counters: SyncCounters; error: string };

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Start a run row. Returns the id, or null if we can't write (proceeds anyway). */
async function openRun(storeId: string): Promise<string | null> {
  const client = svc();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("pos_sync_runs")
      .insert({ store_id: storeId, provider: "korona", status: "running" })
      .select("id")
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

async function closeRun(
  runId: string | null,
  fields: {
    status: "ok" | "partial" | "failed";
    counters: SyncCounters;
    error?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!runId) return;
  const client = svc();
  if (!client) return;
  try {
    await client
      .from("pos_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: fields.status,
        rows_scanned: fields.counters.rows_scanned,
        rows_upserted: fields.counters.rows_upserted,
        rows_skipped: fields.counters.rows_skipped,
        rows_failed: fields.counters.rows_failed,
        error_message: fields.error ?? null,
        metadata: fields.metadata ?? {},
      })
      .eq("id", runId);
  } catch {
    // Closing failed — leave the row in "running"; retention sweep will
    // mark it stale eventually. Don't let audit trouble break the sync.
  }
}

/** Bump stores.last_sync_at so the billing UI can show "Last synced 3h ago". */
async function markLastSync(storeId: string): Promise<void> {
  const client = svc();
  if (!client) return;
  try {
    await client
      .from("store_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .eq("provider", "korona");
  } catch {
    // Non-critical.
  }
}

/**
 * Sync one store's KORONA products into `inventory`. Never throws; returns
 * a result object the caller can log + aggregate. The cron route sums these
 * across all enabled stores.
 */
export async function syncKoronaProducts(storeId: string): Promise<SyncResult> {
  const counters: SyncCounters = {
    rows_scanned: 0,
    rows_upserted: 0,
    rows_skipped: 0,
    rows_failed: 0,
  };
  const runId = await openRun(storeId);

  const config = await getKoronaConfig(storeId);
  if (!config) {
    await closeRun(runId, {
      status: "ok",
      counters,
      metadata: { reason: "no-config" },
    });
    return { ok: true, runId, counters, status: "ok" };
  }

  const client = svc();
  if (!client) {
    await closeRun(runId, {
      status: "failed",
      counters,
      error: "service-client-unavailable",
    });
    return {
      ok: false,
      runId,
      counters,
      error: "service-client-unavailable",
    };
  }

  const korona = createKoronaClient(config);

  try {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= MAX_PAGES) {
      const resp = await korona.listProducts({ page, size: PAGE_SIZE });
      totalPages = Math.max(1, resp.pages);
      counters.rows_scanned += resp.results.length;

      for (const product of resp.results) {
        const outcome = await upsertProduct(client, storeId, product);
        if (outcome === "upserted") counters.rows_upserted += 1;
        else if (outcome === "skipped") counters.rows_skipped += 1;
        else counters.rows_failed += 1;
      }
      page += 1;
    }

    const hadFailures = counters.rows_failed > 0;
    const runaway = page > MAX_PAGES && page <= totalPages;
    const status: "ok" | "partial" = hadFailures || runaway ? "partial" : "ok";
    await closeRun(runId, {
      status,
      counters,
      metadata: runaway ? { reason: "page-cap-reached", max_pages: MAX_PAGES } : {},
    });
    await markLastSync(storeId);
    return { ok: true, runId, counters, status };
  } catch (e) {
    const msg = e instanceof KoronaApiError
      ? `korona-${e.status}: ${e.message}`
      : (e as Error)?.message ?? "unknown";
    Sentry.captureException(e, {
      tags: { integration: "korona", phase: "sync" },
      extra: { storeId, counters },
    });
    await closeRun(runId, {
      status: "failed",
      counters,
      error: msg.slice(0, 1000),
    });
    return { ok: false, runId, counters, error: msg };
  }
}

// --------------------------------------------------------------------------
// Upsert one product
// --------------------------------------------------------------------------

type UpsertOutcome = "upserted" | "skipped" | "failed";

async function upsertProduct(
  client: ReturnType<typeof svc>,
  storeId: string,
  product: KoronaProduct,
): Promise<UpsertOutcome> {
  if (!client) return "failed";

  // Without a SKU we cannot preserve identity across syncs — skip rather
  // than invent one. Operators see the count in the admin dashboard and
  // can fix the KORONA record upstream.
  if (!product.number) return "skipped";

  try {
    // Read the existing row so we can preserve fields KORONA doesn't own.
    const { data: existing, error: readError } = await client
      .from("inventory")
      .select("id, metadata")
      .eq("store_id", storeId)
      .eq("sku", product.number)
      .maybeSingle();
    if (readError) return "failed";

    const existingMetadata =
      (existing as { metadata?: Record<string, unknown> } | null)?.metadata ??
      {};

    const mergedMetadata = {
      ...existingMetadata,
      korona: {
        id: product.id,
        barcode: product.barcode,
        last_synced_at: new Date().toISOString(),
        raw: product.raw,
      },
    };

    // Build an update payload that only touches fields KORONA is authoritative
    // for. Never overwrite cost/description/tasting_notes — those are
    // operator/Megan-enriched.
    const payload: Record<string, unknown> = {
      store_id: storeId,
      sku: product.number,
      name: product.name ?? "(unnamed)",
      metadata: mergedMetadata,
      is_active: true,
    };
    if (product.price != null) payload.price = product.price;

    const { error: writeError } = await client
      .from("inventory")
      .upsert(payload, { onConflict: "store_id,sku" });
    if (writeError) return "failed";
    return "upserted";
  } catch {
    return "failed";
  }
}
