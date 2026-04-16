"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { sendInviteEmail } from "@/lib/email/sendInvite";

export type InviteState = {
  error: string | null;
  link: string | null;
  emailSent: boolean;
};

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  const origin = String(formData.get("origin") ?? "");

  if (!email) return { error: "Email is required.", link: null, emailSent: false };
  if (!["owner", "manager", "staff"].includes(role)) {
    return { error: "Invalid role.", link: null, emailSent: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_email: email,
    p_role: role,
  });

  if (error) return { error: error.message, link: null, emailSent: false };

  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token as string | undefined;
  if (!token) return { error: "No token returned.", link: null, emailSent: false };

  const inviteUrl = `${origin}/invite/${token}`;

  // Look up inviter and store info for the email body.
  const { data: auth } = await supabase.auth.getUser();
  let inviterName: string | null = null;
  let storeName = "your store";
  if (auth.user) {
    const { data: me } = await supabase
      .from("users")
      .select("full_name, email, store_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    const u = me as { full_name?: string; email?: string; store_id?: string } | null;
    inviterName = u?.full_name ?? u?.email ?? null;
    if (u?.store_id) {
      const { data: store } = await supabase
        .from("stores")
        .select("name")
        .eq("id", u.store_id)
        .maybeSingle();
      storeName = (store as { name?: string } | null)?.name ?? storeName;
    }
  }

  // Send the email. Best-effort: failure here doesn't fail the invite.
  const sendResult = await sendInviteEmail({
    to: email,
    inviteUrl,
    storeName,
    inviterName,
    role: role as "owner" | "manager" | "staff",
  });

  if (!sendResult.ok) {
    console.error("invite email failed:", sendResult.error);
  }

  revalidatePath("/team");
  return {
    error: null,
    link: inviteUrl,
    emailSent: sendResult.ok,
  };
}

export async function revokeInviteAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("id", id);
  revalidatePath("/team");
}
