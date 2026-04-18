import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { levelForStars, CATEGORY_GROUPS, CATEGORY_ORDER } from "@/lib/trainer/levels";
import { BackfillImagesButton } from "./BackfillImagesButton";

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  category_group: string | null;
  position: number;
  star_reward: number;
  is_published: boolean;
  is_seed: boolean;
  duration_minutes: number | null;
  store_id: string | null;
};

type ProgressRow = {
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
  stars_earned: number;
  best_score: number | null;
};

type GameRow = {
  total_stars: number;
  current_streak_days: number;
  longest_streak_days: number;
};

type LeaderRow = {
  id: string;
  total_stars: number;
  users: { full_name: string | null; email: string } | null;
};

export default async function TrainerPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user!.id;

  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id, full_name")
    .eq("id", userId)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string; full_name?: string } | null;
  const isManager = p?.role === "owner" || p?.role === "manager";

  const [modulesRes, progressRes, gameRes, leaderRes] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "id, title, description, category_group, position, star_reward, is_published, is_seed, duration_minutes, store_id",
      )
      .order("category_group", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("progress")
      .select("module_id, status, stars_earned, best_score")
      .eq("user_id", userId),
    supabase
      .from("user_gamification")
      .select("total_stars, current_streak_days, longest_streak_days")
      .eq("id", userId)
      .maybeSingle(),
    // Leaderboard: top staff in this store by stars
    supabase
      .from("user_gamification")
      .select("id, total_stars, users!inner(full_name, email, store_id)")
      .eq("users.store_id", p?.store_id ?? "")
      .order("total_stars", { ascending: false })
      .limit(10),
  ]);

  const modules = (modulesRes.data as ModuleRow[] | null) ?? [];
  const progress = (progressRes.data as ProgressRow[] | null) ?? [];
  const game = (gameRes.data as GameRow | null) ?? {
    total_stars: 0,
    current_streak_days: 0,
    longest_streak_days: 0,
  };
  const leaders = (leaderRes.data as unknown as LeaderRow[] | null) ?? [];

  const progressByModule = new Map(progress.map((p) => [p.module_id, p]));
  const visible = modules.filter(
    (m) => m.is_published || (isManager && !m.is_seed),
  );

  const level = levelForStars(game.total_stars);

  // Group modules by category
  const grouped = new Map<string, ModuleRow[]>();
  for (const m of visible) {
    const key = m.category_group ?? (m.is_seed ? "other" : "custom");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  const totalCompleted = progress.filter((p) => p.status === "completed").length;
  const totalModules = visible.length;

  return (
    <div className="space-y-10">
      {/* Header + level card */}
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back{p?.full_name ? `, ${p.full_name}` : ""}.
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            {totalCompleted} of {totalModules} modules completed
          </p>
        </div>
        <LevelCard
          level={level}
          totalStars={game.total_stars}
          streakDays={game.current_streak_days}
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total stars" value={game.total_stars} icon="⭐" />
        <Stat label="Current streak" value={`${game.current_streak_days} day${game.current_streak_days === 1 ? "" : "s"}`} icon="🔥" />
        <Stat
          label="Accuracy"
          value={
            progress.length > 0
              ? `${Math.round(
                  (progress.filter((p) => p.best_score && p.best_score >= 1).length /
                    progress.length) * 100,
                )}%`
              : "—"
          }
          icon="🎯"
        />
      </section>

      {/* Leaderboard */}
      {leaders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
            Store leaderboard
          </h2>
          <ol className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            {leaders.map((l, i) => {
              const isMe = l.id === userId;
              const name = l.users?.full_name ?? l.users?.email ?? "—";
              const lvl = levelForStars(l.total_stars);
              return (
                <li
                  key={l.id}
                  className={`flex items-center gap-3 px-4 py-2 text-sm border-b border-[color:var(--color-border)] last:border-0 ${
                    isMe ? "bg-[#FBF7F0]" : ""
                  }`}
                >
                  <span className="w-6 text-xs text-[color:var(--color-muted)] text-right">
                    {i + 1}
                  </span>
                  <span className="flex-1 flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    {isMe && (
                      <span className="text-[10px] tracking-widest uppercase bg-[color:var(--color-gold)] text-white px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                    <span className="text-[10px] text-[color:var(--color-muted)]">
                      {lvl.name}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    ⭐ {l.total_stars}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Manager tools */}
      {isManager && <BackfillImagesButton />}

      {/* Module library, grouped */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
            Module library
          </h2>
          {isManager && (
            <div className="flex items-center gap-2">
              <Link
                href="/trainer/analytics"
                className="rounded-md border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] px-3 py-1.5 text-xs"
              >
                Team analytics
              </Link>
              <Link
                href="/trainer/new"
                className="rounded-md border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] px-3 py-1.5 text-xs"
              >
                + Custom module
              </Link>
            </div>
          )}
        </div>

        {CATEGORY_ORDER.filter((k) => grouped.has(k)).map((catKey) => {
          const cat = CATEGORY_GROUPS[catKey];
          if (!cat) return null;
          const items = grouped.get(catKey) ?? [];
          return (
            <div key={catKey} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold">{cat.label}</h3>
                <span className="text-xs text-[color:var(--color-muted)]">
                  {items.length} modules
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => {
                  const pr = progressByModule.get(m.id);
                  const stars = pr?.stars_earned ?? 0;
                  return (
                    <Link
                      key={m.id}
                      href={`/trainer/${m.id}`}
                      className="rounded-lg border border-[color:var(--color-border)] p-4 hover:border-[color:var(--color-gold)] transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight">
                          {m.title}
                        </h4>
                        {stars > 0 && (
                          <span className="text-xs text-[color:var(--color-gold)] font-semibold whitespace-nowrap">
                            {"⭐".repeat(stars)}
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs text-[color:var(--color-muted)] leading-snug line-clamp-2">
                          {m.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-auto pt-1">
                        {pr?.status === "completed" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-gold)] text-white">
                            Done
                          </span>
                        ) : pr?.status === "in_progress" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                            In progress
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                            New
                          </span>
                        )}
                        <span className="text-[10px] text-[color:var(--color-muted)] ml-auto">
                          {m.star_reward} ⭐ to earn
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function LevelCard({
  level,
  totalStars,
  streakDays,
}: {
  level: ReturnType<typeof levelForStars>;
  totalStars: number;
  streakDays: number;
}) {
  return (
    <div className="rounded-xl border-2 border-[color:var(--color-gold)] bg-gradient-to-br from-white to-[#FBF7F0] p-5 min-w-[240px]">
      <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
        Level {level.index + 1}
      </p>
      <p className="text-2xl font-semibold tracking-tight mt-1">
        {level.name}
      </p>
      {level.nextMinStars !== null ? (
        <>
          <div className="mt-3 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[color:var(--color-gold)]"
              style={{ width: `${level.progressToNext * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[color:var(--color-muted)] mt-1.5">
            {level.nextMinStars - totalStars} ⭐ to next level
          </p>
        </>
      ) : (
        <p className="text-[10px] text-[color:var(--color-muted)] mt-3">
          Top level reached 🏆
        </p>
      )}
      {streakDays > 0 && (
        <p className="text-[10px] text-[color:var(--color-gold)] mt-2 font-medium">
          🔥 {streakDays} day streak
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
          {label}
        </p>
      </div>
      <p className="text-3xl font-semibold mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
