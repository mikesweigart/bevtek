"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type LoginState = { error: string | null };

export async function loginAffiliateAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  // Route based on what they are.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Signed in but no session." };

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (affiliate) redirect("/affiliates/dashboard");
  // Not an affiliate — suggest signing up.
  redirect("/affiliates/signup?missing=1");
}
