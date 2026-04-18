// BevTek-internal admin for national sponsored campaigns. Email-allowlisted
// via BEVTEK_ADMIN_EMAILS. Non-admins 404 so the surface isn't discoverable.
//
// Intentionally minimal for v1: one form to create, a list to view/end.
// When national sales picks up we'll add per-store targeting UI, budget
// pacing, impression/click reporting, and Stripe Connect revenue payouts.

// Force dynamic rendering — this page gates on the authenticated user's
// email, which Next otherwise can't see at build time. Without this the
// admin route would pre-render as a 404 shell and never re-check auth.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isBevTekAdmin, hasAdminEnvConfigured } from "@/lib/auth/isAdmin";
import { NationalPromoForm } from "./NationalPromoForm";
import { endNationalPromotionAction } from "./actions";

type Row = {
  id: string;
  title: string;
  tagline: string | null;
  brand: string | null;
  category: string | null;
  upc: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  priority: number;
  store_revenue_share_pct: number;
  opt_out_count: number;
};

export default async function AdminPromotionsPage() {
  if (!hasAdminEnvConfigured()) notFound();
  const supabase = await createClient();
  const { ok, email } = await isBevTekAdmin(supabase);
  if (!ok) notFound();

  // Use service client for the read too — admin should see every
  // national promo regardless of RLS (including draft/ended).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows } = await service
    .from("promotions")
    .select(
      "id, title, tagline, brand, category, upc, starts_at, ends_at, status, priority, store_revenue_share_pct",
    )
    .eq("kind", "national")
    .order("created_at", { ascending: false })
    .limit(100);

  // Count opt-outs per promo so we can show "12 stores opted out".
  const { data: optOutRows } = await service
    .from("promotion_opt_outs")
    .select("promotion_id");
  const optOutCounts = new Map<string, number>();
  for (const r of (optOutRows ?? []) as { promotion_id: string }[]) {
    optOutCounts.set(r.promotion_id, (optOutCounts.get(r.promotion_id) ?? 0) + 1);
  }

  const promos: Row[] = ((rows ?? []) as Array<Omit<Row, "opt_out_count">>).map(
    (r) => ({ ...r, opt_out_count: optOutCounts.get(r.id) ?? 0 }),
  );

  return (
    <div className="space-y-8 max-w-4xl p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          National promotions — admin
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Signed in as <strong>{email}</strong>. These campaigns auto-run
          across every store unless the owner opts out. Matching happens
          at display time via UPC → brand → category.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
          Create a new campaign
        </h2>
        <NationalPromoForm />
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
          Campaigns ({promos.length})
        </h2>
        {promos.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No national campaigns yet. Create one above.
          </p>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Match</th>
                  <th className="px-4 py-2 text-right">Share %</th>
                  <th className="px-4 py-2 text-right">Opt-outs</th>
                  <th className="px-4 py-2 text-left">Window</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">{p.title}</div>
                      {p.tagline && (
                        <div className="text-xs text-[color:var(--color-muted)] italic">
                          {p.tagline}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {p.upc ? (
                        <>
                          UPC <span className="font-mono">{p.upc}</span>
                        </>
                      ) : p.brand ? (
                        <>brand ~ {p.brand}</>
                      ) : p.category ? (
                        <>category = {p.category}</>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.store_revenue_share_pct}%
                    </td>
                    <td className="px-4 py-2 text-right">{p.opt_out_count}</td>
                    <td className="px-4 py-2 text-xs text-[color:var(--color-muted)]">
                      {new Date(p.starts_at).toLocaleDateString()}
                      {" → "}
                      {new Date(p.ends_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill value={p.status} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.status === "active" && (
                        <form action={endNationalPromotionAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            End
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    draft: "bg-zinc-100 text-zinc-700",
    paused: "bg-amber-100 text-amber-800",
    ended: "bg-zinc-100 text-zinc-500",
    rejected: "bg-red-100 text-red-800",
    pending_review: "bg-amber-100 text-amber-800",
  };
  const cls = styles[value] ?? "bg-zinc-100 text-zinc-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded uppercase tracking-widest text-[9px] font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}
