"use client";

import { useActionState, useState } from "react";
import { createInviteAction, type InviteState } from "./actions";

const initial: InviteState = { error: null, link: null, emailSent: false };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function InviteForm({ origin }: { origin: string }) {
  const [state, action, pending] = useActionState(createInviteAction, initial);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Invite teammate</h2>
        <p className="text-xs text-[color:var(--color-muted)]">
          We&apos;ll email them an invitation with a link to join.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="origin" value={origin} />
        <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="teammate@example.com"
            className={inputCls}
          />
          <select name="role" defaultValue="staff" className={inputCls}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "SENDING…" : "SEND INVITE"}
          </button>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>

      {state.link && (
        <div className="rounded-md bg-zinc-50 border border-[color:var(--color-border)] p-3 text-sm space-y-2">
          <p className="text-xs text-[color:var(--color-muted)]">
            {state.emailSent
              ? "✓ Email sent. Or share this link directly:"
              : "Invite link (14-day expiry) — send to your teammate:"}
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={state.link}
              className={`${inputCls} font-mono text-xs`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-[color:var(--color-border)] px-3 text-xs hover:border-[color:var(--color-fg)]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
