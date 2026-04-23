// Security settings — MFA enrollment + session assurance surface.
//
// Server component: fetches the user's current auth factors and passes
// them to the MFAEnroll client component. Supabase keeps factors in its
// own auth schema; we don't mirror them into `public.users`.
//
// When the feature flag `require_mfa_for_managers` is on, owner/manager
// accounts are required to enroll at least one TOTP factor before they
// can access manager-only surfaces. That enforcement lands in the layout
// above this page (a follow-up pass); today enrollment is voluntary but
// the groundwork is all here.

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { MFAEnroll } from "./MFAEnroll";
import { getFeatureFlag } from "@/lib/flags";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id ?? null;
  const role = (profile as { role?: string } | null)?.role ?? "staff";

  // Current factors.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  // Supabase returns both `all` and `totp`; we show everything so users
  // can unenroll a legacy factor they forgot about.
  const factors = (factorsData?.all ?? []) as Factor[];

  const isManager = role === "owner" || role === "manager";
  const mfaRequired = await getFeatureFlag(storeId, "require_mfa_for_managers");

  // AAL of the current session — informational for now. If we flip
  // require_mfa_for_managers on, the layout wrapper will gate on aal2.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentAal = aal?.currentLevel ?? "aal1";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Security
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Signed in as <strong>{auth.user.email}</strong>. Role:{" "}
          <span className="capitalize">{role}</span>.
        </p>
      </div>

      {isManager && mfaRequired && currentAal !== "aal2" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Your store requires managers to sign in with two-factor
          authentication. Enroll a TOTP factor below and then sign back in
          with the 6-digit code on your next login to complete the upgrade.
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
            Two-factor authentication
          </h2>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            Time-based one-time codes (TOTP) from Authy, 1Password, Google
            Authenticator, or any RFC-6238-compatible app.
          </p>
        </div>

        <MFAEnroll initialFactors={factors} />
      </section>

      <section className="text-xs text-[color:var(--color-muted)] space-y-1">
        <p>
          Session assurance level: <span className="font-mono">{currentAal}</span>
          {currentAal === "aal2"
            ? " (MFA-verified this session)"
            : " (password only; elevate by signing in with a 6-digit code)"}
        </p>
      </section>
    </div>
  );
}
