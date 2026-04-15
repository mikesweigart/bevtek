"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAffiliateAction, type SignupState } from "./actions";

const initial: SignupState = { error: null, sent: false };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function SignupForm() {
  const [state, action, pending] = useActionState(
    signupAffiliateAction,
    initial,
  );

  if (state.sent) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          We sent a confirmation link. Click it to activate your affiliate
          account.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Apply to the affiliate program
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Takes 60 seconds. Approved same day.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Your name</span>
        <input name="full_name" className={inputCls} />
      </label>

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
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          Payout email{" "}
          <span className="text-[10px] text-[color:var(--color-muted)]">
            (optional — defaults to your sign-in email)
          </span>
        </span>
        <input
          type="email"
          name="payout_email"
          className={inputCls}
          placeholder="Where we send Stripe setup links"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Apply"}
      </button>

      <p className="text-center text-sm text-[color:var(--color-muted)]">
        Already an affiliate?{" "}
        <Link
          href="/affiliates/login"
          className="text-[color:var(--color-fg)] underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
