"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type SignupState = { error: string | null; sent: boolean };

export async function signupAffiliateAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const payoutEmail = String(formData.get("payout_email") ?? "").trim() || email;

  if (!email || !password) {
    return { error: "Email and password are required.", sent: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", sent: false };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;

  const { error: signupErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/affiliates/dashboard`,
      data: { intent: "affiliate" },
    },
  });

  if (signupErr) return { error: signupErr.message, sent: false };

  // If email confirmation is required, session won't exist yet.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: null, sent: true };

  // Create the affiliate record via the bootstrap RPC.
  const { error: rpcErr } = await supabase.rpc(
    "create_affiliate_for_current_user",
    { p_full_name: fullName || null, p_payout_email: payoutEmail || null },
  );
  if (rpcErr) return { error: rpcErr.message, sent: false };

  redirect("/affiliates/dashboard");
}
