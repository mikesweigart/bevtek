// BevTek-internal admin viewer for audit_events.
//
// Same gate as /admin/promotions — BEVTEK_ADMIN_EMAILS env allowlist,
// 404 on miss so the surface isn't discoverable. The table has RLS enabled
// with no policies, so every read here uses the service-role client.
//
// Filters (as URL query params, so the view is linkable and copy-pasteable
// in incident response threads):
//   ?actor=<email substring>
//   ?action=<exact action string>
//   ?store_id=<uuid>
//   ?target_type=<type>
//   ?since=<ISO date>
//   ?limit=<number, max 500>
//
// Pagination: last row's `id` is exposed as a ?before= cursor so deep
// browsing doesn't drift when new events land. We deliberately don't do
// page numbers — for a privileged log, a stable cursor is more honest.

export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isBevTekAdmin, hasAdminEnvConfigured } from "@/lib/auth/isAdmin";

type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  store_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!hasAdminEnvConfigured()) notFound();
  const supabase = await createClient();
  const { ok, email } = await isBevTekAdmin(supabase);
  if (!ok) notFound();

  const sp = await searchParams;
  const asString = (v: string | string[] | undefined): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const fActor = asString(sp.actor);
  const fAction = asString(sp.action);
  const fStore = asString(sp.store_id);
  const fTarget = asString(sp.target_type);
  const fSince = asString(sp.since);
  const fBefore = asString(sp.before);
  const fLimit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number(asString(sp.limit)) || DEFAULT_LIMIT),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = service
    .from("audit_events")
    .select(
      "id, actor_id, actor_email, store_id, action, target_type, target_id, metadata, ip, user_agent, created_at",
    )
    .order("id", { ascending: false })
    .limit(fLimit);

  if (fActor) query = query.ilike("actor_email", `%${fActor}%`);
  if (fAction) query = query.eq("action", fAction);
  if (fStore) query = query.eq("store_id", fStore);
  if (fTarget) query = query.eq("target_type", fTarget);
  if (fSince) query = query.gte("created_at", fSince);
  if (fBefore) query = query.lt("id", Number(fBefore));

  const { data: rows, error } = await query;

  const events = (rows as AuditRow[] | null) ?? [];
  const lastId = events.length === fLimit ? events[events.length - 1].id : null;

  // Build the "next page" URL with the current filter state preserved.
  const nextParams = new URLSearchParams();
  if (fActor) nextParams.set("actor", fActor);
  if (fAction) nextParams.set("action", fAction);
  if (fStore) nextParams.set("store_id", fStore);
  if (fTarget) nextParams.set("target_type", fTarget);
  if (fSince) nextParams.set("since", fSince);
  if (fLimit !== DEFAULT_LIMIT) nextParams.set("limit", String(fLimit));
  if (lastId !== null) nextParams.set("before", String(lastId));
  const nextHref = `/admin/audit?${nextParams.toString()}`;

  return (
    <div className="max-w-6xl p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit events — admin
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Signed in as <strong>{email}</strong>. Read-only. All privileged
          actions across BevTek land here; customer self-service mutations
          are deliberately excluded.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-3 items-end rounded-lg border border-[color:var(--color-border)] p-4"
      >
        <Field name="actor" label="Actor email contains" value={fActor} />
        <Field name="action" label="Action (exact)" value={fAction} />
        <Field name="store_id" label="Store ID" value={fStore} />
        <Field name="target_type" label="Target type" value={fTarget} />
        <Field
          name="since"
          label="Since (ISO)"
          value={fSince}
          placeholder="2026-04-01"
        />
        <Field
          name="limit"
          label="Limit"
          value={fLimit !== DEFAULT_LIMIT ? String(fLimit) : null}
          placeholder={String(DEFAULT_LIMIT)}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-[color:var(--color-fg)] px-4 py-2 text-sm text-white"
          >
            Apply
          </button>
          <Link
            href="/admin/audit"
            className="rounded-md border border-[color:var(--color-border)] px-4 py-2 text-sm"
          >
            Clear
          </Link>
        </div>
      </form>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          Read failed: {error.message}
        </div>
      )}

      <div className="rounded-lg border border-[color:var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">Store</th>
              <th className="px-3 py-2 text-left">Metadata</th>
              <th className="px-3 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-[color:var(--color-muted)]"
                >
                  No events match these filters.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-[color:var(--color-border)] align-top"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {e.actor_email ?? (
                      <span className="text-[color:var(--color-muted)] italic">
                        {e.actor_id ? "system" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">{e.action}</td>
                  <td className="px-3 py-2 text-xs">
                    {e.target_type ? (
                      <>
                        <span className="text-[color:var(--color-muted)]">
                          {e.target_type}:
                        </span>{" "}
                        <span className="font-mono">{e.target_id}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">
                    {e.store_id ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono max-w-md">
                    {Object.keys(e.metadata).length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-[color:var(--color-muted)]">
                          {Object.keys(e.metadata).length} field
                          {Object.keys(e.metadata).length === 1 ? "" : "s"}
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap text-[10px] leading-tight">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">{e.ip ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[color:var(--color-muted)]">
          Showing {events.length} event{events.length === 1 ? "" : "s"}
          {fBefore && ` before id ${fBefore}`}.
        </p>
        {lastId !== null && (
          <Link
            href={nextHref}
            className="text-sm underline text-[color:var(--color-fg)]"
          >
            Older →
          </Link>
        )}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value: string | null;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="tracking-widest uppercase text-[color:var(--color-muted)]">
        {label}
      </span>
      <input
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="rounded-md border border-[color:var(--color-border)] px-2 py-1.5 text-sm font-mono min-w-[160px]"
      />
    </label>
  );
}
