// BevTek-internal system health dashboard.
//
// Single-page ops view for the "is the backend awake?" question.
// Pulls from existing tables — no new migrations, no new telemetry
// pipeline. When we ship more background jobs the card list below
// grows; the query pattern stays the same.
//
// Gate: same env-allowlist + 404-on-miss pattern as /admin/audit.
// Read path: service-role client because audit_events has no RLS
// policies (see migration 20260418260000).

export const dynamic = "force-dynamic";
// Don't cache — the whole point is a fresh read on every open.
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isBevTekAdmin, hasAdminEnvConfigured } from "@/lib/auth/isAdmin";

// Cron jobs we actively expect to see in audit_events. Keep in sync with
// vercel.json. When a new cron ships, add its action + expected cadence
// here so the "did it run?" card can tell "quiet" from "broken".
const EXPECTED_CRONS: ReadonlyArray<{
  action: string;
  label: string;
  scheduleHuman: string;
  /** Max minutes we'll tolerate since the last successful run before
   *  flagging the job red. 2-3× the schedule period is a reasonable
   *  buffer — cron skews on cold starts and we'd rather wake ops on
   *  "really gone" than "late by 30s". */
  stalenessMinutesWarn: number;
  stalenessMinutesFail: number;
}> = [
  {
    action: "cron.retry_moderations",
    label: "Retry stuck moderations",
    scheduleHuman: "every 10 minutes",
    stalenessMinutesWarn: 25,
    stalenessMinutesFail: 60,
  },
  // Add retention cron once it logs an audit row on completion.
  // (As of 2026-04-23 /api/cron/retention runs but doesn't log — the
  // retry-moderations job was our first with summary audit.)
];

type CronRow = {
  action: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

type StuckSubmissionRow = {
  count: number | null;
};

export default async function AdminHealthPage() {
  if (!hasAdminEnvConfigured()) notFound();
  const supabase = await createClient();
  const { ok, email } = await isBevTekAdmin(supabase);
  if (!ok) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Parallel fetches: latest cron rows + stuck submission count + recent
  // errors-ish (anything with `errored` in metadata).
  const [
    cronsLatestRes,
    stuckCountRes,
    recentErrorsRes,
    recentFlagFlipsRes,
    recentDmcaRes,
  ] = await Promise.all([
    // For each expected cron action, grab the newest row. We do this as a
    // single wide query + client-side pick-latest rather than N queries.
    service
      .from("audit_events")
      .select("action, created_at, metadata")
      .in(
        "action",
        EXPECTED_CRONS.map((c) => c.action),
      )
      .order("created_at", { ascending: false })
      .limit(EXPECTED_CRONS.length * 5),

    // Submissions stuck in `pending` past the retry grace window. If this
    // is non-zero for more than one cron cycle, retry-moderations is
    // probably broken.
    service
      .from("catalog_image_submissions")
      .select("*", { count: "exact", head: true })
      .eq("moderation_status", "pending")
      .lt(
        "created_at",
        new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      ),

    // Any cron row whose metadata reports errored > 0.
    service
      .from("audit_events")
      .select("action, created_at, metadata")
      .ilike("action", "cron.%")
      .order("created_at", { ascending: false })
      .limit(200),

    // Recent feature-flag flips (useful when investigating "what changed
    // for store X today?").
    service
      .from("audit_events")
      .select("actor_email, store_id, action, target_id, metadata, created_at")
      .eq("action", "feature_flag.set")
      .order("created_at", { ascending: false })
      .limit(10),

    // DMCA submitted queue depth — so DMCA doesn't silently pile up if
    // no one checks the future /admin/dmca page.
    service
      .from("dmca_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted"),
  ]);

  const cronRows = (cronsLatestRes.data as CronRow[] | null) ?? [];
  const latestByAction = new Map<string, CronRow>();
  for (const row of cronRows) {
    if (!latestByAction.has(row.action)) latestByAction.set(row.action, row);
  }

  const stuckCount = (stuckCountRes as unknown as StuckSubmissionRow).count ?? 0;

  const erroredCronRuns = ((recentErrorsRes.data as CronRow[] | null) ?? [])
    .filter((r) => {
      const e = r.metadata?.errored;
      return typeof e === "number" && e > 0;
    })
    .slice(0, 20);

  type FlagFlipRow = {
    actor_email: string | null;
    store_id: string | null;
    action: string;
    target_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  };
  const flagFlips = (recentFlagFlipsRes.data as FlagFlipRow[] | null) ?? [];
  const dmcaQueueDepth = (recentDmcaRes as unknown as StuckSubmissionRow).count ?? 0;

  const now = Date.now();

  return (
    <div className="max-w-6xl p-8 space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            System health
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            Signed in as <strong>{email}</strong>. Read-only snapshot;
            refresh to re-run.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/audit"
            className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-sm"
          >
            Audit log →
          </Link>
        </div>
      </div>

      {/* Cron job cards */}
      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Background jobs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {EXPECTED_CRONS.map((cron) => {
            const last = latestByAction.get(cron.action);
            const lastTs = last ? new Date(last.created_at).getTime() : null;
            const ageMin = lastTs ? Math.round((now - lastTs) / 60000) : null;
            let status: "ok" | "warn" | "fail" | "unknown" = "unknown";
            if (ageMin === null) status = "fail";
            else if (ageMin > cron.stalenessMinutesFail) status = "fail";
            else if (ageMin > cron.stalenessMinutesWarn) status = "warn";
            else status = "ok";
            return (
              <HealthCard
                key={cron.action}
                title={cron.label}
                subtitle={`Runs ${cron.scheduleHuman}`}
                status={status}
                primary={
                  ageMin === null
                    ? "No run on record"
                    : `Last run ${formatAge(ageMin)} ago`
                }
                details={
                  last ? summarizeCronMetadata(last.metadata) : "No metadata"
                }
                action={cron.action}
              />
            );
          })}
          <HealthCard
            title="Pending submission queue"
            subtitle="Photos stuck in moderation > 15 min"
            status={
              stuckCount === 0 ? "ok" : stuckCount < 10 ? "warn" : "fail"
            }
            primary={`${stuckCount.toLocaleString()} stuck`}
            details={
              stuckCount === 0
                ? "Queue is clean."
                : "Retry cron should be draining this — check its card and /admin/audit?action=cron.retry_moderations."
            }
            action="catalog_image_submissions"
          />
          <HealthCard
            title="DMCA queue"
            subtitle="Reports awaiting review"
            status={
              dmcaQueueDepth === 0
                ? "ok"
                : dmcaQueueDepth < 5
                  ? "warn"
                  : "fail"
            }
            primary={`${dmcaQueueDepth.toLocaleString()} open`}
            details={
              dmcaQueueDepth === 0
                ? "Nothing to triage."
                : "Every submitted report needs a response within 5 business days."
            }
            action="dmca_reports"
          />
        </div>
      </section>

      {/* Errored cron runs */}
      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Recent cron runs with errors ({erroredCronRuns.length})
        </h2>
        {erroredCronRuns.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No cron runs with errors in the last 200 audit rows.
          </p>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Processed</th>
                  <th className="px-3 py-2 text-left">Errored</th>
                  <th className="px-3 py-2 text-left">Elapsed</th>
                </tr>
              </thead>
              <tbody>
                {erroredCronRuns.map((r, i) => (
                  <tr
                    key={`${r.action}-${r.created_at}-${i}`}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-3 py-2 text-xs font-mono">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{r.action}</td>
                    <td className="px-3 py-2 text-xs">
                      {numeric(r.metadata.processed)}
                    </td>
                    <td className="px-3 py-2 text-xs text-red-700 font-semibold">
                      {numeric(r.metadata.errored)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {numeric(r.metadata.elapsed_ms)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent feature-flag flips */}
      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Recent feature-flag flips
        </h2>
        {flagFlips.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No flags flipped yet. When owners or BevTek admin change a flag,
            it lands here.
          </p>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Store</th>
                  <th className="px-3 py-2 text-left">Flag</th>
                  <th className="px-3 py-2 text-left">Before → After</th>
                </tr>
              </thead>
              <tbody>
                {flagFlips.map((r, i) => (
                  <tr
                    key={`${r.created_at}-${i}`}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-3 py-2 text-xs font-mono">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.actor_email ?? "system"}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {r.store_id ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {r.target_id ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {JSON.stringify(r.metadata.before)} →{" "}
                      {JSON.stringify(r.metadata.after)}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function HealthCard({
  title,
  subtitle,
  status,
  primary,
  details,
  action,
}: {
  title: string;
  subtitle: string;
  status: "ok" | "warn" | "fail" | "unknown";
  primary: string;
  details: string;
  action: string;
}) {
  const statusColor = {
    ok: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-800",
    fail: "bg-red-100 text-red-800",
    unknown: "bg-zinc-100 text-zinc-700",
  }[status];
  const statusLabel = {
    ok: "Healthy",
    warn: "Warning",
    fail: "Failing",
    unknown: "Unknown",
  }[status];
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-[color:var(--color-muted)] mt-0.5">
            {subtitle}
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="text-lg font-semibold">{primary}</p>
      <p className="text-xs text-[color:var(--color-muted)]">{details}</p>
      <div className="pt-1">
        <Link
          href={`/admin/audit?action=${encodeURIComponent(action)}`}
          className="text-xs text-[color:var(--color-gold)] hover:underline"
        >
          View in audit log →
        </Link>
      </div>
    </div>
  );
}

function formatAge(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function summarizeCronMetadata(md: Record<string, unknown>): string {
  const processed = numeric(md.processed);
  const errored = numeric(md.errored);
  const elapsed = numeric(md.elapsed_ms);
  const parts: string[] = [];
  if (processed !== "—") parts.push(`${processed} processed`);
  if (errored !== "—" && Number(errored) > 0) parts.push(`${errored} errored`);
  if (elapsed !== "—") parts.push(`${elapsed} ms`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function numeric(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return v.toLocaleString();
  return "—";
}
