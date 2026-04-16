import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { Stepper } from "../Stepper";

export default async function DonePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; full_name?: string } | null;
  if (!p?.store_id) redirect("/onboarding/store");

  const { data: store } = await supabase
    .from("stores")
    .select("name, slug, logo_url")
    .eq("id", p.store_id)
    .maybeSingle();
  const s = store as { name: string; slug: string | null; logo_url: string | null } | null;

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;
  const shopperUrl = s?.slug ? `${origin}/s/${s.slug}` : null;

  return (
    <div>
      <Stepper activeKey="done" />
      <div className="rounded-2xl bg-gradient-to-br from-white to-[#FBF7F0] border-2 border-[color:var(--color-gold)] p-10 text-center space-y-5">
        <p className="text-5xl">🥂</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          You&apos;re live{p?.full_name ? `, ${p.full_name}` : ""}.
        </h1>
        <p className="text-[color:var(--color-muted)] max-w-md mx-auto leading-relaxed">
          {s?.name ?? "Your store"} is set up and ready. Megan&apos;s standing
          by — open the dashboard to start using her.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 pt-4">
          <Link
            href="/dashboard"
            className="rounded-lg border border-[color:var(--color-border)] bg-white p-4 text-left hover:border-[color:var(--color-gold)] transition-colors"
          >
            <p className="text-sm font-semibold mb-1">Dashboard →</p>
            <p className="text-xs text-[color:var(--color-muted)]">
              Stats, recent activity, all 5 Megan products
            </p>
          </Link>
          {shopperUrl && (
            <a
              href={shopperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[color:var(--color-border)] bg-white p-4 text-left hover:border-[color:var(--color-gold)] transition-colors"
            >
              <p className="text-sm font-semibold mb-1">Your storefront ↗</p>
              <p className="text-xs text-[color:var(--color-muted)] font-mono truncate">
                {shopperUrl.replace(/^https?:\/\//, "")}
              </p>
            </a>
          )}
        </div>

        <div className="pt-4">
          <p className="text-xs text-[color:var(--color-muted)] max-w-md mx-auto">
            Want voice (Megan Receptionist) or iMessage (Megan Texting) live?
            Email{" "}
            <a
              href="mailto:activate@bevtek.ai"
              className="text-[color:var(--color-gold)] underline"
            >
              activate@bevtek.ai
            </a>{" "}
            with your phone number — we&apos;ll have it running within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
