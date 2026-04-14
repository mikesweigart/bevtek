import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { InviteForm } from "./InviteForm";
import { revokeInviteAction } from "./actions";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "manager" | "staff";
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: "owner" | "manager" | "staff";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export default async function TeamPage() {
  const supabase = await createClient();

  const { data: users } = (await supabase
    .from("users")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true })) as { data: UserRow[] | null };

  const { data: invites } = (await supabase
    .from("invites")
    .select("id, email, role, token, expires_at, accepted_at, created_at")
    .is("accepted_at", null)
    .order("created_at", { ascending: false })) as {
    data: InviteRow[] | null;
  };

  // Used to render invite links if the user wants to copy an existing one.
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3000"}`;

  const now = Date.now();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Manage who has access to your store.
        </p>
      </div>

      <InviteForm origin={origin} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
          Members
        </h2>
        <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-2">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(invites ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Pending invites
          </h2>
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-left px-4 py-2 font-medium">Expires</th>
                  <th className="text-left px-4 py-2 font-medium">Link</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(invites ?? []).map((i) => {
                  const expired = new Date(i.expires_at).getTime() < now;
                  const link = `${origin}/invite/${i.token}`;
                  return (
                    <tr
                      key={i.id}
                      className="border-t border-[color:var(--color-border)]"
                    >
                      <td className="px-4 py-2">{i.email}</td>
                      <td className="px-4 py-2 capitalize">{i.role}</td>
                      <td className="px-4 py-2 text-xs text-[color:var(--color-muted)]">
                        {expired
                          ? "expired"
                          : new Date(i.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs truncate max-w-xs">
                        {link}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            Revoke
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
