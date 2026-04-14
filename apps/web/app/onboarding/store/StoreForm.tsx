"use client";

import { useActionState } from "react";
import { createStoreAction, type OnboardingState } from "./actions";

const initial: OnboardingState = { error: null };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function StoreForm() {
  const [state, action, pending] = useActionState(createStoreAction, initial);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your store
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          One quick step — then you&apos;re in.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Store name</span>
        <input
          name="store_name"
          required
          placeholder="Good Vibes Liquor"
          className={inputCls}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Your name</span>
        <input name="full_name" placeholder="Optional" className={inputCls} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Store phone</span>
        <input
          name="phone"
          type="tel"
          placeholder="+1 (404) 555-0100"
          className={inputCls}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Timezone</span>
        <select name="timezone" defaultValue="America/New_York" className={inputCls}>
          <option value="America/New_York">Eastern</option>
          <option value="America/Chicago">Central</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Phoenix">Mountain (Phoenix)</option>
          <option value="America/Los_Angeles">Pacific</option>
          <option value="America/Anchorage">Alaska</option>
          <option value="Pacific/Honolulu">Hawaii</option>
        </select>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create store"}
      </button>
    </form>
  );
}
