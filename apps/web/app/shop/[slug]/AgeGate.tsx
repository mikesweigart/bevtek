"use client";

// Age gate: blocks the shop page until the visitor confirms they're 21+.
//
// Regulatory baseline: every TTB/state ABC review of a direct-to-consumer
// alcohol site expects a 21+ confirmation before product display. We set
// a signed cookie on confirm so returning visitors aren't re-prompted for
// 30 days, and we never pass the DOB itself — confirming "yes I am 21+"
// is enough for the compliance obligation.

import { useActionState, useState } from "react";
import { confirmAgeAction, type AgeGateState } from "./age-actions";

export function AgeGate({ storeName }: { storeName: string }) {
  const [state, formAction, pending] = useActionState<AgeGateState, FormData>(
    confirmAgeAction,
    { error: null },
  );
  const [under21, setUnder21] = useState(false);

  if (under21) {
    // Once a visitor says they're under 21, we don't bounce them to a store
    // front — we show a neutral "sorry, 21+ only" page. Don't set any cookie
    // so the next visit still gets the gate.
    return (
      <div className="min-h-screen bg-[#FBF7F0] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🍷</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            You must be 21 or older
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {storeName} is an alcohol retailer and can only serve customers who
            are of legal drinking age in their state. Please come back when
            you&apos;re 21+.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-[color:var(--color-border)] p-8 shadow-sm">
        <div className="text-center space-y-2 mb-6">
          <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
            Powered by BevTek.ai
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{storeName}</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Please confirm your age to enter
          </p>
        </div>

        <form action={formAction} className="space-y-3">
          <button
            type="submit"
            name="confirmed"
            value="yes"
            disabled={pending}
            className="w-full rounded-lg bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white font-semibold py-3 disabled:opacity-60"
          >
            {pending ? "Entering…" : "I am 21 or older"}
          </button>
          <button
            type="button"
            onClick={() => setUnder21(true)}
            className="w-full rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] font-medium py-3"
          >
            I am under 21
          </button>
        </form>

        {state.error && (
          <p className="text-xs text-red-600 mt-3 text-center">{state.error}</p>
        )}

        <p className="text-[10px] text-[color:var(--color-muted)] mt-6 leading-relaxed text-center">
          By entering, you confirm that you are of legal drinking age in your
          state. {storeName} does not sell alcohol to anyone under 21. We may
          request ID upon pickup or delivery.
        </p>
      </div>
    </div>
  );
}
