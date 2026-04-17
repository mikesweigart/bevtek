"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { sendHoldConfirmationEmail } from "@/lib/email/sendHoldConfirmation";
import { sendHoldCannotFulfillEmail } from "@/lib/email/sendHoldCannotFulfill";

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

/**
 * Staff taps "Accept & Grab Item" — moves the hold from pending → in_progress.
 * Captures who is grabbing + when so the queue can show "Alex · 0:42."
 */
export async function acceptHoldAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("hold_requests")
    .update({
      status: "in_progress",
      in_progress_by: auth.user.id,
      in_progress_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/holds");
}

/**
 * Staff taps "Item Placed at Front" — moves in_progress → confirmed
 * (ready_for_pickup) AND fires the customer notification (email via
 * Resend; SMS is a no-op until Sendblue's API is hooked up).
 */
export async function placedAtFrontAction(formData: FormData) {
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

  // Fire the ready-for-pickup notification.
  try {
    const { data: hold } = (await supabase
      .from("hold_requests")
      .select(
        "customer_name, customer_email, customer_phone, quantity, hold_until, item_snapshot, store_id, notify_channel",
      )
      .eq("id", id)
      .maybeSingle()) as {
      data:
        | (HoldForEmail & {
            notify_channel: "sms" | "email" | "both" | null;
          })
        | null;
    };
    if (hold?.customer_email &&
        (hold.notify_channel === "email" ||
         hold.notify_channel === "both" ||
         hold.notify_channel === null)) {
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
      await supabase
        .from("hold_requests")
        .update({ customer_notified_at: new Date().toISOString() })
        .eq("id", id);
    }
  } catch {
    // Email is best-effort.
  }

  revalidatePath("/holds");
  revalidatePath("/dashboard");
}

/**
 * Staff taps "Cannot Fulfill" — records the reason, flips status,
 * and notifies the customer so they don't keep waiting.
 */
export async function cannotFulfillAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Not available";
  if (!id) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("hold_requests")
    .update({
      status: "cannot_fulfill",
      cannot_fulfill_reason: reason,
      cannot_fulfilled_at: new Date().toISOString(),
      cannot_fulfilled_by: auth.user.id,
    })
    .eq("id", id);

  // Fire the "sorry, we couldn't fulfill" notification so the customer
  // isn't left refreshing. Same notify_channel rules as placedAtFront.
  try {
    const { data: hold } = (await supabase
      .from("hold_requests")
      .select(
        "customer_name, customer_email, customer_phone, item_snapshot, store_id, notify_channel",
      )
      .eq("id", id)
      .maybeSingle()) as {
      data:
        | {
            customer_name: string;
            customer_email: string | null;
            customer_phone: string | null;
            item_snapshot: {
              name?: string;
              brand?: string;
            };
            store_id: string;
            notify_channel: "sms" | "email" | "both" | null;
          }
        | null;
    };

    if (
      hold?.customer_email &&
      (hold.notify_channel === "email" ||
        hold.notify_channel === "both" ||
        hold.notify_channel === null)
    ) {
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

      await sendHoldCannotFulfillEmail({
        to: hold.customer_email,
        customerName: hold.customer_name,
        storeName: s?.name ?? "the store",
        itemName: hold.item_snapshot?.name ?? "your item",
        itemBrand: hold.item_snapshot?.brand ?? null,
        reason,
        storePhone: s?.phone ?? null,
        shopperUrl: s?.slug ? `${origin}/s/${s.slug}` : null,
      });

      await supabase
        .from("hold_requests")
        .update({ customer_notified_at: new Date().toISOString() })
        .eq("id", id);
    }
  } catch {
    // Email is best-effort — don't block the staff action.
  }

  revalidatePath("/holds");
  revalidatePath("/dashboard");
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
