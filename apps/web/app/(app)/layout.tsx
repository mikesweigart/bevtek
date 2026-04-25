import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { NavTabs } from "./NavTabs";
import { StoreSwitcher, type SwitcherStore } from "./StoreSwitcher";

type MembershipRow = {
  role: string;
  organization_id: string;
  organizations: {
    id: string;
    name: string | null;
    stores: { id: string; name: string | null }[] | null;
  } | null;
};

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

  // Every store the user has access to, grouped with its organization so
  // the switcher can show org-grouped entries. This is a single round trip
  // via PostgREST embedded selects. If the organization_members table is
  // missing (pre-multi_store_foundation migration), the query errors and
  // we fall back to a single-store list — layout still renders.
  let switcherStores: SwitcherStore[] = [];
  try {
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("role, organization_id, organizations(id, name, stores(id, name))")
      .eq("user_id", auth.user.id);
    if (!error && memberships) {
      const rows = memberships as unknown as MembershipRow[];
      for (const m of rows) {
        const org = m.organizations;
        if (!org) continue;
        const storeList = org.stores ?? [];
        for (const s of storeList) {
          if (!s.id) continue;
          switcherStores.push({
            id: s.id,
            name: s.name ?? "Unnamed store",
            orgName: org.name,
            role: m.role,
          });
        }
      }
    }
  } catch {
    // swallow — the switcher falls back to a static label below
  }
  // Always include the current store so the label renders even if the
  // memberships lookup returned nothing (edge case: manually-created
  // store without a matching org_member row).
  if (!switcherStores.some((s) => s.id === profile.store_id)) {
    switcherStores.push({
      id: profile.store_id,
      name: store?.name ?? "—",
      orgName: null,
      role: profile.role ?? "staff",
    });
  }

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
            <StoreSwitcher
              currentStoreId={profile.store_id}
              currentStoreName={store?.name ?? "—"}
              stores={switcherStores}
            />
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
