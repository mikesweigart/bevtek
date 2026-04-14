import { createClient } from "@/utils/supabase/server";

const features = [
  { name: "Megan Trainer", desc: "Staff education modules and progress." },
  { name: "Megan Assistant", desc: "Floor AI for real-time customer queries." },
  { name: "Megan Receptionist", desc: "Inbound phone calls via Retell AI." },
  { name: "Megan Shopper", desc: "Customer-facing web app." },
  { name: "Megan Texting", desc: "iMessage conversations via Sendblue." },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role")
    .eq("id", auth.user!.id)
    .single();

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Signed in as {profile?.email} ·{" "}
          <span className="capitalize">{profile?.role}</span>
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Megan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.name}
              className="rounded-lg border border-[color:var(--color-border)] p-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
                <h3 className="text-sm font-semibold">{f.name}</h3>
              </div>
              <p className="text-sm text-[color:var(--color-muted)]">{f.desc}</p>
              <p className="text-xs mt-3 text-[color:var(--color-muted)]">
                Coming soon
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
