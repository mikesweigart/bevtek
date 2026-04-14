import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AcceptForm } from "./AcceptForm";

type InviteLookup = {
  email: string;
  role: string;
  store_name: string;
  expired: boolean;
  accepted: boolean;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // If already signed in and linked to a store, bounce to dashboard.
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: profile } = await supabase
      .from("users")
      .select("store_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.store_id) redirect("/dashboard");
  }

  const { data: rows } = (await supabase.rpc("lookup_invite", {
    p_token: token,
  })) as { data: InviteLookup[] | null };

  const invite = Array.isArray(rows) ? rows[0] : null;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center mb-8 text-sm tracking-widest uppercase text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          BevTek
        </Link>
        {!invite ? (
          <InviteError title="Invite not found">
            This link doesn&apos;t match any invite. Double-check the URL with the
            person who sent it.
          </InviteError>
        ) : invite.accepted ? (
          <InviteError title="Already used">
            This invite has already been accepted.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            instead.
          </InviteError>
        ) : invite.expired ? (
          <InviteError title="Invite expired">
            Ask the sender for a fresh one.
          </InviteError>
        ) : (
          <AcceptForm
            token={token}
            email={invite.email}
            storeName={invite.store_name}
            role={invite.role}
          />
        )}
      </div>
    </div>
  );
}

function InviteError({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-[color:var(--color-muted)]">{children}</p>
    </div>
  );
}
