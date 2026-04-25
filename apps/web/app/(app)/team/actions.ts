"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { sendInviteEmail } from "@/lib/email/sendInvite";
import { logAudit } from "@/lib/audit/log";

export type InviteState = {
  error: string | null;
  link: string | null;
  emailSent: boolean;
  emailError: string | null;
};

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  const origin = String(formData.get("origin") ?? "");

  if (!email) return { error: "Email is required.", link: null, emailSent: false, emailError: null };
  if (!["owner", "manager", "staff"].includes(role)) {
    return { error: "Invalid role.", link: null, emailSent: false, emailError: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_email: email,
    p_role: role,
  });

  if (error) return { error: error.message, link: null, emailSent: false, emailError: null };

  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token as string | undefined;
  if (!token) return { error: "No token returned.", link: null, emailSent: false, emailError: null };

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

  await logAudit({
    action: "team.invite.create",
    actor: auth.user
      ? { id: auth.user.id, email: auth.user.email ?? null }
      : null,
    storeId: (row?.store_id as string | undefined) ?? null,
    target: { type: "invite", id: (row?.id as string | undefined) ?? email },
    metadata: { invited_email: email, role, email_sent: sendResult.ok },
  });

  revalidatePath("/team");
  return {
    error: null,
    link: inviteUrl,
    emailSent: sendResult.ok,
    emailError: sendResult.ok ? null : ("error" in sendResult ? sendResult.error : "Unknown email error"),
  };
}

export async function revokeInviteAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("invites").delete().eq("id", id);
  await logAudit({
    action: "team.invite.revoke",
    actor: auth.user
      ? { id: auth.user.id, email: auth.user.email ?? null }
      : null,
    target: { type: "invite", id },
  });
  revalidatePath("/team");
}

export type RemoveMemberState = { error: string | null; removed: boolean };

/**
 * Remove a team member. Calls the SECURITY DEFINER RPC
 * public.remove_team_member which enforces:
 *   - actor must be authenticated
 *   - actor can't remove themselves
 *   - actor must be owner/manager of the target's store
 *   - can't remove the last owner of a store
 *
 * The RPC also writes to user_removal_log for audit. We additionally log
 * via logAudit so the generic audit stream picks it up alongside other
 * team actions (invite/revoke). Belt-and-suspenders is fine here — the
 * two logs serve different readers (user_removal_log for compliance,
 * audit_log for debugging).
 */
export async function removeMemberAction(
  _prev: RemoveMemberState,
  formData: FormData,
): Promise<RemoveMemberState> {
  const targetUserId = String(formData.get("user_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!targetUserId) {
    return { error: "Missing user id.", removed: false };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", removed: false };

  const { error } = await supabase.rpc("remove_team_member", {
    p_target_user_id: targetUserId,
    p_reason: reason,
  });

  if (error) {
    // The RPC raises with human-readable messages (cannot remove yourself,
    // not authorized, cannot remove the last owner). Pass them straight
    // through to the UI rather than replacing with a generic "failed."
    return { error: error.message, removed: false };
  }

  await logAudit({
    action: "team.member.remove",
    actor: { id: auth.user.id, email: auth.user.email ?? null },
    target: { type: "user", id: targetUserId },
    metadata: { reason },
  });

  revalidatePath("/team");
  return { error: null, removed: true };
}
