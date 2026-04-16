"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type ModuleFormState = { error: string | null };

async function getStoreId() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, storeId: null as string | null, userId: null };
  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id ?? null;
  return { supabase, storeId, userId: auth.user.id };
}

export async function createModuleAction(
  _prev: ModuleFormState,
  formData: FormData,
): Promise<ModuleFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const duration = parseInt(String(formData.get("duration") ?? ""), 10);
  const publish = formData.get("publish") === "on";

  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Module content is required." };

  const { supabase, storeId, userId } = await getStoreId();
  if (!storeId || !userId) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("modules")
    .insert({
      store_id: storeId,
      title,
      description: description || null,
      category: category || null,
      category_group: "custom",
      duration_minutes: Number.isFinite(duration) ? duration : null,
      content: { body },
      is_published: publish,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/trainer");
  redirect(`/trainer/${(data as { id: string }).id}`);
}

export async function updateModuleAction(
  _prev: ModuleFormState,
  formData: FormData,
): Promise<ModuleFormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const duration = parseInt(String(formData.get("duration") ?? ""), 10);
  const publish = formData.get("publish") === "on";

  if (!id) return { error: "Missing module id." };
  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Module content is required." };

  const { supabase } = await getStoreId();
  const { error } = await supabase
    .from("modules")
    .update({
      title,
      description: description || null,
      category: category || null,
      duration_minutes: Number.isFinite(duration) ? duration : null,
      content: { body },
      is_published: publish,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/trainer/${id}`);
  revalidatePath("/trainer");
  redirect(`/trainer/${id}`);
}

export async function deleteModuleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase } = await getStoreId();
  await supabase.from("modules").delete().eq("id", id);
  revalidatePath("/trainer");
  redirect("/trainer");
}

export async function markProgressAction(formData: FormData) {
  const moduleId = String(formData.get("module_id") ?? "");
  const status = String(formData.get("status") ?? "completed");
  if (!moduleId) return;

  const { supabase, storeId, userId } = await getStoreId();
  if (!storeId || !userId) return;

  const now = new Date().toISOString();
  await supabase.from("progress").upsert(
    {
      store_id: storeId,
      user_id: userId,
      module_id: moduleId,
      status,
      started_at: status === "in_progress" ? now : undefined,
      completed_at: status === "completed" ? now : null,
    },
    { onConflict: "user_id,module_id" },
  );
  revalidatePath(`/trainer/${moduleId}`);
  revalidatePath("/trainer");
}
