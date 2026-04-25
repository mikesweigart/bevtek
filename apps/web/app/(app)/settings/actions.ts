"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { hoursFromFormData } from "@/lib/store/hours";

export type SettingsState = { error: string | null; saved: boolean };

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const COUNTRY_CODES = new Set(["US", "CA"]);

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeImageUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  return null;
}

export async function updateStoreSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const logoUrl = normalizeImageUrl(String(formData.get("logo_url") ?? ""));

  const addressLine1 = String(formData.get("address_line_1") ?? "").trim();
  const addressLine2 = String(formData.get("address_line_2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim().toUpperCase();
  const postalCode = String(formData.get("postal_code") ?? "").trim();
  const countryCodeRaw = String(formData.get("country_code") ?? "US").trim();
  const countryCode = COUNTRY_CODES.has(countryCodeRaw) ? countryCodeRaw : "US";

  const hoursJson = hoursFromFormData(formData);

  if (!name) return { error: "Store name is required.", saved: false };
  if (!TIMEZONES.includes(timezone)) {
    return { error: "Invalid timezone.", saved: false };
  }
  // Light region validation: 2-3 letters is what every US state / CA province
  // uses. We tolerate blank (nothing required) but reject garbage like "Ga!".
  if (region && !/^[A-Z]{2,3}$/.test(region)) {
    return {
      error: "State/region should be a 2–3 letter code (e.g. GA, CA).",
      saved: false,
    };
  }

  const slug = slugRaw ? slugify(slugRaw) : null;
  if (slugRaw && slug !== slugRaw) {
    return {
      error: `Slug must be lowercase letters/numbers/hyphens only. Try "${slug}".`,
      saved: false,
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", saved: false };

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) return { error: "No store.", saved: false };
  if (p.role !== "owner") {
    return { error: "Only the owner can change store settings.", saved: false };
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      slug: slug || undefined, // null would trigger slug regen via trigger
      phone: phone || null,
      timezone,
      logo_url: logoUrl,
      address_line_1: addressLine1 || null,
      address_line_2: addressLine2 || null,
      city: city || null,
      region: region || null,
      postal_code: postalCode || null,
      country_code: countryCode,
      hours_json: hoursJson,
    })
    .eq("id", p.store_id);

  if (error) return { error: error.message, saved: false };

  await logAudit({
    action: "store.settings.update",
    actor: { id: auth.user.id, email: auth.user.email ?? null },
    storeId: p.store_id,
    target: { type: "store", id: p.store_id },
    metadata: {
      fields: {
        name: true,
        slug: !!slug,
        phone: true,
        timezone: true,
        logo_url: true,
        address: true,
        hours: true,
      },
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: null, saved: true };
}

export async function updateProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", saved: false };

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName || null })
    .eq("id", auth.user.id);

  if (error) return { error: error.message, saved: false };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: null, saved: true };
}

export async function deleteStoreAction() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id || p.role !== "owner") return;

  await supabase.from("stores").delete().eq("id", p.store_id);
  await logAudit({
    action: "store.delete",
    actor: { id: auth.user.id, email: auth.user.email ?? null },
    storeId: p.store_id,
    target: { type: "store", id: p.store_id },
  });
  await supabase.auth.signOut();
  redirect("/");
}
