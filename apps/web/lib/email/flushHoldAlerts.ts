import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { sendHoldAlertEmail } from "./sendHoldAlert";

// Finds any hold_requests for the current user's store that haven't been
// alerted yet (owner_notified_at is null) and fires off a single email per.
// Called opportunistically on Holds/Dashboard page load — so whenever a
// staff member touches the app, pending alerts get flushed. Not real-time,
// but "good enough" without needing webhooks or cron.

export async function flushHoldAlertsForCurrentStore(): Promise<number> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;
  if (!storeId) return 0;

  const { data: pending } = await supabase
    .from("hold_requests")
    .select(
      "id, customer_name, customer_phone, quantity, item_snapshot, created_at",
    )
    .eq("store_id", storeId)
    .is("owner_notified_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  const list = (pending ?? []) as Array<{
    id: string;
    customer_name: string;
    customer_phone: string | null;
    quantity: number;
    item_snapshot: {
      name?: string;
      brand?: string;
      price?: number | string;
    };
  }>;
  if (list.length === 0) return 0;

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .maybeSingle();
  const storeName = (store as { name?: string } | null)?.name ?? "Your store";

  // Find owner email — first user with role=owner for this store.
  const { data: owner } = await supabase
    .from("users")
    .select("email")
    .eq("store_id", storeId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const ownerEmail = (owner as { email?: string } | null)?.email;
  if (!ownerEmail) return 0;

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;
  const dashboardUrl = `${origin}/holds`;

  let sent = 0;
  for (const h of list) {
    const snap = h.item_snapshot ?? {};
    const { ok } = await sendHoldAlertEmail({
      to: ownerEmail,
      storeName,
      customerName: h.customer_name,
      customerPhone: h.customer_phone,
      itemName: snap.name ?? "an item",
      itemBrand: snap.brand ?? null,
      quantity: h.quantity,
      price: snap.price != null ? Number(snap.price) : null,
      dashboardUrl,
    });
    if (ok) {
      await supabase
        .from("hold_requests")
        .update({ owner_notified_at: new Date().toISOString() })
        .eq("id", h.id);
      sent++;
    }
  }
  return sent;
}
