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

  if (!storeName) return { error: "Store name is required." };

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

  redirect("/onboarding/logo");
}
