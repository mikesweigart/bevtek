import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Megan Training Analytics — manager/owner view.
 *
 * Answers the three questions every manager asks:
 *   1. Who on my team is engaged (and who's stalled)?
 *   2. Which modules are landing, and which aren't?
 *   3. Where are the knowledge gaps across the team?
 *
 * All numbers are scoped to the current store via RLS (progress rows
 * carry store_id and the policy restricts to current_store_id()), so a
 * plain select here is enough — no explicit store filter.
 */

type ProgressRow = {
  user_id: string;
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
  best_score: number | null;
  completed_at: string | null;
  last_attempt_at: string | null;
  updated_at: string;
};

type UserRow = { id: string; full_name: string | null; email: string; role: string };
type ModuleRow = { id: string; title: string; is_published: boolean };

const STALL_DAYS = 14;

export default async function TrainerAnalyticsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string } | null;
  const isManager = p?.role === "owner" || p?.role === "manager";

  if (!isManager) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Training analytics
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Only managers and owners can view team training analytics.
        </p>
      </div>
    );
  }

  const [teamRes, modulesRes, progressRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, role")
      .neq("role", "customer"),
    supabase
      .from("modules")
      .select("id, title, is_published")
      .eq("is_published", true),
    supabase
      .from("progress")
      .select(
        "user_id, module_id, status, best_score, completed_at, last_attempt_at, updated_at",
      ),
  ]);

  const team = (teamRes.data as UserRow[] | null) ?? [];
  const modules = (modulesRes.data as ModuleRow[] | null) ?? [];
  const progress = (progressRes.data as ProgressRow[] | null) ?? [];
  const publishedCount = modules.length;

  // --- Per-user aggregates ---------------------------------------------
  const byUser = new Map<
    string,
    {
      completed: number;
      inProgress: number;
      lastActivity: number | null;
      avgScore: number | null;
      scoreCount: number;
    }
  >();
  for (const r of progress) {
    const bucket = byUser.get(r.user_id) ?? {
      completed: 0,
      inProgress: 0,
      lastActivity: null,
      avgScore: null,
      scoreCount: 0,
    };
    if (r.status === "completed") bucket.completed += 1;
    else if (r.status === "in_progress") bucket.inProgress += 1;
    const tsRaw = r.last_attempt_at ?? r.completed_at ?? r.updated_at;
    const ts = tsRaw ? new Date(tsRaw).getTime() : null;
    if (ts && (!bucket.lastActivity || ts > bucket.lastActivity)) {
      bucket.lastActivity = ts;
    }
    if (r.best_score != null) {
      const cur = bucket.avgScore ?? 0;
      const n = bucket.scoreCount;
      bucket.avgScore = (cur * n + Number(r.best_score)) / (n + 1);
      bucket.scoreCount = n + 1;
    }
    byUser.set(r.user_id, bucket);
  }

  const staleCutoff = Date.now() - STALL_DAYS * 24 * 60 * 60 * 1000;
  const leaderboard = team
    .map((u) => {
      const b = byUser.get(u.id) ?? {
        completed: 0,
        inProgress: 0,
        lastActivity: null,
        avgScore: null,
        scoreCount: 0,
      };
      const completionPct =
        publishedCount > 0 ? Math.round((b.completed / publishedCount) * 100) : 0;
      const stalled =
        b.inProgress > 0 &&
        (b.lastActivity === null || b.lastActivity < staleCutoff);
      return { user: u, ...b, completionPct, stalled };
    })
    .sort((a, b) => {
      if (b.completed !== a.completed) return b.completed - a.completed;
      return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
    });

  const stalledUsers = leaderboard.filter((row) => row.stalled);
  const totalTeam = team.length;
  const engagedUsers = leaderboard.filter(
    (r) => r.completed > 0 || r.inProgress > 0,
  ).length;

  // --- Per-module aggregates -------------------------------------------
  const byModule = new Map<
    string,
    { completed: number; inProgress: number; totalScore: number; scoreCount: number }
  >();
  for (const r of progress) {
    const bucket = byModule.get(r.module_id) ?? {
      completed: 0,
      inProgress: 0,
      totalScore: 0,
      scoreCount: 0,
    };
    if (r.status === "completed") bucket.completed += 1;
    else if (r.status === "in_progress") bucket.inProgress += 1;
    if (r.best_score != null) {
      bucket.totalScore += Number(r.best_score);
      bucket.scoreCount += 1;
    }
    byModule.set(r.module_id, bucket);
  }

  const moduleStats = modules
    .map((m) => {
      const b = byModule.get(m.id) ?? {
        completed: 0,
        inProgress: 0,
        totalScore: 0,
        scoreCount: 0,
      };
      const completionRate =
        totalTeam > 0 ? Math.round((b.completed / totalTeam) * 100) : 0;
      const avgScore =
        b.scoreCount > 0 ? Math.round(b.totalScore / b.scoreCount) : null;
      return {
        module: m,
        completed: b.completed,
        inProgress: b.inProgress,
        completionRate,
        avgScore,
      };
    })
    .sort((a, b) => a.completionRate - b.completionRate);

  // "Knowledge gaps" = published modules fewer than half the team has
  // completed. Bubble them up top so managers can nudge coverage.
  const gaps = moduleStats.filter((m) => m.completionRate < 50).slice(0, 8);

  return (
    <div className="space-y-10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Training analytics
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Team engagement, module performance, and knowledge gaps.
          </p>
        </div>
        <Link
          href="/trainer"
          className="text-xs font-medium text-[color:var(--color-gold)] hover:underline"
        >
          ← Back to Trainer
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Team size" value={totalTeam} />
        <Stat
          label="Engaged this period"
          value={`${engagedUsers}/${totalTeam}`}
        />
        <Stat label="Published modules" value={publishedCount} />
        <Stat
          label={`Stalled (>${STALL_DAYS}d)`}
          value={stalledUsers.length}
          alert={stalledUsers.length > 0}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
          Team leaderboard
        </h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No teammates yet. Invite staff from the Team page to see progress
            here.
          </p>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Teammate</th>
                  <th className="text-right px-4 py-2 font-medium">Done</th>
                  <th className="text-right px-4 py-2 font-medium">In progress</th>
                  <th className="text-right px-4 py-2 font-medium">Avg score</th>
                  <th className="text-right px-4 py-2 font-medium">Completion</th>
                  <th className="text-right px-4 py-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr
                    key={row.user.id}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">
                        {row.user.full_name ?? row.user.email}
                      </div>
                      <div className="text-[10px] text-[color:var(--color-muted)] capitalize">
                        {row.user.role}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {row.completed}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.inProgress}
                      {row.stalled && (
                        <span
                          title={`No activity in ${STALL_DAYS}+ days`}
                          className="ml-1 text-amber-600"
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.avgScore != null ? `${Math.round(row.avgScore)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.completionPct}%
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-[color:var(--color-muted)]">
                      {row.lastActivity ? relativeTime(row.lastActivity) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {gaps.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
              Knowledge gaps
            </h2>
            <p className="text-xs text-[color:var(--color-muted)] mt-1">
              Published modules fewer than half the team has completed.
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Module</th>
                  <th className="text-right px-4 py-2 font-medium">Completed</th>
                  <th className="text-right px-4 py-2 font-medium">Coverage</th>
                  <th className="text-right px-4 py-2 font-medium">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((m) => (
                  <tr
                    key={m.module.id}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/trainer/${m.module.id}`}
                        className="hover:text-[color:var(--color-gold)]"
                      >
                        {m.module.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {m.completed}
                      <span className="text-[color:var(--color-muted)]">
                        /{totalTeam}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span
                        className={
                          m.completionRate < 25
                            ? "text-red-700 font-semibold"
                            : m.completionRate < 50
                              ? "text-amber-700 font-semibold"
                              : ""
                        }
                      >
                        {m.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {m.avgScore != null ? `${m.avgScore}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
          All modules
        </h2>
        <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Module</th>
                <th className="text-right px-4 py-2 font-medium">Completed</th>
                <th className="text-right px-4 py-2 font-medium">In progress</th>
                <th className="text-right px-4 py-2 font-medium">Coverage</th>
                <th className="text-right px-4 py-2 font-medium">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {moduleStats.map((m) => (
                <tr
                  key={m.module.id}
                  className="border-t border-[color:var(--color-border)]"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/trainer/${m.module.id}`}
                      className="hover:text-[color:var(--color-gold)]"
                    >
                      {m.module.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.completed}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.inProgress}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.completionRate}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.avgScore != null ? `${m.avgScore}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-5">
      <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
        {label}
      </p>
      <p
        className={`text-3xl font-semibold mt-1 ${
          alert ? "text-amber-600" : ""
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
