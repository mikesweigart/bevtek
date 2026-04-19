"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/log";
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

  // Read prior status so the audit row records the transition, not
  // just the destination.
  const { data: prior } = await supabase
    .from("support_tickets")
    .select("status, store_id")
    .eq("id", ticketId)
    .maybeSingle();

  const { error } = await supabase
    .from("support_tickets")
    .update(patch)
    .eq("id", ticketId);
  if (error) return { error: error.message };

  await logAudit({
    action: "support.ticket.status_update",
    actor: { id: auth.user.id, email: auth.user.email ?? null },
    storeId: (prior?.store_id as string | undefined) ?? null,
    target: { type: "ticket", id: ticketId },
    metadata: {
      from: (prior?.status as string | undefined) ?? null,
      to: next,
    },
  });

  revalidatePath("/support-tickets");
  return {};
}
