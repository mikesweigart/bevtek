import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Canonical persona split (see MEMORY): Megan is staff-only (Trainer).
// Every customer-facing surface is branded Gabby.
const features = [
  {
    name: "Megan Trainer",
    desc: "Staff education modules and progress.",
    href: "/trainer",
    live: true,
  },
  {
    name: "Gabby Assistant",
    desc: "Floor AI for real-time customer queries.",
    href: "/assistant",
    live: true,
  },
  {
    name: "Gabby Receptionist",
    desc: "24/7 AI answers every inbound call.",
    href: "/calls",
    live: true,
  },
  {
    name: "Gabby Shopper",
    desc: "Customer-facing web app.",
    href: "shopper",
    live: true,
  },
  {
    name: "Gabby Texting",
    desc: "iMessage conversations with your customers.",
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

  // Each store-column probe runs independently so one missing migration
  // doesn't blank out every flag (the old bundled query would silently
  // return logo_url=null whenever sendblue_webhook_secret was missing —
  // which made "Add your store logo" never tick off even after upload).
  async function loadOne<T extends string>(col: T): Promise<string | null> {
    const { data, error } = await supabase
      .from("stores")
      .select(col)
      .eq("id", p.store_id)
      .maybeSingle();
    if (error) return null;
    return ((data as Record<string, string | null> | null)?.[col] ?? null);
  }

  const [
    inventory,
    modules,
    team,
    invitesPending,
    slug,
    logoUrl,
    retellSecret,
    sendblueSecret,
    recentQueries,
    recentProgress,
    lowStock,
    outOfStockCount,
  ] = await Promise.all([
    supabase.from("inventory").select("*", { count: "exact", head: true }),
    supabase
      .from("modules")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("invites")
      .select("*", { count: "exact", head: true })
      .is("accepted_at", null),
    loadOne("slug"),
    loadOne("logo_url"),
    loadOne("retell_webhook_secret"),
    loadOne("sendblue_webhook_secret"),
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
    // Low-stock watchlist — every active item at or below 2 units. We
    // sort ascending so the most urgent (zero/one-left) items float to
    // the top; owners can one-click through to the inventory row to
    // reorder. Threshold is a constant for now; making it per-store is
    // a future migration once owners ask for it.
    supabase
      .from("inventory")
      .select("id, name, brand, stock_qty, price")
      .eq("store_id", p.store_id)
      .eq("is_active", true)
      .gt("stock_qty", 0)
      .lte("stock_qty", 2)
      .order("stock_qty", { ascending: true })
      .order("name", { ascending: true })
      .limit(10),
    // Out-of-stock count so we can show a "+N out of stock" nudge even
    // when the top-10 low-stock list is short.
    supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .eq("store_id", p.store_id)
      .eq("is_active", true)
      .eq("stock_qty", 0),
  ]);

  const store = {
    slug: slug ?? undefined,
    logo_url: logoUrl ?? undefined,
    retell_webhook_secret: retellSecret ?? undefined,
    sendblue_webhook_secret: sendblueSecret ?? undefined,
  };
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;
  const shopperUrl = store?.slug ? `${origin}/s/${store.slug}` : null;

  const counts = {
    inventory: inventory.count ?? 0,
    modules: modules.count ?? 0,
    team: team.count ?? 0,
    invitesPending: invitesPending.count ?? 0,
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
      // Tick the box the moment an invite is sent — don't make the owner
      // wait for the teammate to actually accept before the checklist
      // reflects progress.
      done: counts.team > 1 || counts.invitesPending > 0,
      label: "Invite a teammate",
      href: "/team",
    },
    {
      done: Boolean(store?.retell_webhook_secret),
      label: "Activate Gabby Receptionist",
      href: "/calls",
    },
    {
      done: Boolean(store?.sendblue_webhook_secret),
      label: "Activate Gabby Texting",
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

  type LowStock = {
    id: string;
    name: string;
    brand: string | null;
    stock_qty: number;
    price: number | null;
  };
  const lowStockItems = (lowStock.data as LowStock[] | null) ?? [];
  const outOfStockTotal = outOfStockCount.count ?? 0;
  const showLowStock =
    isManager && (lowStockItems.length > 0 || outOfStockTotal > 0);

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

      {shopperUrl && (
        <section className="rounded-2xl border border-[color:var(--color-border)] bg-gradient-to-br from-white to-zinc-50 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="shrink-0 p-3 bg-white rounded-xl border border-[color:var(--color-border)]">
            {/* Free QR image service — no install, no CSP issues. Encodes the
                store's public shopper URL so customers scan → mobile web app. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
                shopperUrl,
              )}`}
              alt="Scan to shop"
              width={180}
              height={180}
              className="block"
            />
          </div>
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Your in-store QR code
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Customers scan. Gabby helps. You sell.
            </h2>
            <p className="text-sm text-[color:var(--color-muted)] max-w-lg">
              Tape this at the counter or on the shelf. Anyone with a phone
              scans and lands in your store&rsquo;s mobile shop &mdash; no app
              download, no login.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=4&data=${encodeURIComponent(
                  shopperUrl,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                download="bevtek-qr.png"
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)]"
              >
                Download high-res
              </a>
              <a
                href={shopperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
              >
                Open storefront
              </a>
              <span className="text-xs text-[color:var(--color-muted)] font-mono truncate max-w-[260px]">
                {shopperUrl.replace(/^https?:\/\//, "")}
              </span>
            </div>
          </div>
        </section>
      )}

      {showLowStock && (
        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
                Low stock
              </h2>
              <p className="text-xs text-[color:var(--color-muted)] mt-1">
                Items at or below 2 units{" "}
                {outOfStockTotal > 0 && (
                  <>
                    ·{" "}
                    <Link
                      href="/inventory?stock=out"
                      className="text-[color:var(--color-gold)] hover:underline"
                    >
                      {outOfStockTotal} out of stock
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Link
              href="/inventory?stock=low"
              className="text-xs font-medium text-[color:var(--color-gold)] hover:underline"
            >
              View all →
            </Link>
          </div>
          {lowStockItems.length > 0 ? (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {lowStockItems.map((it) => (
                <li key={it.id}>
                  <Link
                    href={`/inventory/${it.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-zinc-50 -mx-2 px-2 rounded"
                  >
                    <span className="flex-1 truncate">
                      <span className="font-medium">{it.name}</span>
                      {it.brand && (
                        <span className="text-[color:var(--color-muted)]">
                          {" "}
                          · {it.brand}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        it.stock_qty <= 1
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {it.stock_qty} left
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--color-muted)]">
              No items under the low-stock threshold right now.
            </p>
          )}
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
          Megan &amp; Gabby
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
