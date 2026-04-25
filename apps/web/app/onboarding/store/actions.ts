"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/sendWelcome";

export type OnboardingState = { error: string | null };

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

type Timezone = (typeof TIMEZONES)[number];

function isTimezone(v: unknown): v is Timezone {
  return typeof v === "string" && (TIMEZONES as readonly string[]).includes(v);
}

export async function createStoreAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const storeName = String(formData.get("store_name") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const tz = formData.get("timezone");

  // Address is optional at onboarding — we collect it here so we have it
  // when Stripe tax / the Shopper landing page need it, but the owner can
  // skip all five fields and finish later in Settings.
  const addressLine1 = String(formData.get("address_line_1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim().toUpperCase();
  const postalCode = String(formData.get("postal_code") ?? "").trim();

  if (!storeName) return { error: "Store name is required." };
  if (region && !/^[A-Z]{2,3}$/.test(region)) {
    return { error: "State should be a 2–3 letter code (e.g. GA, CA)." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error } = await supabase.rpc("create_store_for_current_user", {
    p_store_name: storeName,
    p_full_name: fullName || null,
    p_phone: phone || null,
    p_timezone: isTimezone(tz) ? tz : "America/New_York",
  });

  if (error) return { error: error.message };

  // After the bootstrap RPC we're now the owner of a freshly-created store,
  // so RLS lets us UPDATE it. Only write when at least one address field was
  // provided — no point sending an all-null patch. We intentionally don't
  // fail onboarding if this update errors; address can be filled in later.
  if (addressLine1 || city || region || postalCode) {
    const { data: me } = await supabase
      .from("users")
      .select("store_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    const storeId = (me as { store_id?: string } | null)?.store_id;
    if (storeId) {
      await supabase
        .from("stores")
        .update({
          address_line_1: addressLine1 || null,
          city: city || null,
          region: region || null,
          postal_code: postalCode || null,
        })
        .eq("id", storeId);
    }
  }

  // Best-effort welcome email (don't block onboarding if it fails).
  try {
    const hdrs = await headers();
    const origin =
      hdrs.get("origin") ?? `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;
    const { data: storeRow } = await supabase
      .from("stores")
      .select("slug")
      .eq("name", storeName)
      .maybeSingle();
    const slug = (storeRow as { slug?: string } | null)?.slug;
    await sendWelcomeEmail({
      to: auth.user.email!,
      storeName,
      ownerName: fullName || null,
      dashboardUrl: `${origin}/dashboard`,
      shopperUrl: slug ? `${origin}/s/${slug}` : null,
    });
  } catch {
    // swallow
  }

  redirect("/onboarding/locations");
}
