"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

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
  revalidatePath("/holds");
  revalidatePath("/dashboard");
}

export async function pickupHoldAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("hold_requests")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
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
