import Link from "next/link";
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
    href: null,
    live: false,
  },
  {
    name: "Megan Receptionist",
    desc: "Inbound phone calls via Retell AI.",
    href: null,
    live: false,
  },
  {
    name: "Megan Shopper",
    desc: "Customer-facing web app.",
    href: null,
    live: false,
  },
  {
    name: "Megan Texting",
    desc: "iMessage conversations via Sendblue.",
    href: null,
    live: false,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role")
    .eq("id", auth.user!.id)
    .single();

  const p = profile as { full_name: string | null; email: string; role: string };

  // Parallel counts for at-a-glance stats.
  const [inventory, modules, team] = await Promise.all([
    supabase.from("inventory").select("*", { count: "exact", head: true }),
    supabase
      .from("modules")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),
    supabase.from("users").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Inventory items", value: inventory.count ?? 0, href: "/inventory" },
    { label: "Published modules", value: modules.count ?? 0, href: "/trainer" },
    { label: "Team members", value: team.count ?? 0, href: "/team" },
  ];

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
            <p className="text-3xl font-semibold mt-1">{s.value.toLocaleString()}</p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Megan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const inner = (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${f.live ? "bg-[color:var(--color-gold)]" : "bg-zinc-300"}`}
                  />
                  <h3 className="text-sm font-semibold">{f.name}</h3>
                </div>
                <p className="text-sm text-[color:var(--color-muted)]">{f.desc}</p>
                <p className="text-xs mt-3 text-[color:var(--color-muted)]">
                  {f.live ? "Open →" : "Coming soon"}
                </p>
              </>
            );
            const cls =
              "rounded-lg border border-[color:var(--color-border)] p-5 block" +
              (f.live ? " hover:border-[color:var(--color-gold)] transition-colors" : "");
            return f.href ? (
              <Link key={f.name} href={f.href} className={cls}>
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
    </div>
  );
}
