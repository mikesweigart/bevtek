import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { StoreSettingsForm } from "./StoreSettingsForm";
import { ProfileForm } from "./ProfileForm";

type Store = {
  name: string;
  slug: string | null;
  phone: string | null;
  timezone: string;
  logo_url: string | null;
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

  // Try with logo_url first. If column doesn't exist (migration 6 not run),
  // retry with just the base columns and surface a helpful pointer.
  let store: Store | null = null;
  let migrationHint: string | null = null;

  const full = await supabase
    .from("stores")
    .select("name, slug, phone, timezone, logo_url")
    .eq("id", profile.store_id)
    .maybeSingle();

  if (full.error) {
    // Fall back: retry without logo_url so the page still loads.
    const fallback = await supabase
      .from("stores")
      .select("name, slug, phone, timezone")
      .eq("id", profile.store_id)
      .maybeSingle();
    if (fallback.data) {
      store = { ...(fallback.data as Omit<Store, "logo_url">), logo_url: null };
      migrationHint =
        "Run migration 6 (store_logo) in the Supabase SQL Editor to enable logo uploads.";
    }
  } else {
    store = (full.data as Store | null) ?? null;
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
