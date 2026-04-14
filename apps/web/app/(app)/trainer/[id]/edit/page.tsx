import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ModuleForm } from "../../ModuleForm";

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  content: { body?: string } | null;
};

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "manager") redirect(`/trainer/${id}`);

  const { data: mod } = (await supabase
    .from("modules")
    .select(
      "id, title, description, category, duration_minutes, is_published, content",
    )
    .eq("id", id)
    .maybeSingle()) as { data: ModuleRow | null };

  if (!mod) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/trainer/${mod.id}`}
          className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          ← Back
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit module</h1>
      </div>
      <ModuleForm
        initialValues={{
          id: mod.id,
          title: mod.title,
          description: mod.description ?? "",
          category: mod.category ?? "",
          duration_minutes: mod.duration_minutes,
          body: mod.content?.body ?? "",
          is_published: mod.is_published,
        }}
      />
    </div>
  );
}
