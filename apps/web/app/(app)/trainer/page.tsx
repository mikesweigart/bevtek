import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  created_at: string;
};

type ProgressRow = {
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
};

export default async function TrainerPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId!)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  const isManager = role === "owner" || role === "manager";

  const { data: modules } = (await supabase
    .from("modules")
    .select(
      "id, title, description, category, duration_minutes, is_published, created_at",
    )
    .order("created_at", { ascending: false })) as {
    data: ModuleRow[] | null;
  };

  const { data: progressRows } = (await supabase
    .from("progress")
    .select("module_id, status")
    .eq("user_id", userId!)) as { data: ProgressRow[] | null };

  const progressByModule = new Map(
    (progressRows ?? []).map((p) => [p.module_id, p.status]),
  );

  const visible = (modules ?? []).filter(
    (m) => m.is_published || isManager,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trainer</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Training modules for your team.
          </p>
        </div>
        {isManager && (
          <Link
            href="/trainer/new"
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium"
          >
            New module
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-10 text-center">
          <p className="text-sm text-[color:var(--color-muted)]">
            No modules yet.
            {isManager && (
              <>
                {" "}
                <Link
                  href="/trainer/new"
                  className="text-[color:var(--color-gold)] underline"
                >
                  Create the first one
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((m) => {
            const status = progressByModule.get(m.id) ?? "not_started";
            return (
              <Link
                key={m.id}
                href={`/trainer/${m.id}`}
                className="rounded-lg border border-[color:var(--color-border)] p-5 hover:border-[color:var(--color-gold)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{m.title}</h3>
                  <StatusBadge status={status} published={m.is_published} isManager={isManager} />
                </div>
                {m.description && (
                  <p className="text-sm text-[color:var(--color-muted)] mt-1">
                    {m.description}
                  </p>
                )}
                <div className="flex gap-3 mt-3 text-xs text-[color:var(--color-muted)]">
                  {m.category && <span>{m.category}</span>}
                  {m.duration_minutes && <span>{m.duration_minutes} min</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  published,
  isManager,
}: {
  status: string;
  published: boolean;
  isManager: boolean;
}) {
  if (isManager && !published) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-[color:var(--color-muted)]">
        Draft
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-[color:var(--color-gold)] text-white">
        Done
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">
        In progress
      </span>
    );
  }
  return null;
}
