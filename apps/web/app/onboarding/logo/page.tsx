import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Stepper } from "../Stepper";
import { LogoStep } from "./LogoStep";

export default async function LogoOnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;
  if (!storeId) redirect("/onboarding/store");

  const { data: store } = await supabase
    .from("stores")
    .select("logo_url")
    .eq("id", storeId)
    .maybeSingle();

  return (
    <div>
      <Stepper activeKey="logo" />
      <div className="rounded-2xl bg-white border border-[color:var(--color-border)] p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Add your logo
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            Shown on your customer-facing storefront. A square PNG or JPG works
            best. You can change this anytime in Settings.
          </p>
        </div>
        <LogoStep
          storeId={storeId}
          initialLogo={(store as { logo_url?: string } | null)?.logo_url ?? null}
        />
      </div>
    </div>
  );
}
