import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const features = [
  {
    name: "Megan Trainer",
    desc: "Staff education modules and progress.",
    href: "/trainer",
    live: true,
  },
  {
    name: "Megan Assistant",
    desc: "Floor AI for real-time customer queries.",
    href: "/assistant",
    live: true,
  },
  {
    name: "Megan Receptionist",
    desc: "Inbound phone calls via Retell AI.",
    href: "/calls",
    live: true,
  },
  {
    name: "Megan Shopper",
    desc: "Customer-facing web app.",
    href: "shopper",
    live: true,
  },
  {
    name: "Megan Texting",
    desc: "iMessage conversations via Sendblue.",
    href: "/texts",
    live: true,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role, store_id")
    .eq("id", auth.user!.id)
    .single();

  const p = profile as {
    full_name: string | null;
    email: string;
    role: string;
    store_id: string;
  };
  const isManager = p.role === "owner" || p.role === "manager";

  // Parallel counts + the pieces the getting-started checklist needs.
  // Try the full store query first; fall back to base columns if migrations
  // 6/8 haven't been applied yet.
  async function loadStore() {
    const full = await supabase
      .from("stores")
      .select(
        "slug, logo_url, retell_webhook_secret, sendblue_webhook_secret",
      )
      .eq("id", p.store_id)
      .maybeSingle();
    if (!full.error) return full.data;
    const fallback = await supabase
      .from("stores")
      .select("slug")
      .eq("id", p.store_id)
      .maybeSingle();
    return fallback.data;
  }

  const [inventory, modules, team, storeData, recentQueries, recentProgress] =
    await Promise.all([
      supabase.from("inventory").select("*", { count: "exact", head: true }),
      supabase
        .from("modules")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true),
      supabase.from("users").select("*", { count: "exact", head: true }),
      loadStore(),
      supabase
        .from("floor_queries")
        .select("id, query_text, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("progress")
        .select("module_id, user_id, completed_at, modules(title)")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5),
    ]);

  const store = storeData as {
    slug?: string;
    logo_url?: string;
    retell_webhook_secret?: string;
    sendblue_webhook_secret?: string;
  } | null;
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;
  const shopperUrl = store?.slug ? `${origin}/s/${store.slug}` : null;

  const counts = {
    inventory: inventory.count ?? 0,
    modules: modules.count ?? 0,
    team: team.count ?? 0,
  };

  // Getting-started checklist — only shown to managers, only while incomplete.
  const checklist = [
    {
      done: Boolean(store?.logo_url),
      label: "Add your store logo",
      href: "/settings",
    },
    {
      done: counts.inventory > 0,
      label: "Import your inventory",
      href: "/inventory/import",
    },
    {
      done: counts.modules > 0,
      label: "Publish your first training module",
      href: "/trainer/new",
    },
    {
      done: counts.team > 1,
      label: "Invite a teammate",
      href: "/team",
    },
    {
      done: Boolean(store?.retell_webhook_secret),
      label: "Connect Megan Receptionist (Retell AI)",
      href: "/calls",
    },
    {
      done: Boolean(store?.sendblue_webhook_secret),
      label: "Connect Megan Texting (Sendblue)",
      href: "/texts",
    },
  ];
  const completedCount = checklist.filter((i) => i.done).length;
  const showChecklist = isManager && completedCount < checklist.length;

  const stats = [
    { label: "Inventory items", value: counts.inventory, href: "/inventory" },
    { label: "Published modules", value: counts.modules, href: "/trainer" },
    { label: "Team members", value: counts.team, href: "/team" },
  ];

  type Query = { id: string; query_text: string; created_at: string };
  type Progress = {
    module_id: string;
    user_id: string;
    completed_at: string;
    modules: { title: string } | null;
  };
  const queries = (recentQueries.data as Query[] | null) ?? [];
  const progress = (recentProgress.data as Progress[] | null) ?? [];
  const hasActivity = queries.length > 0 || progress.length > 0;

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome{p?.full_name ? `, ${p.full_name}` : ""}.
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Signed in as {p?.email} ·{" "}
          <span className="capitalize">{p?.role}</span>
        </p>
      </div>

      {showChecklist && (
        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
              Get set up
            </h2>
            <span className="text-xs text-[color:var(--color-muted)]">
              {completedCount}/{checklist.length}
            </span>
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 text-sm hover:text-[color:var(--color-gold)]"
                >
                  <span
                    className={`w-4 h-4 rounded-full border ${
                      item.done
                        ? "bg-[color:var(--color-gold)] border-[color:var(--color-gold)]"
                        : "border-[color:var(--color-border)]"
                    } flex items-center justify-center text-white text-[10px]`}
                  >
                    {item.done && "✓"}
                  </span>
                  <span className={item.done ? "line-through text-[color:var(--color-muted)]" : ""}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-[color:var(--color-border)] p-5 hover:border-[color:var(--color-gold)] transition-colors"
          >
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              {s.label}
            </p>
            <p className="text-3xl font-semibold mt-1">
              {s.value.toLocaleString()}
            </p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Megan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const isShopper = f.href === "shopper";
            const href = isShopper ? shopperUrl : f.href;
            const inner = (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${f.live ? "bg-[color:var(--color-gold)]" : "bg-zinc-300"}`}
                  />
                  <h3 className="text-sm font-semibold">{f.name}</h3>
                </div>
                <p className="text-sm text-[color:var(--color-muted)]">
                  {f.desc}
                </p>
                {isShopper && shopperUrl ? (
                  <p className="text-xs mt-3 font-mono text-[color:var(--color-gold)] truncate">
                    {shopperUrl.replace(/^https?:\/\//, "")}
                  </p>
                ) : (
                  <p className="text-xs mt-3 text-[color:var(--color-muted)]">
                    {f.live ? "Open →" : "Coming soon"}
                  </p>
                )}
              </>
            );
            const cls =
              "rounded-lg border border-[color:var(--color-border)] p-5 block" +
              (f.live
                ? " hover:border-[color:var(--color-gold)] transition-colors"
                : "");
            if (isShopper && href) {
              return (
                <a
                  key={f.name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                >
                  {inner}
                </a>
              );
            }
            return href ? (
              <Link key={f.name} href={href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={f.name} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {hasActivity && (
        <section className="grid md:grid-cols-2 gap-6">
          {queries.length > 0 && (
            <div>
              <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
                Recent Assistant queries
              </h2>
              <ul className="space-y-1.5">
                {queries.map((q) => (
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
          {progress.length > 0 && (
            <div>
              <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
                Recent training completions
              </h2>
              <ul className="space-y-1.5">
                {progress.map((pr, idx) => (
                  <li
                    key={`${pr.user_id}-${pr.module_id}-${idx}`}
                    className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm"
                  >
                    <div className="truncate">
                      {pr.modules?.title ?? "A module"}{" "}
                      <span className="text-[color:var(--color-muted)]">
                        completed
                      </span>
                    </div>
                    <div className="text-[10px] text-[color:var(--color-muted)] mt-0.5">
                      {relativeTime(pr.completed_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
