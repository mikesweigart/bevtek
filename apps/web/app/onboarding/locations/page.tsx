import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Stepper } from "../Stepper";
import { AddLocationForm } from "./AddLocationForm";

type StoreRow = {
  id: string;
  name: string | null;
  city: string | null;
  region: string | null;
};

/**
 * Post-first-store step in onboarding. Lets multi-location operators
 * add their remaining stores before continuing to branding/inventory.
 *
 * Single-location owners see the list with their one store and skip
 * straight to "Continue". We intentionally don't gate the "Continue"
 * button — nothing forces the owner to add all locations up front; they
 * can return via Settings later (once that page exists).
 *
 * The stepper still highlights "Your store" because conceptually this is
 * part of the same setup stage — we don't want to inflate the visible
 * step count and make onboarding feel longer than it is.
 */
export default async function LocationsOnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const firstStoreId = (profile as { store_id?: string } | null)?.store_id;
  if (!firstStoreId) redirect("/onboarding/store");

  // Find the org this user belongs to via their current store, then list
  // every store in that org. This mirrors how the switcher will show
  // locations post-onboarding.
  const { data: currentStore } = await supabase
    .from("stores")
    .select("organization_id")
    .eq("id", firstStoreId)
    .maybeSingle();
  const orgId = (currentStore as { organization_id?: string } | null)
    ?.organization_id;

  let stores: StoreRow[] = [];
  if (orgId) {
    const { data: rows } = await supabase
      .from("stores")
      .select("id, name, city, region")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    stores = (rows as StoreRow[] | null) ?? [];
  }

  return (
    <div>
      <Stepper activeKey="store" />
      <div className="rounded-2xl bg-white border border-[color:var(--color-border)] p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Any other locations?
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            If you run multiple stores, add them here. You can also add
            them later in Settings.
          </p>
        </div>

        <section className="space-y-2">
          <p className="text-xs font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Your locations
          </p>
          <ul className="rounded-md border border-[color:var(--color-border)] divide-y divide-[color:var(--color-border)]">
            {stores.length === 0 && (
              <li className="px-4 py-3 text-sm text-[color:var(--color-muted)]">
                No locations yet.
              </li>
            )}
            {stores.map((s) => {
              const location = [s.city, s.region].filter(Boolean).join(", ");
              return (
                <li
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {s.name ?? "Unnamed store"}
                    </p>
                    {location && (
                      <p className="text-xs text-[color:var(--color-muted)]">
                        {location}
                      </p>
                    )}
                  </div>
                  {s.id === firstStoreId && (
                    <span className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
                      Primary
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <AddLocationForm />

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[color:var(--color-muted)]">
            {stores.length === 1
              ? "Just one location? No problem — continue."
              : `${stores.length} locations set up.`}
          </p>
          <Link
            href="/onboarding/logo"
            className="rounded-md bg-[color:var(--color-fg)] hover:opacity-90 text-white px-5 py-2.5 text-sm font-medium"
          >
            Continue →
          </Link>
        </div>
      </div>
    </div>
  );
}
