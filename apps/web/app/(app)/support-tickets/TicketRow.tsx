"use client";

import { useState, useTransition } from "react";
import { updateTicketStatus } from "./actions";

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

const SEVERITY_COLOR: Record<Ticket["severity"], string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-gray-100 text-gray-700 border-gray-200",
  low: "bg-gray-50 text-gray-500 border-gray-200",
};

const NEXT_STATUSES: Ticket["status"][] = [
  "open",
  "in_progress",
  "resolved",
  "wont_fix",
  "duplicate",
];

export function TicketRow({
  ticket,
  collapsed,
}: {
  ticket: Ticket;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);
  const [status, setStatus] = useState(ticket.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onStatusChange = (newStatus: Ticket["status"]) => {
    setError(null);
    startTransition(async () => {
      const res = await updateTicketStatus(ticket.id, newStatus);
      if (res?.error) setError(res.error);
      else setStatus(newStatus);
    });
  };

  const reporter =
    ticket.reporter_name ||
    ticket.reporter_email ||
    (ticket.user_id ? `user ${ticket.user_id.slice(0, 8)}` : "anonymous");

  return (
    <li className="border border-[color:var(--color-border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--color-surface)]"
      >
        <span
          className={`inline-block text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${SEVERITY_COLOR[ticket.severity]} shrink-0 mt-0.5`}
        >
          {ticket.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{ticket.subject}</div>
          <div className="text-xs text-[color:var(--color-muted)] mt-1">
            {reporter}
            {ticket.user_role ? ` · ${ticket.user_role}` : ""}
            {ticket.surface ? ` · ${ticket.surface}` : ""}
            {" · "}
            {new Date(ticket.created_at).toLocaleString()}
          </div>
        </div>
        <span className="text-xs text-[color:var(--color-muted)] uppercase tracking-wider shrink-0">
          {status.replace("_", " ")}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[color:var(--color-border)] space-y-3">
          <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {ticket.screen && (
              <>
                <dt className="text-[color:var(--color-muted)]">Screen</dt>
                <dd className="font-mono">{ticket.screen}</dd>
              </>
            )}
            {ticket.last_action && (
              <>
                <dt className="text-[color:var(--color-muted)]">Last action</dt>
                <dd>{ticket.last_action}</dd>
              </>
            )}
            {ticket.app_version && (
              <>
                <dt className="text-[color:var(--color-muted)]">App version</dt>
                <dd className="font-mono">{ticket.app_version}</dd>
              </>
            )}
            {ticket.reporter_email && (
              <>
                <dt className="text-[color:var(--color-muted)]">Email</dt>
                <dd>
                  <a
                    href={`mailto:${ticket.reporter_email}`}
                    className="underline"
                  >
                    {ticket.reporter_email}
                  </a>
                </dd>
              </>
            )}
          </dl>

          {ticket.context_json && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[color:var(--color-muted)]">
                Context JSON
              </summary>
              <pre className="mt-2 p-2 bg-[color:var(--color-surface)] rounded overflow-x-auto text-[11px]">
                {JSON.stringify(ticket.context_json, null, 2)}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-2">
            <span className="text-xs text-[color:var(--color-muted)]">
              Set status:
            </span>
            {NEXT_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onStatusChange(st)}
                disabled={pending || st === status}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  st === status
                    ? "border-[color:var(--color-gold)] bg-[#FBF7F0] text-[color:var(--color-fg)]"
                    : "border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
                } disabled:opacity-50`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
      )}
    </li>
  );
}
