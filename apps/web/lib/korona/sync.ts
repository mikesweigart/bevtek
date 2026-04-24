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

      const outcome = await upsertBatch(client, storeId, resp.results);
      counters.rows_upserted += outcome.upserted;
      counters.rows_skipped += outcome.skipped;
      counters.rows_failed += outcome.failed;
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
// Batched per-page upsert
// --------------------------------------------------------------------------
//
// Per-product read+write (the obvious v1) is 2 DB roundtrips × 22k products
// = ~45k roundtrips per sync → 30+ min, blows through the 300s cron ceiling.
//
// Batched version: 1 SELECT for the whole page's existing metadata, then a
// single UPSERT for the whole page. 2 roundtrips per 100 products → ~450
// roundtrips for the big catalog → well under 60s end-to-end.
//
// We DON'T store `product.raw` in the DB. At 22k rows × ~2KB raw = ~45MB of
// jsonb that grows every sync — not worth the cost when a fresh pull can
// regenerate it. We keep the mapped fields (id, barcode, allCodes,
// last_synced_at) which are enough for reconciliation and barcode lookup.

type BatchOutcome = { upserted: number; skipped: number; failed: number };

async function upsertBatch(
  client: ReturnType<typeof svc>,
  storeId: string,
  products: KoronaProduct[],
): Promise<BatchOutcome> {
  if (!client) {
    return { upserted: 0, skipped: 0, failed: products.length };
  }

  // Products without a SKU can't upsert (we key by store_id+sku). Count
  // them as skipped up-front and exclude from the batch.
  const valid: KoronaProduct[] = [];
  let skipped = 0;
  for (const p of products) {
    if (p.number) valid.push(p);
    else skipped += 1;
  }
  if (valid.length === 0) return { upserted: 0, skipped, failed: 0 };

  // Read existing metadata for every SKU in this page. Supabase `.in()` has
  // a practical limit around 1000 values — PAGE_SIZE=100 is safely under.
  const skus = valid.map((p) => p.number as string);
  let existingMeta = new Map<string, Record<string, unknown>>();
  try {
    const { data, error } = await client
      .from("inventory")
      .select("sku, metadata")
      .eq("store_id", storeId)
      .in("sku", skus);
    if (error) {
      return { upserted: 0, skipped, failed: valid.length };
    }
    existingMeta = new Map(
      (data as Array<{ sku: string; metadata: Record<string, unknown> | null }>).map(
        (row) => [row.sku, row.metadata ?? {}],
      ),
    );
  } catch {
    return { upserted: 0, skipped, failed: valid.length };
  }

  const now = new Date().toISOString();
  const payloads = valid.map((p) => {
    const prior = existingMeta.get(p.number as string) ?? {};
    // Active in our system iff Korona reports active AND not deactivated.
    // Missing fields treated as null → default to active (new rows come in
    // enabled; explicit disable requires Korona to say so).
    const isActive =
      (p.active === null ? true : p.active) &&
      (p.deactivated === null ? true : !p.deactivated);
    const payload: Record<string, unknown> = {
      store_id: storeId,
      sku: p.number,
      name: p.name ?? "(unnamed)",
      is_active: isActive,
      metadata: {
        ...prior,
        korona: {
          id: p.id,
          barcode: p.barcode,
          all_codes: p.allCodes,
          last_synced_at: now,
        },
      },
    };
    // Only overwrite price when Korona provides one — preserve
    // operator-entered prices for rows Korona didn't price.
    if (p.price != null) payload.price = p.price;
    // Populate inventory.upc when Korona gives us a barcode that looks
    // like a real UPC/EAN (8–14 digit numeric). This is what the catalog
    // builder reads to key catalog_products by UPC, and what the UPC-API
    // image enrichers (OpenFoodFacts) use for lookups. We restrict to
    // digit-only 8–14 chars because Korona's barcode field sometimes holds
    // internal PLU codes or receipt references that would pollute
    // cross-store joins and fail upstream UPC validators.
    if (p.barcode && /^\d{8,14}$/.test(p.barcode)) {
      payload.upc = p.barcode;
    }
    return payload;
  });

  try {
    const { error } = await client
      .from("inventory")
      .upsert(payloads, { onConflict: "store_id,sku" });
    if (error) {
      return { upserted: 0, skipped, failed: valid.length };
    }
    return { upserted: valid.length, skipped, failed: 0 };
  } catch {
    return { upserted: 0, skipped, failed: valid.length };
  }
}
