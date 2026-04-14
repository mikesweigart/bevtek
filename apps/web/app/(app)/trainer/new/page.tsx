import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ModuleForm } from "../ModuleForm";

export default async function NewModulePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "manager") redirect("/trainer");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New module</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Write a training module for your team.
        </p>
      </div>
      <ModuleForm />
    </div>
  );
}
