"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type InviteAcceptState = { error: string | null; sent: boolean };

export async function acceptInviteAction(
  _prev: InviteAcceptState,
  formData: FormData,
): Promise<InviteAcceptState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!token) return { error: "Missing invite token.", sent: false };
  if (!email || !password) {
    return { error: "Email and password are required.", sent: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", sent: false };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;

  // Sign up or sign in. If an account already exists for this email with
  // the same password, we'll sign them in instead.
  let { data: signed, error: signupErr } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/invite/${token}` },
  });

  if (signupErr && /already/i.test(signupErr.message)) {
    const si = await supabase.auth.signInWithPassword({ email, password });
    signed = si.data;
    signupErr = si.error ?? null;
  }

  if (signupErr) return { error: signupErr.message, sent: false };

  // If email confirmation is required, session won't exist yet.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: null, sent: true };

  // Save full_name on the user (done via users_update_self policy AFTER accept_invite).
  const { error: rpcErr } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (rpcErr) return { error: rpcErr.message, sent: false };

  if (fullName) {
    await supabase.from("users").update({ full_name: fullName }).eq("id", userData.user.id);
  }

  redirect("/dashboard");
}
