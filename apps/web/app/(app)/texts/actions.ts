"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type RotateState = { error: string | null; secret: string | null };

export async function rotateTextingSecretAction(): Promise<RotateState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_texting_secret");
  if (error) return { error: error.message, secret: null };
  revalidatePath("/texts");
  return { error: null, secret: (data as string) ?? null };
}
