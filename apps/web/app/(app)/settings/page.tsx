import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { StoreSettingsForm } from "./StoreSettingsForm";
import { ProfileForm } from "./ProfileForm";
import { parseHours, type HoursJson } from "@/lib/store/hours";

type Store = {
  name: string;
  slug: string | null;
  phone: string | null;
  timezone: string;
  logo_url: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  hours_json: HoursJson;
};

type Profile = {
  full_name: string | null;
  email: string;
  role: "owner" | "manager" | "staff";
  store_id: string;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profileData, error: profileErr } = await supabase
    .from("users")
    .select("full_name, email, role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();

  if (profileErr || !profileData) {
    return <SchemaError what="profile" detail={profileErr?.message} />;
  }
  const profile = profileData as Profile;

  // Try the full select first (address + hours + logo). If that fails the
  // most likely cause is an un-applied migration — we fall back to the
  // base columns so the page still loads and surface a hint telling the
  // owner which migration to run. Two fallback layers for the two
  // migrations that extended this table (#6 store_logo, multi_store_foundation).
  let store: Store | null = null;
  let migrationHint: string | null = null;

  const full = await supabase
    .from("stores")
    .select(
      "name, slug, phone, timezone, logo_url, address_line_1, address_line_2, city, region, postal_code, country_code, hours_json",
    )
    .eq("id", profile.store_id)
    .maybeSingle();

  if (full.error) {
    // Try with just logo_url — address/hours columns not yet added.
    const withLogo = await supabase
      .from("stores")
      .select("name, slug, phone, timezone, logo_url")
      .eq("id", profile.store_id)
      .maybeSingle();

    if (withLogo.error) {
      // Last resort: base columns only.
      const base = await supabase
        .from("stores")
        .select("name, slug, phone, timezone")
        .eq("id", profile.store_id)
        .maybeSingle();
      if (base.data) {
        store = {
          ...(base.data as Pick<Store, "name" | "slug" | "phone" | "timezone">),
          logo_url: null,
          address_line_1: null,
          address_line_2: null,
          city: null,
          region: null,
          postal_code: null,
          country_code: "US",
          hours_json: {},
        };
        migrationHint =
          "Run migrations 20260414060000 (store_logo) and 20260424200000 (multi_store_foundation) in the Supabase SQL Editor.";
      }
    } else if (withLogo.data) {
      store = {
        ...(withLogo.data as Pick<
          Store,
          "name" | "slug" | "phone" | "timezone" | "logo_url"
        >),
        address_line_1: null,
        address_line_2: null,
        city: null,
        region: null,
        postal_code: null,
        country_code: "US",
        hours_json: {},
      };
      migrationHint =
        "Run migration 20260424200000 (multi_store_foundation) in the Supabase SQL Editor to enable address and hours.";
    }
  } else if (full.data) {
    const row = full.data as Record<string, unknown>;
    store = {
      name: (row.name as string) ?? "",
      slug: (row.slug as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      timezone: (row.timezone as string) ?? "America/New_York",
      logo_url: (row.logo_url as string | null) ?? null,
      address_line_1: (row.address_line_1 as string | null) ?? null,
      address_line_2: (row.address_line_2 as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      region: (row.region as string | null) ?? null,
      postal_code: (row.postal_code as string | null) ?? null,
      country_code: (row.country_code as string | null) ?? "US",
      hours_json: parseHours(row.hours_json),
    };
  }

  if (!store) {
    return (
      <SchemaError
        what="store"
        detail={full.error?.message ?? "Store record not found."}
      />
    );
  }

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;
  const shopperUrl = store.slug ? `${origin}/s/${store.slug}` : null;
  const canEditStore = profile.role === "owner";

  return (
    <div className="space-y-12 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      {migrationHint && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          {migrationHint}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Store
          </h2>
          <p className="text-xs text-[color:var(--color-muted)]">
            Name, URL, branding, and contact info.
          </p>
        </div>
        <StoreSettingsForm
          initialValues={store}
          storeId={profile.store_id}
          shopperUrl={shopperUrl}
          canEdit={canEditStore}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Your profile
          </h2>
          <p className="text-xs text-[color:var(--color-muted)]">
            How you appear inside the store.
          </p>
        </div>
        <ProfileForm initialValues={profile} />
      </section>
    </div>
  );
}

function SchemaError({
  what,
  detail,
}: {
  what: string;
  detail?: string;
}) {
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Couldn&apos;t load {what}
      </h1>
      <p className="text-sm text-[color:var(--color-muted)]">
        The database query failed. This usually means a migration hasn&apos;t
        been run yet. Check the Supabase dashboard, confirm migrations 3–7 have
        been applied, and try again.
      </p>
      {detail && (
        <pre className="rounded-md bg-zinc-50 border border-[color:var(--color-border)] p-3 text-xs whitespace-pre-wrap">
          {detail}
        </pre>
      )}
    </div>
  );
}
