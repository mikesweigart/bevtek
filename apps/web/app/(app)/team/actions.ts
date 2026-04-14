"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type InviteState = {
  error: string | null;
  link: string | null;
};

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  const origin = String(formData.get("origin") ?? "");

  if (!email) return { error: "Email is required.", link: null };
  if (!["owner", "manager", "staff"].includes(role)) {
    return { error: "Invalid role.", link: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_email: email,
    p_role: role,
  });

  if (error) return { error: error.message, link: null };

  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token as string | undefined;
  if (!token) return { error: "No token returned.", link: null };

  revalidatePath("/team");
  return {
    error: null,
    link: `${origin}/invite/${token}`,
  };
}

export async function revokeInviteAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("id", id);
  revalidatePath("/team");
}
