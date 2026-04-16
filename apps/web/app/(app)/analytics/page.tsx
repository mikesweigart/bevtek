import { createClient } from "@/utils/supabase/server";

export default async function AnalyticsPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Only managers and owners can view analytics.
        </p>
      </div>
    );
  }

  // Parallel data fetches
  const [
    inventoryCount,
    outOfStockCount,
    lowStockCount,
    teamCount,
    modulesCount,
    completedProgress,
    totalProgress,
    recentQueries,
    topQueries,
    holdStats,
  ] = await Promise.all([
    supabase.from("inventory").select("*", { count: "exact", head: true }),
    supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .lte("stock_qty", 0),
    supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .gt("stock_qty", 0)
      .lte("stock_qty", 5),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("modules")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),
    supabase
      .from("progress")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("progress").select("*", { count: "exact", head: true }),
    supabase
      .from("floor_queries")
      .select("id, query_text, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("floor_queries")
      .select("query_text")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("hold_requests")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // Compute top queries (most frequent)
  const queryCounts = new Map<string, number>();
  for (const q of (topQueries.data as { query_text: string }[] | null) ?? []) {
    const key = q.query_text.toLowerCase().trim();
    queryCounts.set(key, (queryCounts.get(key) ?? 0) + 1);
  }
  const topQueryList = Array.from(queryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Hold stats
  const holds = (holdStats.data as { status: string }[] | null) ?? [];
  const holdPending = holds.filter((h) => h.status === "pending").length;
  const holdConfirmed = holds.filter((h) => h.status === "confirmed").length;
  const holdPickedUp = holds.filter((h) => h.status === "picked_up").length;
  const holdCancelled = holds.filter(
    (h) => h.status === "cancelled" || h.status === "expired",
  ).length;

  const completionRate =
    (totalProgress.count ?? 0) > 0
      ? Math.round(
          ((completedProgress.count ?? 0) / (totalProgress.count ?? 1)) * 100,
        )
      : 0;

  type Query = { id: string; query_text: string; created_at: string };
  const recent = (recentQueries.data as Query[] | null) ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Store performance at a glance.
        </p>
      </div>

      {/* Top-line stats */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Inventory items" value={inventoryCount.count ?? 0} />
        <Stat
          label="Out of stock"
          value={outOfStockCount.count ?? 0}
          alert={(outOfStockCount.count ?? 0) > 0}
        />
        <Stat
          label="Low stock (≤5)"
          value={lowStockCount.count ?? 0}
          alert={(lowStockCount.count ?? 0) > 0}
        />
        <Stat label="Team members" value={teamCount.count ?? 0} />
      </section>

      {/* Training stats */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
          Training
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Published modules" value={modulesCount.count ?? 0} />
          <Stat label="Module completions" value={completedProgress.count ?? 0} />
          <Stat label="Completion rate" value={`${completionRate}%`} />
        </div>
      </section>

      {/* Hold request stats */}
      {holds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
            Hold requests
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Pending" value={holdPending} alert={holdPending > 0} />
            <Stat label="Confirmed" value={holdConfirmed} />
            <Stat label="Picked up" value={holdPickedUp} />
            <Stat label="Cancelled" value={holdCancelled} />
          </div>
        </section>
      )}

      {/* Assistant insights */}
      <section className="grid md:grid-cols-2 gap-6">
        {topQueryList.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
              Most-asked questions
            </h2>
            <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Query</th>
                    <th className="text-right px-4 py-2 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueryList.map(([query, count]) => (
                    <tr
                      key={query}
                      className="border-t border-[color:var(--color-border)]"
                    >
                      <td className="px-4 py-2">{query}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
              Recent Assistant queries
            </h2>
            <ul className="space-y-1.5">
              {recent.map((q) => (
                <li
                  key={q.id}
                  className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm"
                >
                  <div className="truncate">{q.query_text}</div>
                  <div className="text-[10px] text-[color:var(--color-muted)] mt-0.5">
                    {relativeTime(q.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
