"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { sendHoldConfirmationEmail } from "@/lib/email/sendHoldConfirmation";

type HoldForEmail = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  quantity: number;
  hold_until: string;
  item_snapshot: {
    name?: string;
    brand?: string;
    price?: number | string;
  };
  store_id: string;
};

export async function confirmHoldAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("hold_requests")
    .update({
      status: "confirmed",
      confirmed_by: auth.user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Send confirmation email if the customer provided an email.
  try {
    const { data: hold } = (await supabase
      .from("hold_requests")
      .select(
        "customer_name, customer_email, customer_phone, quantity, hold_until, item_snapshot, store_id",
      )
      .eq("id", id)
      .maybeSingle()) as { data: HoldForEmail | null };

    if (hold?.customer_email) {
      const { data: store } = await supabase
        .from("stores")
        .select("name, slug, phone")
        .eq("id", hold.store_id)
        .maybeSingle();
      const s = store as { name: string; slug?: string; phone?: string } | null;
      const hdrs = await headers();
      const origin =
        hdrs.get("origin") ??
        `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;

      await sendHoldConfirmationEmail({
        to: hold.customer_email,
        customerName: hold.customer_name,
        storeName: s?.name ?? "the store",
        itemName: hold.item_snapshot?.name ?? "your item",
        itemBrand: hold.item_snapshot?.brand ?? null,
        price:
          hold.item_snapshot?.price != null
            ? Number(hold.item_snapshot.price)
            : null,
        quantity: hold.quantity,
        holdUntil: hold.hold_until,
        storePhone: s?.phone ?? null,
        shopperUrl: s?.slug ? `${origin}/s/${s.slug}` : null,
      });
    }
  } catch {
    // Email is best-effort; don't fail the confirm action.
  }

  revalidatePath("/holds");
  revalidatePath("/dashboard");
}

export async function pickupHoldAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase
    .from("hold_requests")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
      picked_up_by: auth.user?.id ?? null,
    })
    .eq("id", id);
  revalidatePath("/holds");
}

export async function cancelHoldAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("hold_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/holds");
  revalidatePath("/dashboard");
}
