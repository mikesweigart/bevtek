"use client";

import { useState } from "react";
import { DAYS, DAY_LABEL, type HoursJson, type Day } from "@/lib/store/hours";

type Row = { closed: boolean; open: string; close: string };

/**
 * Seven-day open/close grid. Renders as hidden-compatible form fields
 * (hours_<day>_closed / _open / _close) so it submits as part of the
 * parent <form> — no client-side JSON serialization step.
 *
 * Marking a day Closed greys out the time inputs but keeps their values
 * so the user doesn't lose what they typed if they untick. On submit the
 * server just ignores open/close when closed=on.
 */
export function HoursEditor({
  initial,
  disabled,
}: {
  initial: HoursJson;
  disabled?: boolean;
}) {
  const seed: Record<Day, Row> = {} as Record<Day, Row>;
  for (const d of DAYS) {
    const v = initial[d];
    if (!v) {
      seed[d] = { closed: false, open: "", close: "" };
    } else if (v.closed) {
      seed[d] = { closed: true, open: "", close: "" };
    } else {
      seed[d] = { closed: false, open: v.open, close: v.close };
    }
  }
  const [rows, setRows] = useState<Record<Day, Row>>(seed);

  const update = (d: Day, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  return (
    <div className="rounded-md border border-[color:var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
          <tr>
            <th className="text-left px-3 py-2 font-medium w-32">Day</th>
            <th className="text-left px-3 py-2 font-medium w-24">Closed</th>
            <th className="text-left px-3 py-2 font-medium">Open</th>
            <th className="text-left px-3 py-2 font-medium">Close</th>
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => {
            const row = rows[d];
            return (
              <tr
                key={d}
                className="border-t border-[color:var(--color-border)]"
              >
                <td className="px-3 py-2 text-sm font-medium">
                  {DAY_LABEL[d]}
                </td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      name={`hours_${d}_closed`}
                      checked={row.closed}
                      disabled={disabled}
                      onChange={(e) =>
                        update(d, { closed: e.target.checked })
                      }
                    />
                    <span className="text-[color:var(--color-muted)]">
                      Closed
                    </span>
                  </label>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="time"
                    name={`hours_${d}_open`}
                    value={row.open}
                    disabled={disabled || row.closed}
                    onChange={(e) => update(d, { open: e.target.value })}
                    className="rounded border border-[color:var(--color-border)] px-2 py-1 text-sm disabled:bg-zinc-50 disabled:text-[color:var(--color-muted)]"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="time"
                    name={`hours_${d}_close`}
                    value={row.close}
                    disabled={disabled || row.closed}
                    onChange={(e) => update(d, { close: e.target.value })}
                    className="rounded border border-[color:var(--color-border)] px-2 py-1 text-sm disabled:bg-zinc-50 disabled:text-[color:var(--color-muted)]"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
