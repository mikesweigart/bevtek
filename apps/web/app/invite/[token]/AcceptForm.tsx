"use client";

import { useActionState } from "react";
import {
  acceptInviteAction,
  type InviteAcceptState,
} from "./actions";

const initial: InviteAcceptState = { error: null, sent: false };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function AcceptForm({
  token,
  email,
  storeName,
  role,
}: {
  token: string;
  email: string;
  storeName: string;
  role: string;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);

  if (state.sent) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          We sent a confirmation link. Click it to finish joining {storeName}.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Join {storeName}
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          You&apos;ve been invited as a{" "}
          <span className="capitalize font-medium text-[color:var(--color-fg)]">
            {role}
          </span>
          . Create a password to get in.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          defaultValue={email}
          readOnly
          className={`${inputCls} bg-zinc-50`}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Your name</span>
        <input name="full_name" placeholder="Optional" className={inputCls} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending ? "Joining…" : `Join ${storeName}`}
      </button>
    </form>
  );
}
