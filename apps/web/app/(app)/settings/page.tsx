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

  const { data: profile } = (await supabase
    .from("users")
    .select("full_name, email, role, store_id")
    .eq("id", auth.user!.id)
    .single()) as { data: Profile };

  const { data: store } = (await supabase
    .from("stores")
    .select("name, slug, phone, timezone, logo_url")
    .eq("id", profile.store_id)
    .single()) as { data: Store };

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
