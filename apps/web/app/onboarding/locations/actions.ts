"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { logAudit } from "@/lib/audit/log";

export type AddLocationState = {
  error: string | null;
  createdName: string | null;
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

/**
 * Add an additional store to the user's current organization. Used from
 * /onboarding/locations (initial setup) and in theory could be reused by a
 * future Settings → Locations page for adding stores post-onboarding.
 *
 * We look up the user's organization_id via their existing store
 * (store → org) rather than reading organization_members directly. Same
 * source of truth the rest of Phase 1 uses, and it avoids the case where
 * a user has memberships in multiple orgs and we'd have to pick one.
 */
export async function addLocationAction(
  _prev: AddLocationState,
  formData: FormData,
): Promise<AddLocationState> {
  const storeName = String(formData.get("store_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const tz = String(formData.get("timezone") ?? "America/New_York").trim();
  const addressLine1 = String(formData.get("address_line_1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim().toUpperCase();
  const postalCode = String(formData.get("postal_code") ?? "").trim();

  if (!storeName) return { error: "Store name is required.", createdName: null };
  if (!TIMEZONES.includes(tz)) {
    return { error: "Invalid timezone.", createdName: null };
  }
  if (region && !/^[A-Z]{2,3}$/.test(region)) {
    return {
      error: "State should be a 2–3 letter code (e.g. GA, CA).",
      createdName: null,
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;
  if (!storeId) {
    return { error: "Set up your first store first.", createdName: null };
  }

  const { data: currentStore } = await supabase
    .from("stores")
    .select("organization_id")
    .eq("id", storeId)
    .maybeSingle();
  const orgId = (currentStore as { organization_id?: string } | null)
    ?.organization_id;
  if (!orgId) {
    return {
      error: "Your store isn't linked to an organization yet.",
      createdName: null,
    };
  }

  const { data: newId, error } = await supabase.rpc("add_store_to_org", {
    p_organization_id: orgId,
    p_store_name: storeName,
    p_phone: phone || null,
    p_timezone: tz,
    p_address_line_1: addressLine1 || null,
    p_city: city || null,
    p_region: region || null,
    p_postal_code: postalCode || null,
  });

  if (error) return { error: error.message, createdName: null };

  await logAudit({
    action: "store.add_location",
    actor: { id: auth.user.id, email: auth.user.email ?? null },
    storeId: (newId as string | null) ?? null,
    target: { type: "store", id: (newId as string | null) ?? storeName },
    metadata: { name: storeName, org_id: orgId },
  });

  revalidatePath("/onboarding/locations");
  return { error: null, createdName: storeName };
}
