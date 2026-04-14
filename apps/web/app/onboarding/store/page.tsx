import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { StoreForm } from "./StoreForm";

export default async function StoreOnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // If the user already has a store, skip onboarding.
  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.store_id) redirect("/dashboard");

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <StoreForm />
      </div>
    </div>
  );
}
