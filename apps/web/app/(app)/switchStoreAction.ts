"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { logAudit } from "@/lib/audit/log";

/**
 * Flip users.store_id to the target store via the SECURITY DEFINER RPC
 * switch_current_store. Access is enforced RPC-side (checks
 * organization_members); we don't re-verify here because the RPC is the
 * source of truth and duplicating the check just lets the two drift.
 *
 * We revalidate from the layout root so every cached page in the app
 * shell (dashboard, inventory, calls, etc.) refetches under the new
 * tenant on next request. If this ever gets slow we can narrow the
 * revalidation to just "/".
 */
export async function switchStoreAction(storeId: string): Promise<void> {
  if (!storeId) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { error } = await supabase.rpc("switch_current_store", {
    p_store_id: storeId,
  });

  if (error) {
    // Surface as a thrown error so the client sees a failed transition,
    // but include the message so DevTools shows why. The RPC raises
    // human-readable exceptions on access violations.
    throw new Error(`Failed to switch store: ${error.message}`);
  }

  await logAudit({
    action: "store.switch",
    actor: { id: auth.user.id, email: auth.user.email ?? null },
    storeId,
    target: { type: "store", id: storeId },
  });

  revalidatePath("/", "layout");
}
