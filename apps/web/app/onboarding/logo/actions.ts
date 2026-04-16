"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function saveLogoAction(formData: FormData): Promise<void> {
  const url = String(formData.get("logo_url") ?? "").trim();
  const next = String(formData.get("next") ?? "/onboarding/inventory");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;
  if (!storeId) redirect("/onboarding/store");

  if (url && /^https?:\/\//.test(url)) {
    await supabase
      .from("stores")
      .update({ logo_url: url })
      .eq("id", storeId);
    revalidatePath("/dashboard");
  }

  redirect(next);
}
