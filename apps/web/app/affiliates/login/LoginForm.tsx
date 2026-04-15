"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAffiliateAction, type LoginState } from "./actions";

const initial: LoginState = { error: null };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAffiliateAction, initial);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Affiliate sign in
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Welcome back, partner.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className={inputCls}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-[color:var(--color-muted)]">
        Not an affiliate yet?{" "}
        <Link
          href="/affiliates/signup"
          className="text-[color:var(--color-fg)] underline"
        >
          Apply
        </Link>
      </p>
    </form>
  );
}
