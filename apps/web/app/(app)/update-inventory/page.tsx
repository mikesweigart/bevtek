/**
 * Update Inventory — the per-product session launcher.
 *
 * Server component: fetches the queue of products this store carries that
 * need a catalog photo, then renders the mobile-first session component.
 *
 * Scope note: this surface was originally shipped as "Photo Mode" — a
 * phone-first flow for staff to photograph products one at a time. It was
 * renamed to "Update Inventory" in 2026-04-23 so the same queue UX can be
 * extended to edit descriptions, tasting notes, and customer-visible reviews
 * in the same single-product-at-a-time flow.
 *
 * Task E (2026-04-23): the first non-photo edit surface — description +
 * tasting notes — ships here, gated by `update_inventory_details_edit` so
 * we can dark-launch per store. Reviews are still a follow-up pass once we
 * decide on the per-product vs per-SKU data model.
 *
 * Queue source: catalog_products_needing_photos view (defined in
 * supabase/migrations/20260423140000_photo_mode.sql — migration filename
 * retained for history; the surface above it is "Update Inventory").
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { UpdateInventorySession, type QueueItem } from "./UpdateInventorySession";
import { getFeatureFlag } from "@/lib/flags";

// The view can return lots of products; cap the session so it stays a
// bounded commitment. Users can restart for another batch.
const SESSION_SIZE = 50;

export default async function UpdateInventoryPage() {
  const supabase = await createClient();

  // Auth + profile
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role, photo_upload_privilege")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.store_id || !profile.role) redirect("/login");

  const role = profile.role as "owner" | "manager" | "staff";
  const isManager = role === "owner" || role === "manager";
  // `photo_upload_privilege` is the legacy column name — it gates any
  // write from this surface, not just photos. We'll keep the column as-is
  // (rename would be a migration with no practical benefit) and just treat
  // it as the generic "can this user update inventory?" flag.
  const canUpload = isManager || profile.photo_upload_privilege === true;

  if (!canUpload) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-2xl mb-2">🚫</p>
        <h1 className="text-xl font-semibold">Update Inventory unavailable</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          Your manager has turned off inventory updates for your account. Ask
          them to re-enable it from the gallery.
        </p>
      </div>
    );
  }

  // Feature flag — gates the details-edit panel. Fetch in parallel with the
  // queue so the page paints as fast as before when the flag is off.
  const [queueRes, detailsEditFlag] = await Promise.all([
    supabase
      .from("catalog_products_needing_photos")
      .select(
        "catalog_product_id, canonical_name, brand, category, subcategory, size_ml, existing_image_url, existing_image_source, inventory_id",
      )
      .limit(SESSION_SIZE),
    getFeatureFlag(profile.store_id, "update_inventory_details_edit"),
  ]);

  if (queueRes.error) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t load session</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          {queueRes.error.message}
        </p>
      </div>
    );
  }

  const viewRows = queueRes.data ?? [];

  // Only pay the cost of the override/fallback lookups when the details
  // editor will actually render. Keeps the hot path (flag off, which is the
  // default) unchanged.
  const canEditDetails = isManager && detailsEditFlag === true;

  // Pull per-store overrides (inventory) and per-product catalog fallbacks
  // (catalog_products.tasting_notes only — catalog_products has no
  // `description` column, so the inventory row is the sole source of truth
  // for description).
  const inventoryIds = viewRows
    .map((r) => r.inventory_id as string | null)
    .filter((x): x is string => !!x);
  const catalogIds = viewRows
    .map((r) => r.catalog_product_id as string | null)
    .filter((x): x is string => !!x);

  const [invRowsRes, catRowsRes] = canEditDetails
    ? await Promise.all([
        inventoryIds.length > 0
          ? supabase
              .from("inventory")
              .select("id, description, tasting_notes")
              .in("id", inventoryIds)
          : Promise.resolve({ data: [] as Array<{ id: string; description: string | null; tasting_notes: string | null }>, error: null }),
        catalogIds.length > 0
          ? supabase
              .from("catalog_products")
              .select("id, tasting_notes")
              .in("id", catalogIds)
          : Promise.resolve({ data: [] as Array<{ id: string; tasting_notes: string | null }>, error: null }),
      ])
    : [
        { data: [] as Array<{ id: string; description: string | null; tasting_notes: string | null }>, error: null },
        { data: [] as Array<{ id: string; tasting_notes: string | null }>, error: null },
      ];

  const invById = new Map<string, { description: string | null; tasting_notes: string | null }>();
  for (const r of (invRowsRes.data ?? []) as Array<{ id: string; description: string | null; tasting_notes: string | null }>) {
    invById.set(r.id, { description: r.description, tasting_notes: r.tasting_notes });
  }
  const catById = new Map<string, string | null>();
  for (const r of (catRowsRes.data ?? []) as Array<{ id: string; tasting_notes: string | null }>) {
    catById.set(r.id, r.tasting_notes);
  }

  const queue: QueueItem[] = viewRows.map((r) => {
    const inv = invById.get(r.inventory_id as string);
    return {
      catalog_product_id: r.catalog_product_id as string,
      canonical_name: r.canonical_name as string,
      brand: r.brand as string | null,
      category: r.category as string,
      subcategory: r.subcategory as string | null,
      size_ml: r.size_ml as number | null,
      existing_image_url: r.existing_image_url as string | null,
      existing_image_source: r.existing_image_source as string | null,
      inventory_id: r.inventory_id as string,
      inventory_description: inv?.description ?? null,
      inventory_tasting_notes: inv?.tasting_notes ?? null,
      catalog_tasting_notes: catById.get(r.catalog_product_id as string) ?? null,
    };
  });

  return (
    <div className="py-6">
      <header className="max-w-md mx-auto px-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Update Inventory</h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              Walk your catalog one product at a time — snap a photo today,
              add descriptions, tasting notes, and reviews as they roll out.
            </p>
          </div>
          {isManager && (
            <Link
              href="/update-inventory/gallery"
              className="text-sm text-[color:var(--color-gold)] hover:underline shrink-0"
            >
              Gallery →
            </Link>
          )}
        </div>
      </header>

      <UpdateInventorySession
        storeId={profile.store_id}
        queue={queue}
        canEditDetails={canEditDetails}
      />
    </div>
  );
}
