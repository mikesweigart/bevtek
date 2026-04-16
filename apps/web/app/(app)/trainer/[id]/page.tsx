import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { deleteModuleAction } from "../actions";

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  category_group: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  is_seed: boolean;
  star_reward: number;
  content: unknown;
  store_id: string | null;
};

type ProgressRow = {
  status: "not_started" | "in_progress" | "completed";
  stars_earned: number;
  best_score: number | null;
  attempts: number;
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
      "id, title, description, category_group, duration_minutes, is_published, is_seed, star_reward, content, store_id",
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
  const canEdit = isManager && !mod.is_seed;

  const { data: progress } = (await supabase
    .from("progress")
    .select("status, stars_earned, best_score, attempts")
    .eq("module_id", id)
    .eq("user_id", auth.user!.id)
    .maybeSingle()) as { data: ProgressRow | null };

  // Check if this module has a quiz
  const { count: quizCount } = await supabase
    .from("quiz_questions")
    .select("*", { count: "exact", head: true })
    .eq("module_id", id);

  const hasQuiz = (quizCount ?? 0) > 0;

  // Extract content body from jsonb — supports {body: "..."} or raw markdown
  let body = "";
  if (mod.content && typeof mod.content === "object") {
    const c = mod.content as { body?: string };
    body = c.body ?? "";
  } else if (typeof mod.content === "string") {
    body = mod.content;
  }

  const stars = progress?.stars_earned ?? 0;
  const starsMax = mod.star_reward;

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
          <div className="flex gap-2">
            {canEdit && (
              <Link
                href={`/trainer/${mod.id}/edit`}
                className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-fg)]"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-3 text-xs text-[color:var(--color-muted)] items-center">
          {mod.duration_minutes && <span>{mod.duration_minutes} min read</span>}
          <span>·</span>
          <span>{starsMax} ⭐ available</span>
          {stars > 0 && (
            <>
              <span>·</span>
              <span className="text-[color:var(--color-gold)] font-semibold">
                {"⭐".repeat(stars)} earned
              </span>
            </>
          )}
          {mod.is_seed && (
            <>
              <span>·</span>
              <span className="italic">BevTek module</span>
            </>
          )}
        </div>
      </header>

      <article className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
        {body}
      </article>

      <div className="pt-6 border-t border-[color:var(--color-border)] flex items-center gap-3 flex-wrap">
        {hasQuiz ? (
          progress?.status === "completed" ? (
            <>
              <span className="text-sm px-3 py-1.5 rounded bg-[color:var(--color-gold)] text-white">
                ✓ Quiz passed · {stars} ⭐
              </span>
              <Link
                href={`/trainer/${mod.id}/quiz`}
                className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
              >
                Retake quiz
              </Link>
            </>
          ) : (
            <Link
              href={`/trainer/${mod.id}/quiz`}
              className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
            >
              {progress?.attempts ? "Try quiz again" : "Start quiz"}
            </Link>
          )
        ) : (
          <p className="text-sm text-[color:var(--color-muted)]">
            No quiz on this module yet.
          </p>
        )}
        {canEdit && (
          <form action={deleteModuleAction} className="ml-auto">
            <input type="hidden" name="id" value={mod.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">
              Delete module
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
