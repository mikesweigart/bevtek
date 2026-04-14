import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { NavTabs } from "./NavTabs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, full_name, email, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.store_id) redirect("/onboarding/store");

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", profile.store_id)
    .maybeSingle();

  const role = profile.role as "owner" | "manager" | "staff";
  const isManager = role === "owner" || role === "manager";

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
              BevTek
            </Link>
            <span className="text-sm text-[color:var(--color-muted)]">
              {store?.name ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/settings"
              className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            >
              {profile.full_name ?? profile.email}
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <NavTabs isManager={isManager} />
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
