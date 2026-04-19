import { createClient } from "@/utils/supabase/server";
import { TicketRow } from "./TicketRow";

// Manager/admin triage feed for Report-a-Problem tickets. Scoped to the
// signed-in user's store via RLS (policy support_tickets_select_store_staff).
// Starts simple — open tickets on top, resolved collapsed below — so the
// surface is useful on day 1 without needing filters or search.

export const dynamic = "force-dynamic";

type Ticket = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_role: string | null;
  reporter_email: string | null;
  reporter_name: string | null;
  subject: string;
  description: string;
  severity: "low" | "normal" | "high" | "urgent";
  surface: string | null;
  screen: string | null;
  app_version: string | null;
  last_action: string | null;
  context_json: Record<string, unknown> | null;
  status: "open" | "in_progress" | "resolved" | "wont_fix" | "duplicate";
  assignee_email: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
};

const SEVERITY_RANK: Record<Ticket["severity"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return <div className="p-8">Please sign in to view support tickets.</div>;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) {
    return <div className="p-8">No store on your profile yet.</div>;
  }
  if (p.role !== "manager" && p.role !== "admin") {
    return (
      <div className="p-8">
        Support tickets are visible to managers and admins.
      </div>
    );
  }

  const { data } = await supabase
    .from("support_tickets")
    .select(
      "id, created_at, user_id, user_role, reporter_email, reporter_name, subject, description, severity, surface, screen, app_version, last_action, context_json, status, assignee_email, resolved_at, resolution_notes",
    )
    .eq("store_id", p.store_id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Ticket[];

  const open = rows
    .filter((t) => t.status === "open" || t.status === "in_progress")
    .sort((a, b) => {
      const d = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return d !== 0 ? d : a.created_at < b.created_at ? 1 : -1;
    });
  const done = rows.filter(
    (t) => t.status !== "open" && t.status !== "in_progress",
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Reports from your store&apos;s staff and shoppers. Open items first.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs tracking-[0.2em] uppercase text-[color:var(--color-muted)]">
          Open · {open.length}
        </h2>
        {open.length === 0 ? (
          <div className="text-sm text-[color:var(--color-muted)] border border-dashed border-[color:var(--color-border)] rounded-lg p-6 text-center">
            No open tickets. Nice.
          </div>
        ) : (
          <ul className="space-y-3">
            {open.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs tracking-[0.2em] uppercase text-[color:var(--color-muted)]">
            Closed · {done.length}
          </h2>
          <ul className="space-y-2 opacity-70">
            {done.map((t) => (
              <TicketRow key={t.id} ticket={t} collapsed />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
