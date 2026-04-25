"use client";

import { useActionState, useState } from "react";
import { removeMemberAction, type RemoveMemberState } from "./actions";

const initial: RemoveMemberState = { error: null, removed: false };

/**
 * Two-click offboarding. The first click opens a confirm row with a
 * reason field and Remove/Cancel; the second click fires the server
 * action.
 *
 * The confirm step exists because this is destructive and async —
 * once we fire the RPC the public.users row is gone and the
 * sign-in-next-request effect kicks in. A misclick on the raw Remove
 * button would be an expensive mistake.
 *
 * We deliberately don't use window.confirm() — native dialogs reset
 * focus and on some browsers get blocked by aggressive pop-up
 * blockers the first time someone sees one.
 */
export function RemoveMemberButton({
  userId,
  userEmail,
  isSelf,
}: {
  userId: string;
  userEmail: string;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(removeMemberAction, initial);
  const [confirming, setConfirming] = useState(false);

  if (isSelf) {
    return (
      <span className="text-xs text-[color:var(--color-muted)]">—</span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-600 hover:underline"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2 flex-wrap justify-end">
      <input type="hidden" name="user_id" value={userId} />
      <input
        name="reason"
        placeholder={`Reason (optional) — removing ${userEmail}`}
        className="text-xs rounded border border-[color:var(--color-border)] px-2 py-1 min-w-48"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2.5 py-1 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Confirm remove"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-xs text-[color:var(--color-muted)] hover:underline"
      >
        Cancel
      </button>
      {state.error && (
        <p className="w-full text-xs text-red-600 text-right">{state.error}</p>
      )}
    </form>
  );
}
