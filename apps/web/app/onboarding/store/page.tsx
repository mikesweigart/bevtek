import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { StoreForm } from "./StoreForm";
import { Stepper } from "../Stepper";

export default async function StoreOnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // If the user already has a store, skip ahead.
  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.store_id) redirect("/onboarding/logo");

  return (
    <div>
      <Stepper activeKey="store" />
      <div className="rounded-2xl bg-white border border-[color:var(--color-border)] p-8">
        <StoreForm />
      </div>
    </div>
  );
}
