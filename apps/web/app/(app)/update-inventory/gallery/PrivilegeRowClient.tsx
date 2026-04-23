"use client";

/**
 * Manager gallery: a single staff-member row with a privilege toggle.
 *
 * Revoking cuts a staff member's Update Inventory access immediately
 * (they'll see the "unavailable" screen on their next page load). Restoring
 * is one click too.
 */

import { useTransition, useState } from "react";
import { setUploadPrivilegeAction } from "../actions";

type Props = {
  userId: string;
  name: string;
  email: string;
  privilege: boolean;
};

export function PrivilegeRowClient({ userId, name, email, privilege }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(privilege);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setError(null);
    setOptimistic(next);
    startTransition(async () => {
      const res = await setUploadPrivilegeAction(userId, next);
      if (!res.ok) {
        setOptimistic(!next); // revert
        setError(res.error ?? "Failed to update.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{name}</div>
        {name !== email && (
          <div className="text-xs text-[color:var(--color-muted)] truncate">
            {email}
          </div>
        )}
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`text-xs font-semibold px-3 py-1.5 rounded-md border disabled:opacity-50 ${
          optimistic
            ? "border-[color:var(--color-border)] text-[color:var(--color-fg)] hover:bg-zinc-50"
            : "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
        }`}
      >
        {optimistic ? "Revoke access" : "Restore access"}
      </button>
    </div>
  );
}
