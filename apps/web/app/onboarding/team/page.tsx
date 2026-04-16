import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Stepper } from "../Stepper";

export default async function TeamOnboardingPage() {
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

  const { count: teamCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <Stepper activeKey="team" />
      <div className="rounded-2xl bg-white border border-[color:var(--color-border)] p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Invite your team
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            Bring on managers and floor staff. They&apos;ll get their own
            login, the floor Assistant, and the Trainer with their own progress.
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex gap-3 items-start rounded-lg border border-[color:var(--color-border)] p-3">
            <span className="text-[color:var(--color-gold)] font-semibold">
              👑
            </span>
            <div>
              <p className="font-medium">Owners</p>
              <p className="text-xs text-[color:var(--color-muted)]">
                Full access — billing, settings, team, all features. Usually one
                person.
              </p>
            </div>
          </li>
          <li className="flex gap-3 items-start rounded-lg border border-[color:var(--color-border)] p-3">
            <span className="text-[color:var(--color-gold)] font-semibold">
              🛡️
            </span>
            <div>
              <p className="font-medium">Managers</p>
              <p className="text-xs text-[color:var(--color-muted)]">
                Inventory, training modules, team — but no billing. Shift
                managers and assistant managers.
              </p>
            </div>
          </li>
          <li className="flex gap-3 items-start rounded-lg border border-[color:var(--color-border)] p-3">
            <span className="text-[color:var(--color-gold)] font-semibold">
              🍷
            </span>
            <div>
              <p className="font-medium">Staff</p>
              <p className="text-xs text-[color:var(--color-muted)]">
                Floor Assistant + Trainer access. Their own progress and
                leaderboard standing. Most of your team.
              </p>
            </div>
          </li>
        </ul>

        {teamCount && teamCount > 1 && (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 p-3 text-sm">
            ✓ {teamCount} team member{teamCount === 1 ? "" : "s"} so far.
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/team"
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
          >
            {teamCount && teamCount > 1
              ? "Manage team"
              : "Send your first invite"}
          </Link>
          <Link
            href="/onboarding/done"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            {teamCount && teamCount > 1 ? "Continue" : "Skip for now"}
          </Link>
        </div>
      </div>
    </div>
  );
}
