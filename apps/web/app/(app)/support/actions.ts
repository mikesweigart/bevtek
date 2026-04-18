"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

type Status = "open" | "in_progress" | "resolved" | "wont_fix" | "duplicate";

const ALLOWED: Status[] = [
  "open",
  "in_progress",
  "resolved",
  "wont_fix",
  "duplicate",
];

/**
 * Manager/admin status update on a support ticket. RLS
 * (support_tickets_update_store_staff) handles the authz — this action
 * just shapes the UPDATE and sets resolved_at when appropriate so the
 * closed list shows a real timestamp.
 */
export async function updateTicketStatus(
  ticketId: string,
  next: Status,
): Promise<{ error?: string }> {
  if (!ALLOWED.includes(next)) return { error: "invalid status" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "unauthenticated" };

  const patch: Record<string, unknown> = { status: next };
  if (next === "resolved" || next === "wont_fix" || next === "duplicate") {
    patch.resolved_at = new Date().toISOString();
    patch.assignee_email = auth.user.email ?? null;
  } else {
    patch.resolved_at = null;
  }

  const { error } = await supabase
    .from("support_tickets")
    .update(patch)
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath("/support");
  return {};
}
