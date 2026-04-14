import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { markProgressAction, deleteModuleAction } from "../actions";

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  content: { body?: string } | null;
};

type ProgressRow = {
  status: "not_started" | "in_progress" | "completed";
};

export default async function ModuleViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: mod } = (await supabase
    .from("modules")
    .select(
      "id, title, description, category, duration_minutes, is_published, content",
    )
    .eq("id", id)
    .maybeSingle()) as { data: ModuleRow | null };

  if (!mod) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  const isManager = role === "owner" || role === "manager";

  const { data: progress } = (await supabase
    .from("progress")
    .select("status")
    .eq("module_id", id)
    .eq("user_id", auth.user!.id)
    .maybeSingle()) as { data: ProgressRow | null };

  const status = progress?.status ?? "not_started";
  const body = mod.content?.body ?? "";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link
          href="/trainer"
          className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          ← Modules
        </Link>
      </div>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {mod.title}
            </h1>
            {mod.description && (
              <p className="text-[color:var(--color-muted)] mt-1">
                {mod.description}
              </p>
            )}
          </div>
          {isManager && (
            <div className="flex gap-2">
              <Link
                href={`/trainer/${mod.id}/edit`}
                className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-fg)]"
              >
                Edit
              </Link>
            </div>
          )}
        </div>
        <div className="flex gap-3 text-xs text-[color:var(--color-muted)]">
          {mod.category && <span>{mod.category}</span>}
          {mod.duration_minutes && <span>{mod.duration_minutes} min</span>}
          {isManager && !mod.is_published && (
            <span className="px-2 py-0.5 rounded bg-zinc-100">Draft</span>
          )}
        </div>
      </header>

      <article className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
        {body}
      </article>

      <div className="flex items-center gap-3 pt-4 border-t border-[color:var(--color-border)]">
        {status === "completed" ? (
          <div className="flex items-center gap-3">
            <span className="text-sm px-3 py-1.5 rounded bg-[color:var(--color-gold)] text-white">
              ✓ Completed
            </span>
            <form action={markProgressAction}>
              <input type="hidden" name="module_id" value={mod.id} />
              <input type="hidden" name="status" value="in_progress" />
              <button
                type="submit"
                className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
              >
                Mark incomplete
              </button>
            </form>
          </div>
        ) : (
          <form action={markProgressAction}>
            <input type="hidden" name="module_id" value={mod.id} />
            <input type="hidden" name="status" value="completed" />
            <button
              type="submit"
              className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-medium"
            >
              Mark as completed
            </button>
          </form>
        )}
        {isManager && (
          <form
            action={deleteModuleAction}
            className="ml-auto"
          >
            <input type="hidden" name="id" value={mod.id} />
            <button
              type="submit"
              className="text-sm text-red-600 hover:underline"
            >
              Delete module
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
