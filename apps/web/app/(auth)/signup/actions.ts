"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type SignupState = { error: string | null; sent: boolean };

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required.", sent: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", sent: false };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return { error: error.message, sent: false };
  }

  // If the project has email confirmations enabled, user needs to confirm.
  // If disabled, a session will already exist — just send them onward.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect("/onboarding/store");
  }

  return { error: null, sent: true };
}
