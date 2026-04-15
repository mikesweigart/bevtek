"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type RotateState = { error: string | null; secret: string | null };

export async function rotateReceptionistSecretAction(): Promise<RotateState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_receptionist_secret");
  if (error) return { error: error.message, secret: null };
  revalidatePath("/calls");
  return { error: null, secret: (data as string) ?? null };
}
