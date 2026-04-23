// Korona Cloud API v3 client.
//
// KORONA is pull-only — no webhooks. The store operator sets up HTTP Basic
// credentials inside KORONA Studio (Settings → Data Exchange → APIv3), pastes
// them into our admin UI, and we store them in `store_integrations` (jsonb
// config, owner-only read). A nightly cron pulls `/products` and upserts
// into `inventory`.
//
// Base URL shape, confirmed against OpenAPI spec at
//   https://185.koronacloud.com/web/api/v3/openapi.json
// (title: KORONA Studio API v3, version 3.9.30):
//   https://<pod>.koronacloud.com/web/api/v3/accounts/{accountId}/products
// where <pod> is a numeric subdomain tied to the operator's region (e.g.
// "185"). We default to 185 but let config override `base_url` for other
// pods without a code change.
//
// Auth: HTTP Basic — `Authorization: Basic base64(username:password)`. The
// `accountId` is in the URL path, NOT the auth header — it's a path segment
// that identifies which KORONA account to operate on.
//
// Response envelope (standard Spring-style ResultList):
//   { results: Product[], total: number, pages: number, page: number, size: number }
//
// We DO NOT trust the response schema at compile time — the spec is large
// and could drift across KORONA versions. Every field we read is narrowed
// through a type guard before use. Unknown fields fall through to
// inventory.metadata.korona so we don't lose data we might need later.

import { createClient as createServiceClient } from "@supabase/supabase-js";

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

export type KoronaConfig = {
  /** The Account-ID UUID from Studio → Settings → Data Exchange → APIv3. */
  account: string;
  /** API username (created in Studio, distinct from operator login). */
  username: string;
  /** API password (likewise). */
  password: string;
  /** Optional override, e.g. `https://212.koronacloud.com/web/api/v3`. */
  base_url?: string | null;
};

const DEFAULT_BASE_URL = "https://185.koronacloud.com/web/api/v3";

/**
 * Read per-store KORONA config from `store_integrations`. Returns null when
 * the table is missing (dev branch without the migration applied), the row
 * is missing, or the config is shaped unexpectedly. This keeps the sync job
 * a safe no-op until an operator has actually finished setup.
 */
export async function getKoronaConfig(
  storeId: string,
): Promise<KoronaConfig | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await client
      .from("store_integrations")
      .select("config, enabled")
      .eq("store_id", storeId)
      .eq("provider", "korona")
      .maybeSingle();
    if (error || !data) return null;
    if ((data as { enabled?: boolean }).enabled === false) return null;
    const cfg = (data as { config?: unknown }).config;
    if (!cfg || typeof cfg !== "object") return null;
    const c = cfg as Record<string, unknown>;
    if (
      typeof c.account !== "string" ||
      typeof c.username !== "string" ||
      typeof c.password !== "string"
    ) {
      return null;
    }
    return {
      account: c.account,
      username: c.username,
      password: c.password,
      base_url: typeof c.base_url === "string" ? c.base_url : null,
    };
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Client
// --------------------------------------------------------------------------

/**
 * Fields we care about from a KORONA Product. Everything else lands in
 * `metadata.korona` so we don't silently drop data we might map later
 * (e.g. vendor, commodity group, container deposit).
 */
export type KoronaProduct = {
  /** KORONA's internal UUID — we stash this in inventory.metadata.korona.id. */
  id: string | null;
  /** Product number — our SKU. Required for upsert; we skip products without one. */
  number: string | null;
  /** Display name. */
  name: string | null;
  /** First barcode from `codes[]`, if present. */
  barcode: string | null;
  /** All barcodes from `codes[]` (one product can have several — short + long UPC). */
  allCodes: string[];
  /** Default/retail price in the store's base currency, if present. */
  price: number | null;
  /** `active` flag — usually true; false when soft-deleted. */
  active: boolean | null;
  /** `deactivated` flag — true when the operator has disabled the product. */
  deactivated: boolean | null;
  /** Raw product payload, for metadata stash. */
  raw: Record<string, unknown>;
};

export type KoronaListResponse = {
  results: KoronaProduct[];
  total: number;
  pages: number;
  page: number;
};

export type KoronaClient = {
  /**
   * Fetch one page of products. Page numbers are 1-based in the v3 spec.
   * `revision` enables incremental pulls once we have a last-seen revision
   * stored per store — omitted today, full scan each night.
   */
  listProducts(opts: {
    page: number;
    size?: number;
    revision?: string | number;
  }): Promise<KoronaListResponse>;
};

export class KoronaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `KORONA API ${status}: ${body.slice(0, 200)}`);
    this.name = "KoronaApiError";
  }
}

export function createKoronaClient(config: KoronaConfig): KoronaClient {
  const baseUrl = (config.base_url ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  // Precompute the Authorization header once. Node 20+ has global `btoa`
  // but Buffer is guaranteed in the edge-less runtimes we target; we use
  // Buffer so this compiles on both node & edge without a polyfill.
  const basic = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64",
  );
  const authHeader = `Basic ${basic}`;

  async function listProducts(opts: {
    page: number;
    size?: number;
    revision?: string | number;
  }): Promise<KoronaListResponse> {
    const size = opts.size ?? 100;
    const params = new URLSearchParams();
    params.set("page", String(opts.page));
    params.set("size", String(size));
    if (opts.revision !== undefined) {
      params.set("revision", String(opts.revision));
    }
    const url = `${baseUrl}/accounts/${encodeURIComponent(config.account)}/products?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      // Don't let Next.js cache anything here — cron pulls change every run.
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new KoronaApiError(res.status, text);
    }
    const json = (await res.json()) as unknown;
    return normalizeListResponse(json);
  }

  return { listProducts };
}

// --------------------------------------------------------------------------
// Defensive parsing — the OpenAPI schema is ~3MB; we trust nothing.
// --------------------------------------------------------------------------

function normalizeListResponse(json: unknown): KoronaListResponse {
  if (!json || typeof json !== "object") {
    return { results: [], total: 0, pages: 0, page: 1 };
  }
  const o = json as Record<string, unknown>;
  const rawResults = Array.isArray(o.results) ? o.results : [];
  const results: KoronaProduct[] = [];
  for (const r of rawResults) {
    if (r && typeof r === "object") {
      results.push(normalizeProduct(r as Record<string, unknown>));
    }
  }
  // KORONA envelope uses `currentPage`, `pagesTotal`, `resultsTotal` — NOT
  // the Spring-standard `page`, `pages`, `total`. Empirically verified via
  // curl against /accounts/{id}/products. Don't change without re-checking.
  return {
    results,
    total: numberOrDefault(o.resultsTotal, results.length),
    pages: numberOrDefault(o.pagesTotal, 1),
    page: numberOrDefault(o.currentPage, 1),
  };
}

function normalizeProduct(raw: Record<string, unknown>): KoronaProduct {
  const allCodes = collectCodes(raw.codes);
  return {
    id: stringOrNull(raw.id),
    number: stringOrNull(raw.number),
    name: stringOrNull(raw.name),
    barcode: allCodes[0] ?? null,
    allCodes,
    price: firstPrice(raw.prices),
    active: boolOrNull(raw.active),
    deactivated: boolOrNull(raw.deactivated),
    raw,
  };
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function numberOrDefault(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function collectCodes(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  const out: string[] = [];
  for (const entry of codes) {
    if (typeof entry === "string" && entry.length > 0) {
      out.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      if (typeof e.productCode === "string" && e.productCode.length > 0) {
        out.push(e.productCode);
      } else if (typeof e.code === "string" && e.code.length > 0) {
        out.push(e.code);
      }
    }
  }
  return out;
}

function firstPrice(prices: unknown): number | null {
  if (!Array.isArray(prices)) return null;
  for (const entry of prices) {
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      if (typeof e.value === "number" && Number.isFinite(e.value)) {
        return e.value;
      }
      if (typeof e.price === "number" && Number.isFinite(e.price)) {
        return e.price;
      }
    }
  }
  return null;
}
