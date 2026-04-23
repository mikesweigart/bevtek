// Per-store feature flags.
//
// Reads are cheap (one indexed select by primary key) so we don't cache
// per-request — Next.js route-level caching handles the obvious hot paths.
// If we ever see flag reads dominating a slow endpoint we can layer an
// unstable_cache wrapper here.
//
// Defaults live IN THIS FILE. The DB is additive: a row is only present
// when a store deviates from the default. This means:
//   - New flags ship safely even before the migration is applied.
//   - Rolling back a flag is "delete the row"; we never need a boolean
//     tombstone column.
//
// Writes go through setFeatureFlag() below. That helper is owner-gated and
// drops an `audit_events` row per change. Call sites should already have
// verified the actor is owner/BevTek-admin — the helper does not re-check.

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { logAudit } from "@/lib/audit/log";

// --------------------------------------------------------------------------
// Registry of known flags + defaults
// --------------------------------------------------------------------------
//
// Anything NOT in this registry is still readable/writable — but we prefer
// to list every flag here so future archaeology ("what was enabled for
// store X on date Y?") has a canonical schema to cross-reference.

// Each default uses `as boolean` (etc) to widen away the literal type — we
// want `FlagValue<"x"> === boolean`, not `false`, so downstream comparisons
// to `true` typecheck. The surrounding `as const` still locks in which KEYS
// exist; it just doesn't narrow the VALUE past its primitive.
export const FLAG_DEFAULTS = {
  // Enables the description / tasting-notes / review edit panel inside the
  // Update Inventory session. Starts OFF so we can dark-launch the UI for
  // a pilot store before opening it generally.
  update_inventory_details_edit: false as boolean,

  // Enforces Supabase Auth AAL2 (MFA-verified) sessions for owner/manager
  // routes. Starts OFF so stores can enroll factors before we flip the
  // gate. Individual users can enroll TOTP at /settings/security any time.
  require_mfa_for_managers: false as boolean,

  // When true, the homepage dashboard CTA card for Update Inventory is
  // hidden — use for stores that have a fully-stocked catalog and find
  // the nag distracting.
  hide_update_inventory_cta: false as boolean,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;
export type FlagValue<K extends FlagKey> = (typeof FLAG_DEFAULTS)[K];

// --------------------------------------------------------------------------
// Service client (used for writes + optional fallback reads from RSC)
// --------------------------------------------------------------------------
function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// --------------------------------------------------------------------------
// Read
// --------------------------------------------------------------------------

/**
 * Resolve a single flag value for a store. Returns the hardcoded default
 * when the row is missing OR when the query errors (table not yet
 * migrated, Supabase outage). Never throws.
 */
export async function getFeatureFlag<K extends FlagKey>(
  storeId: string | null | undefined,
  key: K,
): Promise<FlagValue<K>> {
  const fallback = FLAG_DEFAULTS[key];
  if (!storeId) return fallback;

  // Use the user's RLS-scoped client when available — feature_flags has
  // an RLS policy allowing authenticated members to read their store's
  // flags, and we'd rather log "RLS blocked" than silently use
  // service-role for a read.
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("value")
      .eq("store_id", storeId)
      .eq("key", key)
      .maybeSingle();

    if (error) return fallback;
    if (!data) return fallback;

    // The DB column is jsonb; fall back if the stored value doesn't match
    // the expected primitive shape.
    return data.value as FlagValue<K>;
  } catch {
    return fallback;
  }
}

/**
 * Batch-read every listed flag for a store. Missing rows fall back to
 * defaults. Useful for server components that need to branch on multiple
 * flags in a single paint.
 */
export async function getFeatureFlags<K extends FlagKey>(
  storeId: string | null | undefined,
  keys: readonly K[],
): Promise<{ [P in K]: FlagValue<P> }> {
  const result = {} as { [P in K]: FlagValue<P> };
  for (const k of keys) result[k] = FLAG_DEFAULTS[k];
  if (!storeId) return result;

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, value")
      .eq("store_id", storeId)
      .in("key", keys as unknown as string[]);

    if (error || !data) return result;
    for (const row of data as Array<{ key: string; value: unknown }>) {
      if ((keys as readonly string[]).includes(row.key)) {
        result[row.key as K] = row.value as FlagValue<K>;
      }
    }
    return result;
  } catch {
    return result;
  }
}

// --------------------------------------------------------------------------
// Write (owner-gated at the call site; helper does not re-check role)
// --------------------------------------------------------------------------

export type SetFeatureFlagInput<K extends FlagKey> = {
  storeId: string;
  key: K;
  value: FlagValue<K>;
  actor: { id?: string | null; email?: string | null };
};

export type SetFeatureFlagResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setFeatureFlag<K extends FlagKey>(
  input: SetFeatureFlagInput<K>,
): Promise<SetFeatureFlagResult> {
  const client = svc();
  if (!client) return { ok: false, error: "Service client unavailable." };

  // Pull the prior value so the audit row captures before/after. Null if
  // the row didn't exist — we still audit that as the implicit default.
  const { data: prior } = await client
    .from("feature_flags")
    .select("value")
    .eq("store_id", input.storeId)
    .eq("key", input.key)
    .maybeSingle();

  const { error } = await client
    .from("feature_flags")
    .upsert(
      {
        store_id: input.storeId,
        key: input.key,
        value: input.value as unknown as Record<string, unknown>,
      },
      { onConflict: "store_id,key" },
    );

  if (error) return { ok: false, error: error.message };

  await logAudit({
    action: "feature_flag.set",
    actor: input.actor,
    storeId: input.storeId,
    target: { type: "feature_flag", id: input.key },
    metadata: {
      flag: input.key,
      before: prior?.value ?? null,
      after: input.value,
    },
  });

  return { ok: true };
}
